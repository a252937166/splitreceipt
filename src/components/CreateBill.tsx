import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { decodeEventLog } from 'viem'
import { WalletButton } from '@/wallet-ui'
import { PlusCircle, Trash2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { SPLIT_RECEIPT_ABI, SPLIT_RECEIPT_ADDRESS, ARC_TESTNET_CHAIN_ID } from '../splitReceiptContract'
import { requireChain } from '@/onchain-facts'
import { parseUsdcToNative, validateUsdcInput } from '../usdcFormat'
import { applyCreationReplacement, confirmBillCreation, type BillCreatedLog, type CreateBillSubmission } from '../createBillReceipt'

const chain = requireChain(ARC_TESTNET_CHAIN_ID)

function parseOnchainError(error: unknown): string {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('denied')) return 'Transaction cancelled.'
  if (msg.includes('titletoolong')) return 'Title exceeds 80 characters.'
  if (msg.includes('zerorecipient')) return 'Recipient address cannot be zero.'
  if (msg.includes('invalidpayercount')) return 'Add 2 to 5 unique payer addresses.'
  if (msg.includes('zeropayer')) return 'Payer address cannot be zero.'
  if (msg.includes('duplicatepayer')) return 'Duplicate payer addresses found.'
  if (msg.includes('zeroshare')) return 'Share amount must be greater than zero.'
  if (msg.includes('insufficient funds')) return 'Insufficient balance to pay gas.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check your inputs.'
  return 'Something went wrong. Please try again.'
}

interface CreateBillProps {
  onBillCreated: (billId: bigint) => void
}

export default function CreateBill({ onBillCreated }: CreateBillProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const [receiptError, setReceiptError] = useState('')
  const submitted = useRef<CreateBillSubmission | null>(null)
  const handled = useRef<string | null>(null)
  const { isLoading: isConfirming, isSuccess, data: receipt, error: waitError } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: ARC_TESTNET_CHAIN_ID,
    onReplaced(replacement) {
      const request = submitted.current
      if (!request) return
      const next = applyCreationReplacement(request, {
        reason: replacement.reason,
        replacedHash: replacement.replacedTransaction.hash,
        minedHash: replacement.transactionReceipt.transactionHash,
      })
      if (next === request) return // A callback from a previous request.
      submitted.current = next
      if (next.invalidated) {
        setReceiptError(next.invalidated === 'cancelled'
          ? 'Transaction cancelled in your wallet. No bill was created by this request.'
          : 'Transaction was replaced. Check your wallet before trying again.')
      }
    },
  })

  const [title, setTitle] = useState('')
  const [recipient, setRecipient] = useState('')
  const [payers, setPayers] = useState<string[]>(['', ''])
  const [share, setShare] = useState('')
  const [validationError, setValidationError] = useState('')

  const isWrongChain = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const isContractDeployed = SPLIT_RECEIPT_ADDRESS.length > 2

  const addPayer = () => {
    if (payers.length < 5) setPayers(p => [...p, ''])
  }

  const removePayer = (i: number) => {
    if (payers.length > 2) setPayers(p => p.filter((_, idx) => idx !== i))
  }

  const updatePayer = (i: number, val: string) => {
    setPayers(p => p.map((a, idx) => idx === i ? val.trim() : a))
  }

  const validate = useCallback((): boolean => {
    setValidationError('')
    if (!title.trim()) { setValidationError('Title is required.'); return false }
    if (new TextEncoder().encode(title.trim()).length > 80) { setValidationError('Title exceeds 80 UTF-8 bytes.'); return false }
    if (!recipient.match(/^0x[0-9a-fA-F]{40}$/)) { setValidationError('Enter a valid recipient address.'); return false }
    if (/^0x0{40}$/i.test(recipient)) { setValidationError('Recipient address cannot be zero.'); return false }
    for (const p of payers) {
      if (!p.match(/^0x[0-9a-fA-F]{40}$/)) { setValidationError('All payer addresses must be valid 0x… addresses.'); return false }
      if (/^0x0{40}$/i.test(p)) { setValidationError('Payer addresses cannot be zero.'); return false }
    }
    const unique = new Set(payers.map(p => p.toLowerCase()))
    if (unique.size !== payers.length) { setValidationError('Duplicate payer addresses.'); return false }
    const shareErr = validateUsdcInput(share)
    if (shareErr) { setValidationError(shareErr); return false }
    return true
  }, [title, recipient, payers, share])

  const handleCreate = () => {
    if (!isConnected || !address || chainId !== ARC_TESTNET_CHAIN_ID || isPending || isConfirming) return
    if (!validate()) return
    reset()
    setReceiptError('')
    handled.current = null
    let shareWei: bigint
    try {
      shareWei = parseUsdcToNative(share)
    } catch (e) {
      setValidationError((e as Error).message)
      return
    }
    const request: CreateBillSubmission = {
      chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS,
      creator: address.toLowerCase(),
      title: title.trim(), recipient: recipient.toLowerCase(), payers: payers.map(p => p.toLowerCase()), share: shareWei }
    submitted.current = request
    writeContract({
      address: SPLIT_RECEIPT_ADDRESS,
      abi: SPLIT_RECEIPT_ABI,
      functionName: 'createBill',
      args: [title.trim(), recipient as `0x${string}`, payers as `0x${string}`[], shareWei],
      chainId: ARC_TESTNET_CHAIN_ID,
    }, { onSuccess(hash) { request.hash = hash }, onError() { if (submitted.current === request) submitted.current = null } })
  }

  // Extract the billId from the BillCreated event log once the receipt arrives
  useEffect(() => {
    const request = submitted.current
    if (!isSuccess || !receipt || !request?.hash || handled.current === receipt.transactionHash) return
    const decodedLogs: BillCreatedLog[] = []
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== request.contract.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({
          abi: SPLIT_RECEIPT_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'BillCreated',
        })
        decodedLogs.push({ address: log.address, args: decoded.args })
      } catch {
        // not our log
      }
    }
    const result = confirmBillCreation(request, {
      status: receipt.status, transactionHash: receipt.transactionHash, logs: decodedLogs,
    }, { receiptChainId: ARC_TESTNET_CHAIN_ID, connectedAddress: address, connectedChainId: chainId })
    if (result.kind === 'stale') return
    if (result.kind === 'confirmed') {
      handled.current = result.transactionHash
      setReceiptError('')
      onBillCreated(result.billId)
      return
    }
    const messages = {
      reverted: 'Transaction reverted. No bill was created.',
      cancelled: 'Transaction cancelled in your wallet. No bill was created by this request.',
      replaced: 'Transaction was replaced. Check your wallet before trying again.',
      'wrong-wallet': 'This request belongs to your previous wallet. Reconnect that wallet to finish checking its bill.',
      'wrong-chain': 'Switch back to Arc Testnet to finish checking this bill.',
      'missing-event': 'The mined receipt did not contain the expected bill event.',
      'ambiguous-event': 'The receipt contains more than one matching bill. Inspect it on the explorer before trying again.',
    }
    setReceiptError(messages[result.kind])
  }, [isSuccess, receipt, address, chainId, onBillCreated])

  const txUrl = (receipt?.transactionHash || txHash) ? `${chain.explorerBase}/tx/${receipt?.transactionHash || txHash}` : null

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="display text-3xl font-700 tracking-tight mb-1" style={{ color: 'var(--ink)' }}>
          SplitReceipt
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Split a shared expense on Arc — no reconciliation needed.
        </p>
      </div>

      {/* Connect wallet */}
      {!isConnected && (
        <div
          className="rounded-2xl p-5 mb-6 border"
          style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm mb-4" style={{ color: 'var(--ink-2)' }}>
            Connect a wallet to create a bill.
          </p>
          <WalletButton />
        </div>
      )}

      {/* Wrong chain banner */}
      {isWrongChain && (
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-center gap-3"
          style={{ background: '#fff3cd', border: '1px solid #f0a500' }}
        >
          <AlertCircle size={16} style={{ color: '#a0700a', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: '#6b4d07' }}>
            Switch to Arc Testnet to create a bill.
          </span>
          <button
            onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
            className="ml-auto text-sm font-600 rounded-lg px-3 py-1"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Switch
          </button>
        </div>
      )}

      {/* Not deployed yet */}
      {!isContractDeployed && (
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{ background: '#fef9ec', border: '1px solid #f59e0b' }}
        >
          <p className="text-sm" style={{ color: '#78450a' }}>
            Contract not yet deployed. Deploy SplitReceipt to Arc Testnet first.
          </p>
        </div>
      )}

      {/* Form */}
      <div
        className="rounded-2xl border p-5 space-y-4"
        style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
      >
        <h2 className="display text-base font-600" style={{ color: 'var(--ink)' }}>Create a bill</h2>

        {/* Title */}
        <div>
          <label className="block text-xs font-600 mb-1.5 tracking-wide uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
            Bill title
          </label>
          <input
            type="text"
            maxLength={80}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Dinner at Nobu"
            className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none transition-colors"
            style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          />
          <div className="text-right text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            {new TextEncoder().encode(title.trim()).length}/80 UTF-8 bytes
          </div>
        </div>

        {/* Recipient */}
        <div>
          <label className="block text-xs font-600 mb-1.5 tracking-wide uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
            Recipient address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={e => setRecipient(e.target.value.trim())}
            placeholder="0x…"
            className="mono w-full rounded-xl px-3.5 py-2.5 text-xs border outline-none"
            style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          />
          {isConnected && address && (
            <button
              onClick={() => setRecipient(address)}
              className="mt-1.5 text-xs font-500"
              style={{ color: 'var(--accent-hover)' }}
            >
              Use my wallet
            </button>
          )}
        </div>

        {/* Share amount */}
        <div>
          <label className="block text-xs font-600 mb-1.5 tracking-wide uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
            Share per payer (USDC)
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={share}
              onChange={e => setShare(e.target.value)}
              placeholder="10.00"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border outline-none tabular-nums"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-600" style={{ color: 'var(--muted)' }}>USDC</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
            Up to 6 decimal places, e.g. 0.000001
          </p>
        </div>

        {/* Payers */}
        <div>
          <label className="block text-xs font-600 mb-1.5 tracking-wide uppercase" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
            Payers ({payers.length}/5)
          </label>
          <div className="space-y-2">
            {payers.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={p}
                  onChange={e => updatePayer(i, e.target.value)}
                  placeholder={`Payer ${i + 1} — 0x…`}
                  className="mono flex-1 rounded-xl px-3.5 py-2.5 text-xs border outline-none"
                  style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
                />
                {payers.length > 2 && (
                  <button
                    onClick={() => removePayer(i)}
                    className="p-2 rounded-lg"
                    style={{ color: 'var(--danger)' }}
                    aria-label="Remove payer"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {payers.length < 5 && (
            <button
              onClick={addPayer}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-600"
              style={{ color: 'var(--accent-hover)' }}
            >
              <PlusCircle size={14} />
              Add payer
            </button>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: '#fce8ec' }}>
            <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--danger)' }}>{validationError}</span>
          </div>
        )}

        {/* Write error */}
        {writeError && (
          <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: '#fce8ec' }}>
            <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--danger)' }}>{parseOnchainError(writeError)}</span>
          </div>
        )}

        {/* Pending / success */}
        {(isPending || isConfirming) && (
          <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: 'var(--surface-muted)' }}>
            <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
              {isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'}
            </span>
          </div>
        )}

        {(receiptError || waitError) && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
          {receiptError || parseOnchainError(waitError)}
        </p>}

        {isSuccess && receipt?.status === 'success' && handled.current === receipt.transactionHash && txUrl && (
          <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: '#edf7f1' }}>
            <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: '#155f39' }}>Bill created!</span>
            <a href={txUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs font-600" style={{ color: 'var(--success)' }}>
              Explorer <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={isWrongChain
            ? () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
            : handleCreate}
          disabled={!isConnected || isPending || isConfirming || !isContractDeployed}
          className="w-full rounded-xl py-3 text-sm font-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {!isConnected
            ? 'Connect wallet to continue'
            : isWrongChain
            ? 'Switch to Arc Testnet'
            : isPending
            ? 'Confirm in wallet…'
            : isConfirming
            ? 'Confirming…'
            : 'Create bill'}
        </button>
      </div>

      {/* Connected wallet footer */}
      {isConnected && address && (
        <div className="mt-4 flex items-center justify-between px-1">
          <span className="mono text-xs" style={{ color: 'var(--subtle)' }}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          <WalletButton />
        </div>
      )}
    </div>
  )
}
