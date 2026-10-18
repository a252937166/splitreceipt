import { useState, useCallback, useEffect, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { decodeEventLog } from 'viem'
import { ExternalLink, CheckCircle, AlertCircle, Plus, Trash2, Info, Shield } from 'lucide-react'
import { SPLIT_RECEIPT_ABI, SPLIT_RECEIPT_ADDRESS, ARC_TESTNET_CHAIN_ID } from '../splitReceiptContract'
import { requireChain } from '@/onchain-facts'
import { parseUsdcToNative, fmtNativeUsdc, validateUsdcInput } from '../usdcFormat'
import { applyCreationReplacement, confirmBillCreation, type BillCreatedLog, type CreateBillSubmission } from '../createBillReceipt'
import { networkSwitchErrorMessage } from '../wallet-ui'

const chain = requireChain(ARC_TESTNET_CHAIN_ID)

function parseOnchainError(error: unknown): string {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('denied')) return 'Transaction cancelled.'
  if (msg.includes('titletoolong')) return 'Title exceeds 80 UTF-8 bytes.'
  if (msg.includes('zerorecipient')) return 'Recipient address cannot be zero.'
  if (msg.includes('invalidpayercount')) return 'Add 2 to 5 unique payer addresses.'
  if (msg.includes('zeropayer')) return 'Payer address cannot be zero.'
  if (msg.includes('duplicatepayer')) return 'Duplicate payer addresses found.'
  if (msg.includes('zeroshare')) return 'Share amount must be greater than zero.'
  if (msg.includes('insufficient funds')) return 'Insufficient balance to pay gas.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check your inputs.'
  return 'Something went wrong. Please try again.'
}

/** Derive total from share × payer count using bigint. Returns null if share is invalid/empty. */
function derivePreview(shareText: string, payerCount: number): { share: bigint; total: bigint } | null {
  if (!shareText.trim()) return null
  try {
    const shareWei = parseUsdcToNative(shareText.trim())
    if (shareWei <= 0n) return null
    return { share: shareWei, total: shareWei * BigInt(payerCount) }
  } catch {
    return null
  }
}

interface CreateBillProps {
  onBillCreated: (billId: bigint) => void
  onViewDemo: () => void
}

export default function CreateBill({ onBillCreated, onViewDemo }: CreateBillProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
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
      if (next === request) return
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

  // Derived preview (pure bigint, no floating-point)
  const preview = derivePreview(share, payers.length)

  const addPayer = () => { if (payers.length < 5) setPayers(p => [...p, '']) }
  const removePayer = (i: number) => { if (payers.length > 2) setPayers(p => p.filter((_, idx) => idx !== i)) }
  const updatePayer = (i: number, val: string) => { setPayers(p => p.map((a, idx) => idx === i ? val.trim() : a)) }

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
    try { shareWei = parseUsdcToNative(share) } catch (e) { setValidationError((e as Error).message); return }
    const request: CreateBillSubmission = {
      chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS,
      creator: address.toLowerCase(),
      title: title.trim(), recipient: recipient.toLowerCase(),
      payers: payers.map(p => p.toLowerCase()), share: shareWei,
    }
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
        const decoded = decodeEventLog({ abi: SPLIT_RECEIPT_ABI, data: log.data, topics: log.topics, eventName: 'BillCreated' })
        decodedLogs.push({ address: log.address, args: decoded.args })
      } catch { /* not our log */ }
    }
    const result = confirmBillCreation(request,
      { status: receipt.status, transactionHash: receipt.transactionHash, logs: decodedLogs },
      { receiptChainId: ARC_TESTNET_CHAIN_ID, connectedAddress: address, connectedChainId: chainId })
    if (result.kind === 'stale') return
    if (result.kind === 'confirmed') {
      handled.current = result.transactionHash
      setReceiptError('')
      onBillCreated(result.billId)
      return
    }
    const messages: Record<string, string> = {
      reverted: 'Transaction reverted. No bill was created.',
      cancelled: 'Transaction cancelled in your wallet. No bill was created by this request.',
      replaced: 'Transaction was replaced. Check your wallet before trying again.',
      'wrong-wallet': 'This request belongs to your previous wallet. Reconnect that wallet to finish checking its bill.',
      'wrong-chain': 'Switch back to Arc Testnet to finish checking this bill.',
      'missing-event': 'The mined receipt did not contain the expected bill event.',
      'ambiguous-event': 'The receipt contains more than one matching bill. Inspect it on the explorer before trying again.',
    }
    setReceiptError(messages[result.kind] ?? 'Unknown error.')
  }, [isSuccess, receipt, address, chainId, onBillCreated])

  const txUrl = (receipt?.transactionHash || txHash)
    ? `${chain.explorerBase}/tx/${receipt?.transactionHash || txHash}`
    : null

  const titleBytes = new TextEncoder().encode(title.trim()).length
  const isBusy = isPending || isConfirming

  return (
    <div>
      {/* ── Page heading ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl mb-1" style={{ color: 'var(--ink)' }}>Create a shared bill</h1>
        <p style={{ color: 'var(--muted)', fontSize: '15px' }}>Set equal shares. Send one link. Check every payment.</p>
      </div>

      {/* ── Not deployed banner ──────────────────────────────────────── */}
      {!isContractDeployed && (
        <div className="alert-warn mb-6" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>Contract not yet deployed. Deploy SplitReceipt to Arc Testnet first.</span>
        </div>
      )}

      {/* ── 2-column layout ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

        {/* ── Left: form ───────────────────────────────────────────────── */}
        <div className="card p-6 space-y-5">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ink-2)' }}>Bill details</h2>

          {/* Wrong chain */}
          {isWrongChain && (
            <div className="alert-warn" role="alert">
              <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="flex-1">Switch to Arc Testnet to create a bill.</span>
              <button
                type="button"
                className="btn-ghost"
                style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px', borderRadius: '9999px' }}
                onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                disabled={isSwitching}
                aria-busy={isSwitching}
              >
                {isSwitching ? 'Switching…' : 'Switch'}
              </button>
            </div>
          )}
          {isWrongChain && switchError && (
            <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
              {networkSwitchErrorMessage(switchError)}
            </p>
          )}

          {/* Bill name */}
          <div>
            <label htmlFor="bill-title" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Bill name
            </label>
            <input
              id="bill-title"
              type="text"
              className="sr-input"
              placeholder="Team dinner"
              value={title}
              onChange={e => setTitle(e.target.value)}
              aria-describedby="title-hint"
            />
            <p id="title-hint" className="text-xs mt-1 text-right" style={{ color: titleBytes > 72 ? 'var(--danger)' : 'var(--subtle)' }}>
              {titleBytes}/80 UTF-8 bytes
            </p>
          </div>

          {/* Recipient */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="recipient" className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                Recipient wallet
              </label>
              {isConnected && address && (
                <button
                  type="button"
                  className="text-xs font-medium min-h-[44px] px-2"
                  style={{ color: 'var(--accent-hover)' }}
                  onClick={() => setRecipient(address)}
                >
                  Use my wallet
                </button>
              )}
            </div>
            <input
              id="recipient"
              type="text"
              className="sr-input sr-mono"
              style={{ fontSize: '13px' }}
              placeholder="0x…"
              value={recipient}
              onChange={e => setRecipient(e.target.value.trim())}
              aria-describedby="recipient-hint"
            />
            <p id="recipient-hint" className="sr-only">
              The Ethereum address that will receive all payments immediately.
            </p>
          </div>

          {/* Amount per person */}
          <div>
            <label htmlFor="share-amount" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Amount per person
            </label>
            <div className="relative">
              <input
                id="share-amount"
                type="text"
                inputMode="decimal"
                className="sr-input"
                style={{ paddingRight: '60px' }}
                placeholder="0.00"
                value={share}
                onChange={e => setShare(e.target.value)}
                aria-describedby="share-hint"
              />
              <span
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold pointer-events-none"
                style={{ color: 'var(--subtle)' }}
              >
                USDC
              </span>
            </div>
            <p id="share-hint" className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
              Up to 6 decimal places. Each payer sends this amount directly to the recipient.
            </p>
          </div>

          {/* People paying */}
          <div>
            <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--muted)' }}>People paying</p>
            <p className="text-xs mb-3" style={{ color: 'var(--subtle)' }}>
              2–5 unique wallets · Equal shares
            </p>
            <div className="space-y-2">
              {payers.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="payer-badge" aria-hidden="true">{i + 1}</span>
                  <input
                    type="text"
                    id={`payer-${i}`}
                    className="sr-input sr-mono flex-1"
                    style={{ fontSize: '13px' }}
                    placeholder="0x…"
                    value={p}
                    onChange={e => updatePayer(i, e.target.value)}
                    aria-label={`Payer ${i + 1} wallet address`}
                  />
                  {payers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePayer(i)}
                      className="touch-target flex items-center justify-center"
                      style={{ color: 'var(--danger)', flexShrink: 0, width: '44px', height: '44px' }}
                      aria-label={`Remove payer ${i + 1}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {payers.length < 5 && (
              <button
                type="button"
                onClick={addPayer}
                className="btn-ghost mt-3"
                style={{ width: 'auto' }}
              >
                <Plus size={14} aria-hidden="true" />
                Add payer
              </button>
            )}
          </div>

          {/* Validation / write / wait errors */}
          {validationError && (
            <div className="alert-danger" role="alert">
              <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{validationError}</span>
            </div>
          )}
          {writeError && !validationError && (
            <div className="alert-danger" role="alert">
              <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{parseOnchainError(writeError)}</span>
            </div>
          )}
          {(receiptError || waitError) && !validationError && (
            <div className="alert-danger" role="alert">
              <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{receiptError || parseOnchainError(waitError)}</span>
            </div>
          )}

          {/* Pending / confirming */}
          {isBusy && (
            <div className="alert-info" aria-live="polite">
              <div className="spinner" style={{ width: '14px', height: '14px', marginTop: '1px' }} aria-hidden="true" />
              <span>{isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'}</span>
            </div>
          )}

          {/* Success */}
          {isSuccess && receipt?.status === 'success' && handled.current === receipt.transactionHash && txUrl && (
            <div className="alert-success">
              <CheckCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="flex-1">Bill created!</span>
              <a href={txUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-semibold"
                style={{ color: 'var(--success)' }}>
                Explorer <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}

          {/* CTA */}
          {!isConnected ? (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Connect a wallet using the button in the header to create a bill.
              </p>
              <button
                type="button"
                disabled
                className="btn-primary"
                aria-disabled="true"
                style={{
                  background: 'transparent',
                  border: '2px dashed var(--border-strong)',
                  color: 'var(--subtle)',
                  opacity: 1,
                  cursor: 'not-allowed',
                }}
              >
                Connect wallet to continue
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={isWrongChain ? () => switchChain({ chainId: ARC_TESTNET_CHAIN_ID }) : handleCreate}
              disabled={isPending || isConfirming || isSwitching || !isContractDeployed}
              className="btn-primary"
              aria-busy={isBusy || isSwitching}
            >
              {isWrongChain ? isSwitching ? 'Switching network…' : 'Switch to Arc Testnet'
                : isPending ? 'Confirm in wallet…'
                : isConfirming ? 'Confirming…'
                : 'Create bill'}
            </button>
          )}

          {/* Sub-caption + demo link */}
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--subtle)' }}>
            <span>{isConnected && !isWrongChain && !isBusy ? 'Wallet confirmation required' : '\u00a0'}</span>
            <button
              type="button"
              className="font-medium"
              style={{ color: 'var(--accent-hover)' }}
              onClick={onViewDemo}
            >
              View receipts without connecting →
            </button>
          </div>
        </div>

        {/* ── Right: preview + how-it-works ────────────────────────── */}
        <div className="space-y-4">

          {/* Bill preview */}
          <div className="card-raised p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--muted)', fontFamily: 'inherit', letterSpacing: 'normal' }}>
              Bill preview
            </h2>
            <dl className="space-y-3" aria-live="polite">
              <div className="flex items-center justify-between">
                <dt className="text-sm" style={{ color: 'var(--muted)' }}>People</dt>
                <dd className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {payers.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm" style={{ color: 'var(--muted)' }}>Each pays</dt>
                <dd className="text-sm font-semibold tabular-nums sr-mono text-right break-all" style={{ color: 'var(--ink)' }}>
                  {preview ? `${fmtNativeUsdc(preview.share)} USDC` : <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>—</span>}
                </dd>
              </div>
              <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <dt className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Total to recipient</dt>
                <dd className="text-base font-bold tabular-nums sr-mono text-right break-all" style={{ color: 'var(--ink)' }}>
                  {preview ? `${fmtNativeUsdc(preview.total)} USDC` : <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>—</span>}
                </dd>
              </div>
            </dl>
          </div>

          {/* How it works */}
          <div className="card-raised p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--muted)', fontFamily: 'inherit', letterSpacing: 'normal' }}>
              How it works
            </h2>
            <ol className="space-y-4" aria-label="Steps">
              {[
                { label: 'Create bill', desc: 'Add a name, amount, recipient and the people paying.' },
                { label: 'Share link', desc: 'Send the generated link to your teammates.' },
                { label: 'Verify payments', desc: 'Each person pays their equal share in USDC. Payments are verifiable onchain.' },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="step-circle mt-0.5" aria-hidden="true">{i + 1}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{step.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div
              className="mt-5 flex items-start gap-3 rounded-xl p-3"
              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)' }}
            >
              <Shield size={15} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>Shares go directly to the recipient.</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--success)', opacity: 0.85 }}>
                  Each person sends their share in USDC to the recipient wallet.
                </p>
              </div>
            </div>
          </div>

          {/* Testnet note */}
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
            style={{ background: 'var(--info-bg)', color: 'var(--info-ink)', border: '1px solid var(--info-border)' }}
          >
            <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
            <span>Arc Testnet only. USDC here has no real-world value.</span>
          </div>
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <p className="mt-6 text-center text-xs" style={{ color: 'var(--subtle)' }}>
        Explore a completed testnet bill.{' '}
        <button
          type="button"
          className="font-medium"
          style={{ color: 'var(--accent-hover)' }}
          onClick={onViewDemo}
        >
          View receipts without connecting
        </button>
      </p>
    </div>
  )
}
