import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  usePublicClient,
} from 'wagmi'
import { parseAbiItem, decodeEventLog } from 'viem'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'
import {
  SPLIT_RECEIPT_ABI,
  SPLIT_RECEIPT_ADDRESS,
  SPLIT_RECEIPT_DEPLOY_BLOCK,
  ARC_TESTNET_CHAIN_ID,
} from '../splitReceiptContract'
import { requireChain } from '@/onchain-facts'
import { fmtNativeUsdc } from '../usdcFormat'
import { networkSwitchErrorMessage } from '../wallet-ui'
import {
  confirmedPaymentHash,
  historyRangeComplete,
  newReceiptHistory,
  receiptScopeKey,
  scanReceiptHistoryBatch,
  type PaymentSnapshot,
  type ReceiptHistory,
  type SharePaidLog,
} from '../receiptHistory'

const chain = requireChain(ARC_TESTNET_CHAIN_ID)

const SHARE_PAID_EVENT = parseAbiItem(
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)'
)

function fmtAddress(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}` }

function parseOnchainError(error: unknown): string {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('denied')) return 'Transaction cancelled.'
  if (msg.includes('notinapayer') || msg.includes('notapayer')) return 'Your wallet is not a listed payer.'
  if (msg.includes('alreadypaid')) return 'You have already paid your share.'
  if (msg.includes('wrongamount')) return 'Wrong payment amount.'
  if (msg.includes('invalidbillid')) return 'Bill not found.'
  if (msg.includes('forwardfailed')) return 'Forward to recipient failed.'
  if (msg.includes('insufficient funds')) return 'Insufficient balance to pay share.'
  if (msg.includes('reverted')) return 'Transaction reverted.'
  return 'Something went wrong. Please try again.'
}

interface BillDetailsProps {
  billId: bigint
  onBack: () => void
}

export default function BillDetails({ billId, onBack }: BillDetailsProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })

  const isWrongChain = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const isContractDeployed = SPLIT_RECEIPT_ADDRESS.length > 2
  const scopeKey = receiptScopeKey({ chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS, billId })

  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const [sessionReceiptHashes, setSessionReceiptHashes] = useState<
    Record<string, Record<string, `0x${string}`>>
  >({})
  const historiesRef = useRef<Record<string, ReceiptHistory>>({})
  const [histories, setHistories] = useState<Record<string, ReceiptHistory>>({})
  const [historyStatus, setHistoryStatus] = useState<Record<string, { loading: boolean; error?: string }>>({})

  // ── contract read ───────────────────────────────────────────────
  const { data: billData, isLoading, error: readError, refetch } = useReadContract({
    address: SPLIT_RECEIPT_ADDRESS,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'getBill',
    args: [billId],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: isContractDeployed },
  })

  // ── write + wait ────────────────────────────────────────────────
  const { writeContract, data: submittedTxHash, isPending, error: writeError, reset } = useWriteContract()
  const pendingPaymentRef = useRef<PaymentSnapshot | null>(null)
  const [paymentContext, setPaymentContext] = useState<PaymentSnapshot | null>(null)
  const [replacementNotice, setReplacementNotice] = useState<string | null>(null)

  const { isLoading: isConfirming, isSuccess, data: receiptData, error: confirmationError } =
    useWaitForTransactionReceipt({
      hash: submittedTxHash,
      chainId: ARC_TESTNET_CHAIN_ID,
      onReplaced: ({ reason }) => {
        setReplacementNotice(reason === 'cancelled'
          ? 'Your wallet cancelled this transaction. No payment receipt was recorded; you can try again.'
          : reason === 'repriced'
            ? 'Your wallet sped up this transaction. The receipt uses the final mined transaction.'
            : 'Your wallet replaced this transaction. A payment is confirmed only if the final transaction includes your SharePaid event.')
      },
    })

  // ── confirmed receipt effect ─────────────────────────────────────
  const confirmedForTx = useRef<`0x${string}` | null>(null)
  useEffect(() => {
    if (!isSuccess || !receiptData || confirmedForTx.current === receiptData.transactionHash) return
    const pending = pendingPaymentRef.current
    if (!pending) return
    const decodedLogs: Pick<SharePaidLog, 'address' | 'args'>[] = []
    for (const log of receiptData.logs) {
      if (log.address.toLowerCase() !== pending.contract.toLowerCase()) continue
      try {
        const decoded = decodeEventLog({ abi: SPLIT_RECEIPT_ABI, data: log.data, topics: log.topics, eventName: 'SharePaid' })
        decodedLogs.push({ address: log.address, args: decoded.args })
      } catch { /* not SharePaid */ }
    }
    const matchedHash = confirmedPaymentHash(pending, submittedTxHash, {
      status: receiptData.status, transactionHash: receiptData.transactionHash, logs: decodedLogs,
    })
    if (!matchedHash) return
    confirmedForTx.current = receiptData.transactionHash
    const paymentScopeKey = receiptScopeKey(pending)
    setSessionReceiptHashes(prev => ({
      ...prev,
      [paymentScopeKey]: { ...(prev[paymentScopeKey] ?? {}), [pending.payer]: matchedHash },
    }))
    if (paymentScopeKey === scopeKey) void refetch()
  }, [isSuccess, receiptData, submittedTxHash, refetch, scopeKey])

  // ── log query ────────────────────────────────────────────────────
  const [logsFetchToken, setLogsFetchToken] = useState(0)
  const billReadKey = billData
    ? `${billData[3]}:${billData[2].map((payer, index) => `${payer.toLowerCase()}:${billData[4][index]}`).join(',')}`
    : ''

  useEffect(() => {
    if (!isContractDeployed || !publicClient || !billData) return
    let cancelled = false
    const paidPayers = billData[2].filter((_, index) => billData[4][index])
    if (paidPayers.length === 0) return
    const fetchLogs = async () => {
      setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: true } }))
      try {
        if (publicClient.chain?.id !== ARC_TESTNET_CHAIN_ID) throw new Error('Receipt lookup requires Arc Testnet.')
        const head = await publicClient.getBlockNumber()
        if (cancelled) return
        const startingHistory = historiesRef.current[scopeKey] ?? newReceiptHistory(
          { chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS, billId },
          SPLIT_RECEIPT_DEPLOY_BLOCK
        )
        const publish = (history: ReceiptHistory) => {
          if (cancelled) return
          historiesRef.current[scopeKey] = history
          setHistories(prev => ({ ...prev, [scopeKey]: history }))
        }
        const result = await scanReceiptHistoryBatch({
          history: startingHistory, head,
          payers: billData[2], paidPayers,
          amount: billData[3],
          isCancelled: () => cancelled,
          onPage: publish,
          fetchLogs: range => publicClient.getLogs({
            address: SPLIT_RECEIPT_ADDRESS, event: SHARE_PAID_EVENT, args: { billId }, strict: true, ...range,
          }),
        })
        if (cancelled) return
        publish(result.history)
        setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: false, error: result.error?.message } }))
      } catch (error) {
        if (!cancelled) setHistoryStatus(prev => ({
          ...prev, [scopeKey]: { loading: false, error: error instanceof Error ? error.message : 'RPC unavailable.' },
        }))
      }
    }
    void fetchLogs()
    return () => { cancelled = true }
  }, [billId, scopeKey, billReadKey, isContractDeployed, publicClient, logsFetchToken])

  // ── refresh ─────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    void refetch()
    setLogsFetchToken(t => t + 1)
  }, [refetch])

  const handleRetryFullHistory = useCallback(() => {
    const previous = historiesRef.current[scopeKey]
    const history = newReceiptHistory(
      { chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS, billId },
      SPLIT_RECEIPT_DEPLOY_BLOCK
    )
    history.receipts = { ...(previous?.receipts ?? {}) }
    historiesRef.current[scopeKey] = history
    setHistories(prev => ({ ...prev, [scopeKey]: history }))
    void refetch()
    setLogsFetchToken(t => t + 1)
  }, [billId, scopeKey, refetch])

  // ── copy link ───────────────────────────────────────────────────
  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('bill', billId.toString())
    setCopyError('')
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setCopyError('Could not copy. Please copy the URL from the address bar.')
        setTimeout(() => setCopyError(''), 4000)
      })
  }, [billId])

  // ── pay ─────────────────────────────────────────────────────────
  const handlePay = useCallback(() => {
    if (!billData || !address || isWrongChain || isPending || isConfirming) return
    reset()
    setReplacementNotice(null)
    const pending: PaymentSnapshot = {
      payer: address.toLowerCase(), billId,
      chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS,
      amount: billData[3],
    }
    pendingPaymentRef.current = pending
    setPaymentContext(pending)
    confirmedForTx.current = null
    const [, , , share] = billData
    writeContract({
      address: SPLIT_RECEIPT_ADDRESS, abi: SPLIT_RECEIPT_ABI,
      functionName: 'payShare', args: [billId],
      value: share, chainId: ARC_TESTNET_CHAIN_ID,
    }, { onSuccess: hash => { pending.submittedHash = hash } })
  }, [billData, billId, writeContract, reset, address, isWrongChain, isPending, isConfirming])

  // ── derived state ────────────────────────────────────────────────
  let myIndex = -1, myPaidState = false, totalPaid = 0
  let payers: readonly `0x${string}`[] = []
  let paidStates: readonly boolean[] = []
  let title = '', recipient = '' as `0x${string}`, share = 0n
  let totalAmount = '0', shareDisplay = '0'

  const history = histories[scopeKey]
  const logStatus = historyStatus[scopeKey]
  const isCurrentPayment = Boolean(
    paymentContext &&
    receiptScopeKey(paymentContext) === scopeKey &&
    paymentContext.payer === address?.toLowerCase()
  )
  const receiptHashes: Record<string, `0x${string}`> =
    { ...(history?.receipts ?? {}), ...(sessionReceiptHashes[scopeKey] ?? {}) }
  const isConfirmedPayment = Boolean(
    isSuccess && receiptData?.status === 'success' && isCurrentPayment && address &&
    receiptHashes[address.toLowerCase()] === receiptData.transactionHash
  )

  if (billData) {
    ;[title, recipient, payers, share, paidStates] = billData
    payers.forEach((p, i) => {
      if (p.toLowerCase() === address?.toLowerCase()) { myIndex = i; myPaidState = paidStates[i] }
      if (paidStates[i]) totalPaid++
    })
    totalAmount = fmtNativeUsdc(share * BigInt(payers.length))
    shareDisplay = fmtNativeUsdc(share)
  }

  const verifiedPaidCount = payers.filter((p, i) => paidStates[i] && Boolean(receiptHashes[p.toLowerCase()])).length
  const allPaidReceiptsFound = totalPaid > 0 && verifiedPaidCount === totalPaid
  const allHistorySearched = Boolean(history && historyRangeComplete(history))
  const olderBlocksRemain = Boolean(history?.scannedFrom !== null && history?.scannedFrom !== undefined && history.scannedFrom > history.floor)
  const newerBlocksRemain = Boolean(history?.scannedTo !== null && history?.lastHead !== null && history?.scannedTo !== undefined && history?.lastHead !== undefined && history.scannedTo < history.lastHead)
  const pendingTxUrl = submittedTxHash ? `${chain.explorerBase}/tx/${submittedTxHash}` : null
  const isSettled = billData && totalPaid === payers.length
  const paidPct = payers.length > 0 ? Math.round((totalPaid / payers.length) * 100) : 0

  return (
    <div>
      {/* ── Back + refresh ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack} className="btn-ghost" style={{ gap: '6px' }}>
          <ArrowLeft size={14} aria-hidden="true" />
          New bill
        </button>
        {billData && (
          <button
            type="button"
            onClick={handleRefresh}
            className="btn-ghost ml-auto"
            aria-label="Refresh bill"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="card p-10 flex flex-col items-center gap-3">
          <div className="spinner" aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading bill…</p>
        </div>
      )}

      {/* ── Read error ──────────────────────────────────────────────── */}
      {readError && !isLoading && (
        <div className="card p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} aria-hidden="true" />
          <p className="text-sm" style={{ color: 'var(--danger)' }}>
            {readError.message.includes('InvalidBillId')
              ? `Bill #${billId} does not exist.`
              : 'Could not load bill. Check your connection and try again.'}
          </p>
          <button type="button" onClick={handleRefresh} className="btn-ghost">
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {/* ── Bill content ────────────────────────────────────────────── */}
      {billData && !isLoading && !readError && (
        <div className="space-y-5">

          {/* Title + meta */}
          <div>
            <h1 className="text-2xl mb-2 break-words" style={{ color: 'var(--ink)' }}>{title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium sr-mono" style={{ color: 'var(--subtle)' }}>
                Bill #{billId.toString()}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-ghost"
                style={{ gap: '5px', padding: '4px 12px', minHeight: '44px', fontSize: '12px', borderRadius: '9999px' }}
                aria-live="polite"
                aria-label={copied ? 'Link copied' : 'Copy bill link'}
              >
                <Copy size={12} aria-hidden="true" />
                {copied ? 'Copied!' : 'Copy bill link'}
              </button>
            </div>
            {copyError && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }} role="alert">{copyError}</p>
            )}
          </div>

          {/* Stats bar */}
          <div className="card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Each pays</p>
                <p className="text-xl font-bold tabular-nums sr-mono break-all" style={{ color: 'var(--ink)' }}>
                  {shareDisplay}
                  <span className="text-sm font-medium ml-1" style={{ color: 'var(--muted)' }}>USDC</span>
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Total</p>
                <p className="text-xl font-bold tabular-nums sr-mono break-all" style={{ color: 'var(--ink)' }}>
                  {totalAmount}
                  <span className="text-sm font-medium ml-1" style={{ color: 'var(--muted)' }}>USDC</span>
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1 sm:text-right">
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{totalPaid} of {payers.length} paid</p>
                <p className="text-sm font-semibold" style={{ color: isSettled ? 'var(--success)' : 'var(--ink)' }}>
                  {paidPct}%
                </p>
              </div>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={paidPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Payment progress"
            >
              <div className="progress-bar__fill" style={{ width: `${paidPct}%` }} />
            </div>
          </div>

          {/* Settled banner */}
          {isSettled && (
            <div className="alert-success">
              <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="font-medium">Bill settled. Everyone has paid their share.</span>
            </div>
          )}

          {/* Payment receipts */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Payment receipts</h2>
              {totalPaid > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: allPaidReceiptsFound ? 'var(--success)' : 'var(--muted)' }}>
                  {allPaidReceiptsFound
                    ? <><CheckCircle2 size={13} aria-hidden="true" /> {verifiedPaidCount} of {totalPaid} payment receipts verified</>
                    : logStatus?.loading
                      ? <><div className="spinner" style={{ width: '12px', height: '12px' }} aria-hidden="true" /> Looking up receipts…</>
                      : <>{verifiedPaidCount} of {totalPaid} payment receipts verified</>
                  }
                </div>
              )}
            </div>

            {/* Payer table — desktop */}
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              <div
                className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto] gap-3 px-5 py-2 text-xs font-medium"
                style={{ color: 'var(--subtle)', borderBottom: '1px solid var(--border)' }}
              >
                <span>#</span>
                <span>Payer (wallet)</span>
                <span>Status</span>
                <span>Receipt</span>
              </div>

              {payers.map((p, i) => {
                const isMe = p.toLowerCase() === address?.toLowerCase()
                const paid = paidStates[i]
                const payerReceiptHash = receiptHashes[p.toLowerCase()]
                const payerTxUrl = paid && payerReceiptHash
                  ? `${chain.explorerBase}/tx/${payerReceiptHash}`
                  : null

                return (
                  <div key={p} className="px-5 py-3">
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[2rem_1fr_auto_auto] gap-3 items-center">
                      <span className="text-sm" style={{ color: 'var(--subtle)' }}>{i + 1}</span>
                      <div className="addr-cell flex items-center gap-2 min-w-0">
                        <a
                          href={`${chain.explorerBase}/address/${p}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sr-mono text-sm min-w-0 addr-cell"
                          style={{ color: isMe ? 'var(--accent-hover)' : 'var(--ink-2)' }}
                          title={p}
                        >
                          {fmtAddress(p)}
                        </a>
                        {isMe && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }}>
                            you
                          </span>
                        )}
                      </div>
                      <div>
                        {paid
                          ? <span className="badge-paid"><CheckCircle2 size={11} aria-hidden="true" />Paid</span>
                          : <span className="badge-unpaid">Unpaid</span>
                        }
                      </div>
                      <div className="min-w-[110px] text-right">
                        {payerTxUrl ? (
                          <a
                            href={payerTxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium"
                            style={{ color: 'var(--accent-hover)' }}
                          >
                            View receipt <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        ) : paid ? (
                          <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                            {logStatus?.loading ? 'Looking up…' : '—'}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Mobile row */}
                    <div className="sm:hidden flex items-start gap-3">
                      <div className="mt-0.5">
                        {paid
                          ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} aria-label="Paid" />
                          : <Clock size={16} style={{ color: 'var(--subtle)' }} aria-label="Unpaid" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="sr-mono text-sm break-all" style={{ color: isMe ? 'var(--accent-hover)' : 'var(--ink-2)' }}>
                            {p}
                          </span>
                          {isMe && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: 'var(--info-bg)', color: 'var(--info-ink)' }}>
                              you
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {paid
                            ? <span className="badge-paid text-xs"><CheckCircle2 size={10} aria-hidden="true" />Paid</span>
                            : <span className="badge-unpaid text-xs">Unpaid</span>
                          }
                          {payerTxUrl && (
                            <a
                              href={payerTxUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium"
                              style={{ color: 'var(--accent-hover)' }}
                            >
                              View receipt <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Recipient */}
            <div className="px-5 pt-4 pb-5 mt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Recipient</h3>
              <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
                Recipient (receives {totalAmount} USDC)
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="sr-mono text-sm break-all" style={{ color: 'var(--ink-2)' }}>{fmtAddress(recipient)}</span>
                <a
                  href={`${chain.explorerBase}/address/${recipient}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View recipient on explorer"
                  className="touch-target inline-flex items-center justify-center"
                  style={{ color: 'var(--subtle)' }}
                >
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Receipt verification details (collapsible) */}
            {totalPaid > 0 && (
              <div className="px-5 pb-4">
                <button
                  type="button"
                  className="collapsible-trigger"
                  onClick={() => setDetailsOpen(o => !o)}
                  aria-expanded={detailsOpen}
                  aria-controls="receipt-verification-details"
                >
                  <ChevronRight
                    size={14}
                    className={`collapsible-chevron${detailsOpen ? ' collapsible-chevron--open' : ''}`}
                    aria-hidden="true"
                  />
                  Receipt verification details
                </button>

                {detailsOpen && (
                  <div id="receipt-verification-details" aria-live="polite" className="space-y-2 pb-2">
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {verifiedPaidCount} of {totalPaid} paid receipt{totalPaid === 1 ? '' : 's'} verified onchain.
                      {logStatus?.loading && ' Scanning blocks…'}
                    </p>

                    {history?.scannedFrom !== null && history?.scannedFrom !== undefined && history.scannedTo !== null && (
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                        Scanned blocks {history.scannedFrom.toLocaleString()}–{history.scannedTo.toLocaleString()}.
                        {allHistorySearched
                          ? ` Full range from ${SPLIT_RECEIPT_DEPLOY_BLOCK === null ? 'genesis' : 'deployment block'} through block ${history.lastHead?.toLocaleString()} checked.`
                          : olderBlocksRemain && newerBlocksRemain ? ' Newer and older blocks remain.'
                          : newerBlocksRemain ? ' Newer blocks remain.'
                          : olderBlocksRemain ? ' Older blocks remain.' : ''}
                      </p>
                    )}

                    {logStatus?.error && (
                      <p className="text-xs" style={{ color: 'var(--danger)' }} role="alert">
                        Lookup paused — verified links are kept. {logStatus.error}
                      </p>
                    )}

                    {!logStatus?.loading && !logStatus?.error && allHistorySearched && !allPaidReceiptsFound && (
                      <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                        Some receipts were not returned by this RPC. The event index may still be catching up. Retry or check the explorer.
                      </p>
                    )}

                    {!logStatus?.loading && (!allPaidReceiptsFound || logStatus?.error) && (
                      <button
                        type="button"
                        onClick={allHistorySearched && !logStatus?.error ? handleRetryFullHistory : handleRefresh}
                        className="btn-ghost mt-1"
                        style={{ fontSize: '12px', padding: '4px 10px', minHeight: '44px' }}
                      >
                        <RefreshCw size={12} aria-hidden="true" />
                        {logStatus?.error ? 'Retry receipt lookup'
                          : allHistorySearched ? 'Retry full receipt history'
                          : 'Continue receipt history'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wrong chain — pay prompt */}
          {isWrongChain && myIndex !== -1 && !myPaidState && (
            <div className="alert-warn" role="alert">
              <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="flex-1">Switch to Arc Testnet to pay.</span>
              <button
                type="button"
                className="btn-ghost"
                style={{ minHeight: '44px', padding: '4px 12px', fontSize: '13px', flexShrink: 0 }}
                onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                disabled={isSwitching}
                aria-busy={isSwitching}
              >
                {isSwitching ? 'Switching…' : 'Switch'}
              </button>
            </div>
          )}
          {isWrongChain && myIndex !== -1 && !myPaidState && switchError && (
            <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
              {networkSwitchErrorMessage(switchError)}
            </p>
          )}

          {/* Pay CTA */}
          {isConnected && myIndex !== -1 && !myPaidState && !isWrongChain && (
            <div className="card p-5 space-y-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Your payment</h2>

              {isCurrentPayment && (writeError || confirmationError || receiptData?.status === 'reverted') && (
                <div className="alert-danger" role="alert">
                  <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    {receiptData?.status === 'reverted'
                      ? 'Transaction reverted. No payment was recorded.'
                      : parseOnchainError(writeError ?? confirmationError)}
                  </span>
                </div>
              )}

              {isCurrentPayment && replacementNotice && (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{replacementNotice}</p>
              )}

              {(isPending || isConfirming) && (
                <div className="alert-info" aria-live="polite">
                  <div className="spinner" style={{ width: '14px', height: '14px', marginTop: '1px' }} aria-hidden="true" />
                  <span className="flex-1 text-sm">
                    {isCurrentPayment
                      ? isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'
                      : `A payment from ${fmtAddress(paymentContext?.payer ?? '')} is still in progress.`}
                  </span>
                  {pendingTxUrl && (
                    <a href={pendingTxUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs shrink-0"
                      style={{ color: 'var(--accent-hover)' }}
                      aria-label="View pending transaction on explorer">
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              {isConfirmedPayment && receiptData && (
                <div className="alert-success">
                  <CheckCircle2 size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span className="flex-1 font-medium">Payment confirmed!</span>
                  <a
                    href={`${chain.explorerBase}/tx/${receiptData.transactionHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-semibold shrink-0"
                    style={{ color: 'var(--success)' }}
                  >
                    View receipt <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              )}

              {!isPending && !isConfirming && !isConfirmedPayment && (
                <button
                  type="button"
                  onClick={handlePay}
                  className="btn-primary"
                >
                  Pay {shareDisplay} USDC
                </button>
              )}
            </div>
          )}

          {/* Not connected */}
          {!isConnected && !isSettled && (
            <div className="alert-info">
              <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--info-ink)' }}>
                Connect a wallet using the button in the header to pay your share.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
