import { useState, useRef, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { decodeEventLog } from 'viem'
import { ExternalLink, CheckCircle, AlertCircle, Plus, Trash2, Info, Shield } from 'lucide-react'
import { SPLIT_RECEIPT_ABI } from '../splitReceiptContract'
import { activeNetwork } from '../activeNetwork'
import { getWriteBlockReason } from '../networkContext'
import { transactionFeeFields } from '../mainnetDeployment'
import { useDeploymentReadiness } from '../useDeploymentReadiness'
import { useActionScope } from '../useActionScope'
import { checkScopedWrite } from '../actionScope'
import { checkExplicitWalletWrite, walletSnapshotMatchesDisplay } from '../walletSelection'
import { creationMayRetry } from '../creationRetry'
import { parseUsdcToNative, fmtNativeUsdc, validateUsdcInput } from '../usdcFormat'
import { applyCreationReplacement, confirmBillCreation, type BillCreatedLog, type CreateBillSubmission } from '../createBillReceipt'
import { networkSwitchErrorMessage, useExplicitWalletSelection } from '../wallet-ui'

const chain = activeNetwork

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
  const { address, chainId, isConnected, connector } = useAccount()
  const readiness = useDeploymentReadiness()
  const actionScope = useActionScope(chainId, address, connector?.uid)
  const walletSelection = useExplicitWalletSelection()
  const explicitlySelected = walletSelection.isSelected()
  const [checkingWrite, setCheckingWrite] = useState(false)
  const writeLock = useRef(false)
  const requestScope = useRef<ReturnType<typeof actionScope.capture> | null>(null)
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const [receiptError, setReceiptError] = useState('')
  const submitted = useRef<CreateBillSubmission | null>(null)
  const handled = useRef<string | null>(null)

  const { isLoading: isConfirming, isSuccess, data: receipt, error: waitError } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: submitted.current?.chainId ?? activeNetwork.chainId,
    onReplaced(replacement) {
      const request = submitted.current
      if (!request || !requestScope.current || !actionScope.isCurrent(requestScope.current)) return
      const next = applyCreationReplacement(request, {
        reason: replacement.reason,
        replacedHash: replacement.replacedTransaction.hash,
        minedHash: replacement.transactionReceipt.transactionHash,
      })
      if (next === request) return
      submitted.current = next
      if (next.invalidated) {
        if (creationMayRetry(next.invalidated)) writeLock.current = false
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

  const isWrongChain = isConnected && chainId !== activeNetwork.chainId
  const isContractDeployed = readiness.check.status === 'ready'
  const writeBlockReason = getWriteBlockReason(activeNetwork, readiness.check, chainId, address)

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

  const handleCreate = async () => {
    if (!isConnected || !address || chainId !== activeNetwork.chainId || isPending || isConfirming || checkingWrite || writeLock.current || !activeNetwork.contract) return
    const walletSnapshot = walletSelection.capture()
    if (!walletSnapshot || !walletSnapshotMatchesDisplay(walletSnapshot, { account: address, chainId, connectorUid: connector?.uid })) {
      setValidationError('The displayed wallet changed. Review and confirm the wallet in the wallet menu before creating a bill.'); return
    }
    if (!validate()) return
    writeLock.current = true
    setCheckingWrite(true)
    const walletGate = await checkExplicitWalletWrite(walletSelection, walletSnapshot,
      () => checkScopedWrite(activeNetwork, actionScope, readiness.recheck, walletSnapshot.chainId, walletSnapshot.account))
    setCheckingWrite(false)
    const verified = walletGate.verification
    if (walletGate.blocked || !verified || !walletSelection.isCurrent(walletSnapshot) || !actionScope.isCurrent(verified.snapshot)) {
      writeLock.current = false; setValidationError(walletGate.blocked ?? 'Select and confirm your wallet before creating a bill.'); return
    }
    requestScope.current = verified.snapshot
    reset()
    setReceiptError('')
    handled.current = null
    let shareWei: bigint
    try { shareWei = parseUsdcToNative(share) } catch (e) { writeLock.current = false; setValidationError((e as Error).message); return }
    const request: CreateBillSubmission = {
      chainId: activeNetwork.chainId, contract: activeNetwork.contract!,
      creator: walletSnapshot.account.toLowerCase(),
      title: title.trim(), recipient: recipient.toLowerCase(),
      payers: payers.map(p => p.toLowerCase()), share: shareWei,
    }
    submitted.current = request
    writeContract({
      address: activeNetwork.contract!,
      abi: SPLIT_RECEIPT_ABI,
      functionName: 'createBill',
      connector: walletSnapshot.connector, account: walletSnapshot.account,
      args: [title.trim(), recipient as `0x${string}`, payers as `0x${string}`[], shareWei],
      chainId: activeNetwork.chainId, ...transactionFeeFields(activeNetwork),
    }, { onSuccess(hash) { request.hash = hash }, onError() { writeLock.current = false; if (submitted.current === request) submitted.current = null } })
  }

  // Extract the billId from the BillCreated event log once the receipt arrives
  useEffect(() => {
    const request = submitted.current
    if (!isSuccess || !receipt || !request?.hash || handled.current === receipt.transactionHash ||
      !requestScope.current || !actionScope.isCurrent(requestScope.current)) return
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
      { receiptChainId: activeNetwork.chainId, connectedAddress: address, connectedChainId: chainId })
    if (result.kind === 'stale') return
    if (creationMayRetry(result.kind)) writeLock.current = false
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
      'wrong-chain': `Switch back to ${activeNetwork.name} to finish checking this bill.`,
      'missing-event': 'The successful receipt did not contain the expected bill event. Inspect the transaction on the explorer before creating another bill.',
      'ambiguous-event': 'The receipt contains more than one matching bill. Inspect it on the explorer before trying again.',
    }
    setReceiptError(messages[result.kind] ?? 'Unknown error.')
  }, [isSuccess, receipt, address, chainId, onBillCreated])

  useEffect(() => {
    if (waitError) {
      writeLock.current = false
      setReceiptError('Receipt lookup failed. Inspect the existing transaction on the explorer before retrying.')
    }
  }, [waitError])

  const txUrl = (receipt?.transactionHash || txHash)
    ? `${chain.explorerBase}/tx/${receipt?.transactionHash || txHash}`
    : null

  const titleBytes = new TextEncoder().encode(title.trim()).length
  const isBusy = isPending || isConfirming || checkingWrite

  /* ── JSX ───────────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="sr-heading-xl mb-1" style={{ color: 'var(--ink)' }}>Create a shared bill</h1>
        <p className="sr-small" style={{ color: 'var(--subdued)' }}>
          Assign equal shares, add payers, and get a shareable receipt link.
        </p>
      </div>

      {isConnected && !explicitlySelected && (
        <div className="alert-warn mb-6" role="alert"><AlertCircle size={15} aria-hidden="true" />
          <span>Confirm the wallet you intend to use in the wallet menu before creating a bill.</span>
        </div>
      )}

      {/* Deployment is checked against the selected chain and reviewed bytecode. */}
      {!isContractDeployed && (
        <div className="alert-warn mb-6" role="alert">
          <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{readiness.check.reason ?? 'Checking the selected network deployment…'}</span>
        </div>
      )}

      {/* ── 60/40 layout — single column <1024px, two-column ≥1024px ──── */}
      <div className="layout-create">
        {/* ── Editor ──────────────────────────────────────────────────── */}
        <div className="doc-surface p-6 space-y-6 min-w-0">

            {/* Wrong chain */}
            {isWrongChain && (
              <div className="alert-warn" role="alert">
                <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span className="flex-1 sr-small">Switch to {activeNetwork.name} to create a bill.</span>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ minHeight: '36px', padding: '4px 12px', fontSize: '13px' }}
                  onClick={() => switchChain({ chainId: activeNetwork.chainId })}
                  disabled={isSwitching}
                  aria-busy={isSwitching}
                >
                  {isSwitching ? 'Switching…' : 'Switch'}
                </button>
              </div>
            )}
            {isWrongChain && switchError && (
              <p role="alert" className="sr-small" style={{ color: 'var(--danger)' }}>
                {networkSwitchErrorMessage(switchError)}
              </p>
            )}

            {/* Section: Bill details */}
            <fieldset className="space-y-5" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend
                className="sr-heading-sm mb-4 pb-3 w-full"
                style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}
              >
                Bill details
              </legend>

              {/* Bill name */}
              <div>
                <label htmlFor="bill-title" className="block sr-small font-medium mb-1.5" style={{ color: 'var(--secondary)' }}>
                  Bill name
                </label>
                <input
                  id="bill-title"
                  type="text"
                  className="sr-input"
                  placeholder="e.g. Team dinner"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  aria-describedby="title-hint"
                />
                <p
                  id="title-hint"
                  className="sr-meta mt-1 text-right"
                  style={{ color: titleBytes > 72 ? 'var(--danger)' : 'var(--placeholder)' }}
                >
                  {titleBytes}/80 bytes
                </p>
              </div>

              {/* Amount per person */}
              <div>
                <label htmlFor="share-amount" className="block sr-small font-medium mb-1.5" style={{ color: 'var(--secondary)' }}>
                  Amount per person
                </label>
                <div className="relative">
                  <input
                    id="share-amount"
                    type="text"
                    inputMode="decimal"
                    className="sr-input"
                    style={{ paddingRight: '64px' }}
                    placeholder="0.00"
                    value={share}
                    onChange={e => setShare(e.target.value)}
                    aria-describedby="share-hint"
                  />
                  <span
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 sr-small font-semibold pointer-events-none"
                    style={{ color: 'var(--subdued)' }}
                  >
                    USDC
                  </span>
                </div>
                <p id="share-hint" className="sr-meta mt-1" style={{ color: 'var(--placeholder)' }}>
                  Up to 6 decimal places. Each payer sends this amount to the recipient.
                </p>
              </div>
            </fieldset>

            <hr className="doc-rule" />

            {/* Section: Recipient */}
            <fieldset className="space-y-3" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend
                className="sr-heading-sm mb-4 pb-3 w-full"
                style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}
              >
                Recipient
              </legend>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="recipient" className="sr-small font-medium" style={{ color: 'var(--secondary)' }}>
                    Wallet address
                  </label>
                  {isConnected && address && (
                    <button
                      type="button"
                      className="sr-meta font-medium min-h-[44px] px-2"
                      style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
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
            </fieldset>

            <hr className="doc-rule" />

            {/* Section: People paying */}
            <fieldset className="space-y-3" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend
                className="sr-heading-sm pb-3 w-full mb-1"
                style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}
              >
                People paying
              </legend>
              <p className="sr-meta" style={{ color: 'var(--placeholder)' }}>
                2–5 unique wallet addresses · Equal shares
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
                        style={{ color: 'var(--danger)', flexShrink: 0, width: '44px', height: '44px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '6px' }}
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
                  className="btn-ghost mt-1"
                  style={{ width: 'auto' }}
                >
                  <Plus size={14} aria-hidden="true" />
                  Add payer
                </button>
              )}
            </fieldset>

            <hr className="doc-rule" />

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
                <span>{receiptError || parseOnchainError(waitError)} {txUrl && <a href={txUrl} target="_blank" rel="noopener noreferrer" className="underline">Inspect transaction</a>}</span>
              </div>
            )}

            {/* Pending / confirming */}
            {isBusy && (
              <div className="alert-info" aria-live="polite">
                <div className="spinner" style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                <span>{isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'}</span>
              </div>
            )}

            {/* Success */}
            {isSuccess && receipt?.status === 'success' && handled.current === receipt.transactionHash && txUrl && (
              <div className="alert-success">
                <CheckCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span className="flex-1">Bill created!</span>
                <a href={txUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 sr-small font-semibold"
                  style={{ color: 'var(--success)' }}>
                  Explorer <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            )}

            {/* CTA */}
            {!isConnected ? (
              <div className="space-y-3">
                <p className="sr-small" style={{ color: 'var(--subdued)' }}>
                  Connect a wallet using the button in the navigation to create a bill.
                </p>
                <button
                  type="button"
                  disabled
                  className="btn-primary"
                  aria-disabled="true"
                  style={{
                    background: 'transparent',
                    border: '2px dashed var(--border-strong)',
                    color: 'var(--subdued)',
                    opacity: 1,
                    cursor: 'not-allowed',
                  }}
                >
                  {activeNetwork.isTestnet || activeNetwork.mainnetWritesEnabled ? 'Connect wallet to continue' : 'Mainnet transactions disabled'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={isWrongChain ? () => switchChain({ chainId: activeNetwork.chainId }) : handleCreate}
                disabled={!explicitlySelected || isBusy || writeLock.current || isSwitching || !isContractDeployed || (!isWrongChain && Boolean(writeBlockReason)) || (!activeNetwork.isTestnet && !activeNetwork.mainnetWritesEnabled)}
                className="btn-primary"
                aria-busy={isBusy || isSwitching}
              >
                {!activeNetwork.isTestnet && !activeNetwork.mainnetWritesEnabled ? 'Mainnet transactions disabled'
                  : checkingWrite ? 'Verifying deployment…'
                  : isWrongChain ? isSwitching ? 'Switching network…' : `Switch to ${activeNetwork.name}`
                  : isPending ? 'Confirm in wallet…'
                  : isConfirming ? 'Confirming…'
                  : 'Create bill'}
              </button>
            )}

            {/* Caption row */}
            <div className="flex items-center justify-between sr-meta" style={{ color: 'var(--placeholder)' }}>
              <span>{isConnected && !isWrongChain && !isBusy ? 'Wallet confirmation required' : '\u00a0'}</span>
              <button
                type="button"
                className="font-medium"
                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={onViewDemo}
              >
                View demo receipt →
              </button>
            </div>
          </div>

        {/* ── Right: receipt preview ───────────────────────────────── */}
        <div className="create-preview">
            <div className="receipt-preview p-5" aria-live="polite" aria-label="Bill preview">
              {/* Receipt header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="sr-meta font-semibold mb-0.5" style={{ color: 'var(--subdued)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Receipt preview
                  </p>
                  <p
                    className="sr-heading-md mt-1 break-words"
                    style={{ color: title.trim() ? 'var(--ink)' : 'var(--placeholder)', maxWidth: '200px' }}
                  >
                    {title.trim() || 'Bill name'}
                  </p>
                </div>
                <span className="badge-draft">Draft</span>
              </div>

              {/* Dashed rule */}
              <hr className="doc-rule doc-rule--dashed mb-4" />

              {/* Share row */}
              <div className="flex items-center justify-between py-2.5">
                <span className="sr-small" style={{ color: 'var(--secondary)' }}>Each person pays</span>
                <span className="sr-small font-semibold sr-mono" style={{ color: 'var(--ink)' }}>
                  {preview
                    ? <>{fmtNativeUsdc(preview.share)} <span style={{ color: 'var(--subdued)' }}>USDC</span></>
                    : <span style={{ color: 'var(--placeholder)' }}>—</span>}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="sr-small" style={{ color: 'var(--secondary)' }}>Number of payers</span>
                <span className="sr-small font-semibold sr-mono" style={{ color: 'var(--ink)' }}>{payers.length}</span>
              </div>

              {/* Solid rule before total */}
              <hr className="doc-rule my-1" />

              {/* Total */}
              <div className="flex items-center justify-between pt-3 pb-1">
                <span className="sr-heading-sm" style={{ color: 'var(--ink)' }}>Total</span>
                <span className="sr-heading-md sr-mono" style={{ color: 'var(--primary)' }}>
                  {preview
                    ? <>{fmtNativeUsdc(preview.total)} <span className="sr-small font-medium" style={{ color: 'var(--subdued)' }}>USDC</span></>
                    : <span style={{ color: 'var(--placeholder)', fontWeight: 400, fontSize: '14px' }}>—</span>}
                </span>
              </div>

              {/* Recipient row */}
              {recipient.match(/^0x[0-9a-fA-F]{40}$/) && (
                <>
                  <hr className="doc-rule doc-rule--dashed mt-4 mb-3" />
                  <div className="flex items-center justify-between">
                    <span className="sr-meta" style={{ color: 'var(--subdued)' }}>Recipient</span>
                    <span className="sr-meta sr-mono" style={{ color: 'var(--ink-2)' }}>
                      {recipient.slice(0, 6)}…{recipient.slice(-4)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Security note beneath preview */}
            <div
              className="flex items-start gap-2.5 mt-4 p-3 rounded-lg sr-meta"
              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)' }}
            >
              <Shield size={13} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
              <p>Shares go directly to the recipient. No custody pool.</p>
            </div>

            <div
              className="flex items-start gap-2 mt-3 p-3 rounded-lg sr-meta"
              style={{ background: 'var(--info-bg)', color: 'var(--info-ink)', border: '1px solid var(--info-border)' }}
            >
              <Info size={13} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
              <span>{activeNetwork.isTestnet ? 'Arc Testnet only. USDC here has no real-world value.' : activeNetwork.mainnetWritesEnabled ? 'Arc Mainnet uses real USDC. Review the recipient, payers, share and network before confirming in your wallet. Gas is charged separately.' : 'Arc Mainnet uses real USDC. This deployment has not been enabled for transactions.'}</span>
            </div>
          </div>
      </div>

      {/* Footer note */}
      <p className="mt-8 text-center sr-meta" style={{ color: 'var(--placeholder)' }}>
        Explore a completed testnet bill.{' '}
        <button
          type="button"
          className="font-medium"
          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
          onClick={onViewDemo}
        >
          View demo receipt
        </button>
      </p>
    </div>
  )
}
