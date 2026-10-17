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
import { WalletButton } from '@/wallet-ui'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'
import {
  SPLIT_RECEIPT_ABI,
  SPLIT_RECEIPT_ADDRESS,
  SPLIT_RECEIPT_DEPLOY_BLOCK,
  ARC_TESTNET_CHAIN_ID,
} from '../splitReceiptContract'
import { requireChain } from '@/onchain-facts'
import { fmtNativeUsdc } from '../usdcFormat'
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

// SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)
const SHARE_PAID_EVENT = parseAbiItem(
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)'
)

function fmtAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

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
  const { switchChain } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_CHAIN_ID })

  const isWrongChain = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const isContractDeployed = SPLIT_RECEIPT_ADDRESS.length > 2
  const scopeKey = receiptScopeKey({ chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS, billId })

  const [copied, setCopied] = useState(false)

  // Public history and this session's mined receipts are partitioned by
  // chain + contract + bill. The connected wallet never changes their owner.
  const [sessionReceiptHashes, setSessionReceiptHashes] = useState<
    Record<string, Record<string, `0x${string}`>>
  >({})
  const historiesRef = useRef<Record<string, ReceiptHistory>>({})
  const [histories, setHistories] = useState<Record<string, ReceiptHistory>>({})
  const [historyStatus, setHistoryStatus] = useState<Record<string, { loading: boolean; error?: string }>>({})

  // ── contract read ───────────────────────────────────────────────
  const {
    data: billData,
    isLoading,
    error: readError,
    refetch,
  } = useReadContract({
    address: SPLIT_RECEIPT_ADDRESS,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'getBill',
    args: [billId],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: isContractDeployed },
  })

  // ── write + wait for confirmation ───────────────────────────────
  const { writeContract, data: submittedTxHash, isPending, error: writeError, reset } = useWriteContract()

  // Capture the payer address and billId AT THE MOMENT the user submits.
  // This snapshot is immune to wallet switches or bill navigation that happen
  // while the transaction is in-flight.
  const pendingPaymentRef = useRef<PaymentSnapshot | null>(null)
  const [paymentContext, setPaymentContext] = useState<PaymentSnapshot | null>(null)
  const [replacementNotice, setReplacementNotice] = useState<string | null>(null)

  // useWaitForTransactionReceipt tracks the submitted hash to confirmed status.
  // data.transactionHash is the hash of the CONFIRMED (mined) transaction, which
  // may differ from submittedTxHash if the wallet replaced or sped-up the tx.
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receiptData,
    error: confirmationError,
  } = useWaitForTransactionReceipt({
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

  // ── effect: record CONFIRMED receipt hash ───────────────────────
  // Guards applied before writing to receiptHashes:
  //   1. receipt.status === 'success'  — rejects mined cancels/replacements
  //   2. A SharePaid log from SPLIT_RECEIPT_ADDRESS exists in receipt.logs
  //   3. The log's decoded billId matches the captured pending billId
  //   4. The log's decoded payer matches the captured pending payer
  // Using the snapshot ref (not live address/billId) so a wallet switch or
  // bill navigation during confirmation can't mis-attribute the receipt.
  const confirmedForTx = useRef<`0x${string}` | null>(null)
  useEffect(() => {
    if (!isSuccess || !receiptData || confirmedForTx.current === receiptData.transactionHash) return

    const pending = pendingPaymentRef.current
    if (!pending) return

    // Scan receipt.logs for a SharePaid event from our contract that
    // matches the captured billId and payer.
    // decodeEventLog throws on topic mismatch, so non-SharePaid logs are
    // skipped via the catch block — no manual topic comparison needed.
    const decodedLogs: Pick<SharePaidLog, 'address' | 'args'>[] = []

    for (const log of receiptData.logs) {
      // Only consider logs from our contract
      if (log.address.toLowerCase() !== pending.contract.toLowerCase()) continue

      try {
        const decoded = decodeEventLog({
          abi: SPLIT_RECEIPT_ABI,
          data: log.data,
          topics: log.topics,
          eventName: 'SharePaid',
        })
        decodedLogs.push({ address: log.address, args: decoded.args })
      } catch {
        // Not a SharePaid log or wrong shape — skip
      }
    }

    const matchedHash = confirmedPaymentHash(pending, submittedTxHash, {
      status: receiptData.status,
      transactionHash: receiptData.transactionHash,
      logs: decodedLogs,
    })
    if (!matchedHash) return

    // All guards passed — this is a genuine confirmed payment.
    confirmedForTx.current = receiptData.transactionHash
    const paymentScopeKey = receiptScopeKey(pending)
    setSessionReceiptHashes(prev => ({
      ...prev,
      [paymentScopeKey]: {
        ...(prev[paymentScopeKey] ?? {}),
        [pending.payer]: matchedHash,
      },
    }))
    // Refresh getBill so the paid flag updates.
    if (paymentScopeKey === scopeKey) void refetch()
  }, [isSuccess, receiptData, submittedTxHash, refetch, scopeKey])

  // ── log query ────────────────────────────────────────────────────
  // Each batch extends the last successful range. A browser reload starts
  // with recent blocks and can continue all the way back to deployment (or
  // genesis when the deployment block is unknown), without a time cutoff.
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
        const startingHistory = historiesRef.current[scopeKey] ?? newReceiptHistory({
          chainId: ARC_TESTNET_CHAIN_ID,
          contract: SPLIT_RECEIPT_ADDRESS,
          billId,
        }, SPLIT_RECEIPT_DEPLOY_BLOCK)
        const publish = (history: ReceiptHistory) => {
          if (cancelled) return
          historiesRef.current[scopeKey] = history
          setHistories(prev => ({ ...prev, [scopeKey]: history }))
        }
        const result = await scanReceiptHistoryBatch({
          history: startingHistory,
          head,
          payers: billData[2],
          paidPayers,
          amount: billData[3],
          isCancelled: () => cancelled,
          onPage: publish,
          fetchLogs: range => publicClient.getLogs({
            address: SPLIT_RECEIPT_ADDRESS,
            event: SHARE_PAID_EVENT,
            args: { billId },
            strict: true,
            ...range,
          }),
        })
        if (cancelled) return
        publish(result.history)
        setHistoryStatus(prev => ({
          ...prev,
          [scopeKey]: { loading: false, error: result.error?.message },
        }))
      } catch (error) {
        if (!cancelled) setHistoryStatus(prev => ({
          ...prev,
          [scopeKey]: { loading: false, error: error instanceof Error ? error.message : 'RPC unavailable.' },
        }))
      }
    }

    void fetchLogs()
    return () => { cancelled = true }
    // billReadKey tracks payer/paid/share changes without restarting for an
    // otherwise identical refetch result. Every asynchronous result is scoped.
  }, [billId, scopeKey, billReadKey, isContractDeployed, publicClient, logsFetchToken])

  // ── manual refresh ──────────────────────────────────────────────
  // Refreshes both the getBill read AND the historical log query.
  const handleRefresh = useCallback(() => {
    void refetch()
    setLogsFetchToken(t => t + 1)
  }, [refetch])

  // An RPC can return an empty result while its event index is catching up.
  // When the whole range was checked but a paid link is missing, an explicit
  // retry rechecks history while retaining every already verified receipt.
  const handleRetryFullHistory = useCallback(() => {
    const previous = historiesRef.current[scopeKey]
    const history = newReceiptHistory({ chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS, billId }, SPLIT_RECEIPT_DEPLOY_BLOCK)
    history.receipts = { ...(previous?.receipts ?? {}) }
    historiesRef.current[scopeKey] = history
    setHistories(prev => ({ ...prev, [scopeKey]: history }))
    void refetch()
    setLogsFetchToken(t => t + 1)
  }, [billId, scopeKey, refetch])

  // ── copy share link ─────────────────────────────────────────────
  const handleCopyLink = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('bill', billId.toString())
    void navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [billId])

  // ── pay ─────────────────────────────────────────────────────────
  const handlePay = useCallback(() => {
    if (!billData || !address || isWrongChain || isPending || isConfirming) return
    reset()
    setReplacementNotice(null)
    // Snapshot payer + billId NOW so the confirmation effect uses these
    // values even if the wallet switches or the bill changes mid-flight.
    const pending: PaymentSnapshot = {
      payer: address.toLowerCase(), billId,
      chainId: ARC_TESTNET_CHAIN_ID, contract: SPLIT_RECEIPT_ADDRESS,
      amount: billData[3],
    }
    pendingPaymentRef.current = pending
    setPaymentContext(pending)
    confirmedForTx.current = null  // allow re-confirmation for this new submission
    const [, , , share] = billData
    writeContract({
      address: SPLIT_RECEIPT_ADDRESS,
      abi: SPLIT_RECEIPT_ABI,
      functionName: 'payShare',
      args: [billId],
      value: share,
      chainId: ARC_TESTNET_CHAIN_ID,
    }, { onSuccess: hash => { pending.submittedHash = hash } })
  }, [billData, billId, writeContract, reset, address, isWrongChain, isPending, isConfirming])

  // ── derived state ───────────────────────────────────────────────
  let myIndex = -1
  let myPaidState = false
  let totalPaid = 0
  let payers: readonly `0x${string}`[] = []
  let paidStates: readonly boolean[] = []
  let title = ''
  let recipient = '' as `0x${string}`
  let share = 0n
  let totalAmount = '0'
  let shareDisplay = '0'

  const history = histories[scopeKey]
  const logStatus = historyStatus[scopeKey]
  const isCurrentPayment = Boolean(paymentContext &&
    receiptScopeKey(paymentContext) === scopeKey &&
    paymentContext.payer === address?.toLowerCase())
  // Session receipts take precedence only after a matching mined event.
  const receiptHashes: Record<string, `0x${string}`> =
    { ...(history?.receipts ?? {}), ...(sessionReceiptHashes[scopeKey] ?? {}) }

  // True only when the mined transaction was a successful payment:
  //   - waitForReceipt reports success AND receipt.status === 'success'
  //   - the confirmed hash is present in the current bill's receiptHashes
  //     under the current wallet (proves SharePaid decoded correctly for
  //     this bill/payer, per the effect guard — no ref read at render time)
  const isConfirmedPayment =
    Boolean(
      isSuccess &&
      receiptData?.status === 'success' &&
      isCurrentPayment &&
      address &&
      receiptHashes[address.toLowerCase()] === receiptData.transactionHash
    )

  if (billData) {
    ;[title, recipient, payers, share, paidStates] = billData
    payers.forEach((p, i) => {
      if (p.toLowerCase() === address?.toLowerCase()) {
        myIndex = i
        myPaidState = paidStates[i]
      }
      if (paidStates[i]) totalPaid++
    })
    const totalRaw = share * BigInt(payers.length)
    totalAmount = fmtNativeUsdc(totalRaw)
    shareDisplay = fmtNativeUsdc(share)
  }
  const verifiedPaidCount = payers.filter((payer, index) =>
    paidStates[index] && Boolean(receiptHashes[payer.toLowerCase()])).length
  const allPaidReceiptsFound = totalPaid > 0 && verifiedPaidCount === totalPaid
  const allHistorySearched = Boolean(history && historyRangeComplete(history))
  const olderBlocksRemain = Boolean(history && history.scannedFrom !== null && history.scannedFrom > history.floor)
  const newerBlocksRemain = Boolean(history && history.scannedTo !== null && history.lastHead !== null && history.scannedTo < history.lastHead)

  // The "pending" explorer link uses submittedTxHash so the user can watch
  // the mempool.  The confirmed receipt link (on the payer row) uses
  // receiptData.transactionHash which may differ after a replacement.
  const pendingTxUrl = submittedTxHash
    ? `${chain.explorerBase}/tx/${submittedTxHash}`
    : null

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-500"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft size={15} />
          New bill
        </button>
        <div className="flex-1" />
        <WalletButton />
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          className="rounded-2xl border p-8 flex flex-col items-center gap-3"
          style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
        >
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--muted)' }}>Loading bill…</span>
        </div>
      )}

      {/* Read error */}
      {readError && !isLoading && (
        <div
          className="rounded-2xl border p-6 flex flex-col items-center gap-4"
          style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
        >
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
          <p className="text-sm text-center" style={{ color: 'var(--danger)' }}>
            {readError.message.includes('InvalidBillId')
              ? `Bill #${billId} does not exist.`
              : 'Could not load bill. Check your connection and try again.'}
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-sm font-600"
            style={{ color: 'var(--accent)' }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Bill card */}
      {billData && !isLoading && !readError && (
        <>
          {/* Summary card */}
          <div
            className="rounded-2xl border p-5 mb-4"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
          >
            {/* Title + actions */}
            <div className="flex items-start justify-between mb-1">
              <h2 className="display text-xl font-600 text-balance" style={{ color: 'var(--ink)' }}>
                {title}
              </h2>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <span
                  className="mono text-xs px-2 py-0.5 rounded-lg"
                  style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
                >
                  #{billId.toString()}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 text-xs font-500 px-2 py-0.5 rounded-lg"
                  style={{
                    background: 'var(--surface-muted)',
                    color: copied ? 'var(--success)' : 'var(--muted)',
                  }}
                  title="Copy shareable link"
                >
                  <Copy size={11} />
                  {copied ? 'Copied' : 'Share'}
                </button>
                <button
                  onClick={handleRefresh}
                  className="p-1 rounded-lg"
                  style={{ color: 'var(--subtle)' }}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Share + total */}
            <div
              className="flex gap-4 mt-3 pt-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div>
                <p
                  className="text-xs uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
                >
                  Each pays
                </p>
                <p
                  className="display text-lg font-600 tabular-nums"
                  style={{ color: 'var(--ink)' }}
                >
                  {shareDisplay}{' '}
                  <span className="text-sm font-500" style={{ color: 'var(--muted)' }}>USDC</span>
                </p>
              </div>
              <div>
                <p
                  className="text-xs uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
                >
                  Total bill
                </p>
                <p
                  className="display text-lg font-600 tabular-nums"
                  style={{ color: 'var(--ink)' }}
                >
                  {totalAmount}{' '}
                  <span className="text-sm font-500" style={{ color: 'var(--muted)' }}>USDC</span>
                </p>
              </div>
              <div className="ml-auto text-right">
                <p
                  className="text-xs uppercase tracking-wide mb-0.5"
                  style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
                >
                  Paid
                </p>
                <p
                  className="display text-lg font-600 tabular-nums"
                  style={{
                    color: totalPaid === payers.length ? 'var(--success)' : 'var(--ink)',
                  }}
                >
                  {totalPaid}/{payers.length}
                </p>
              </div>
            </div>

            {/* Recipient */}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <p
                className="text-xs uppercase tracking-wide mb-1"
                style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}
              >
                Recipient
              </p>
              <a
                href={`${chain.explorerBase}/address/${recipient}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs flex items-center gap-1 w-fit"
                style={{ color: 'var(--ink-2)' }}
              >
                {fmtAddress(recipient)}
                <ExternalLink size={10} style={{ color: 'var(--subtle)' }} />
              </a>
            </div>
          </div>

          {/* Payer rows */}
          <div
            className="rounded-2xl border divide-y divide-[var(--border)]"
            style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
          >
            {payers.map((p, i) => {
              const isMe = p.toLowerCase() === address?.toLowerCase()
              const paid = paidStates[i]
              const payerReceiptHash = receiptHashes[p.toLowerCase()]
              const payerTxUrl = payerReceiptHash
                ? `${chain.explorerBase}/tx/${payerReceiptHash}`
                : null

              return (
                <div key={p} className="flex items-center gap-3 px-4 py-3">
                  {paid
                    ? <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    : <Clock size={16} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
                  }
                  <a
                    href={`${chain.explorerBase}/address/${p}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-xs flex-1 min-w-0 truncate"
                    style={{ color: isMe ? 'var(--accent)' : 'var(--ink-2)' }}
                  >
                    {fmtAddress(p)}{isMe ? ' (you)' : ''}
                  </a>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-xs font-600 px-2 py-0.5 rounded-lg"
                      style={{
                        background: paid ? '#edf7f1' : 'var(--surface-muted)',
                        color: paid ? 'var(--success)' : 'var(--subtle)',
                      }}
                    >
                      {paid ? 'Paid' : 'Pending'}
                    </span>
                    {/* Receipt link: visible on paid rows whenever a confirmed
                        tx hash is known (from this session or from log recovery). */}
                    {paid && payerTxUrl && (
                      <a
                        href={payerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View payment on explorer"
                        style={{ color: 'var(--subtle)' }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* History batches have a cursor; an RPC failure never discards prior pages. */}
          {totalPaid > 0 && (
            <div className="text-xs mt-3 px-1 space-y-1.5" style={{ color: 'var(--subtle)' }} aria-live="polite">
              <p>
                {verifiedPaidCount} of {totalPaid} paid receipt{totalPaid === 1 ? '' : 's'} verified.
                {logStatus?.loading ? ' Looking up payment links…' : ''}
              </p>
              {history?.scannedFrom !== null && history?.scannedFrom !== undefined && history.scannedTo !== null && (
                <p>
                  Searched blocks {history.scannedFrom.toLocaleString()}–{history.scannedTo.toLocaleString()}.
                  {allHistorySearched
                    ? ` All blocks from ${SPLIT_RECEIPT_DEPLOY_BLOCK === null ? 'genesis' : 'deployment'} through ${history.lastHead?.toLocaleString()} were checked.`
                    : !allPaidReceiptsFound
                      ? olderBlocksRemain && newerBlocksRemain ? ' Newer and older blocks remain to be searched.'
                        : newerBlocksRemain ? ' Newer blocks remain to be searched.'
                          : olderBlocksRemain ? ' Older blocks remain to be searched.' : ''
                      : ''}
                </p>
              )}
              {logStatus?.error && (
                <p style={{ color: 'var(--danger)' }}>
                  Receipt lookup paused. Verified links and progress are kept. {logStatus.error}
                </p>
              )}
              {!logStatus?.loading && !logStatus?.error && allHistorySearched && !allPaidReceiptsFound && (
                <p>Some paid receipts were not returned by this RPC. Retry the full range after its event index catches up, or inspect the contract on the explorer.</p>
              )}
              {!logStatus?.loading && (!allPaidReceiptsFound || logStatus?.error) && (
                <button
                  onClick={allHistorySearched && !logStatus?.error ? handleRetryFullHistory : handleRefresh}
                  className="inline-flex items-center gap-1.5 font-600 py-1"
                  style={{ color: 'var(--accent)' }}
                >
                  <RefreshCw size={12} />
                  {logStatus?.error ? 'Retry receipt lookup' : allHistorySearched ? 'Retry full receipt history' : 'Continue receipt history'}
                </button>
              )}
            </div>
          )}

          {/* Wrong chain banner */}
          {isWrongChain && myIndex !== -1 && !myPaidState && (
            <div
              className="rounded-xl px-4 py-3 mt-4 flex items-center gap-3"
              style={{ background: '#fff3cd', border: '1px solid #e8d18f' }}
            >
              <AlertCircle size={15} style={{ color: '#a0700a', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: '#6b4d07' }}>Switch to Arc Testnet to pay.</span>
              <button
                onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                className="ml-auto text-xs font-600 rounded-lg px-3 py-1"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Switch
              </button>
            </div>
          )}

          {/* Pay CTA (only if I'm a listed, unpaid payer on the right chain) */}
          {isConnected && myIndex !== -1 && !myPaidState && !isWrongChain && (
            <div className="mt-4 space-y-3">
              {/* Write error */}
              {isCurrentPayment && (writeError || confirmationError || receiptData?.status === 'reverted') && (
                <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2" style={{ background: '#fce8ec' }}>
                  <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: 'var(--danger)' }}>
                    {receiptData?.status === 'reverted' ? 'Transaction reverted. No payment was recorded.' : parseOnchainError(writeError ?? confirmationError)}
                  </span>
                </div>
              )}
              {isCurrentPayment && replacementNotice && (
                <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>{replacementNotice}</p>
              )}

              {/* Pending / confirming status */}
              {(isPending || isConfirming) && (
                <div
                  className="rounded-xl px-3.5 py-2.5 flex items-center gap-2"
                  style={{ background: 'var(--surface-muted)' }}
                >
                  <div
                    className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
                    {isCurrentPayment
                      ? isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'
                      : `A payment from ${fmtAddress(paymentContext?.payer ?? '')} is still in progress. Wait for it before submitting another payment.`}
                  </span>
                  {pendingTxUrl && (
                    <a
                      href={pendingTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs"
                      style={{ color: 'var(--accent)' }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              )}

              {/* Confirmed payment banner — only shown when isConfirmedPayment
                  is true: receipt.status==='success' AND the SharePaid event
                  for this bill/payer was decoded and stored in receiptHashes.
                  A mined cancel/replacement that lacks a matching SharePaid
                  will not set isConfirmedPayment and falls through to the
                  Pay button so the user can retry. */}
              {isConfirmedPayment && receiptData && (
                <div
                  className="rounded-xl px-3.5 py-2.5 flex items-center gap-2"
                  style={{ background: '#edf7f1' }}
                >
                  <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span className="text-xs" style={{ color: '#155f39' }}>Payment confirmed!</span>
                  <a
                    href={`${chain.explorerBase}/tx/${receiptData.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-xs font-600"
                    style={{ color: 'var(--success)' }}
                  >
                    Explorer <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {/* Pay button: shown when not in-flight and not a confirmed payment.
                  !isConfirmedPayment (not !isSuccess) means a mined cancel
                  restores the button so the user can retry. */}
              {!isPending && !isConfirming && !isConfirmedPayment && (
                <button
                  onClick={handlePay}
                  className="w-full rounded-xl py-3 text-sm font-600 transition-colors"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Pay {shareDisplay} USDC
                </button>
              )}
            </div>
          )}

          {/* Not connected prompt */}
          {!isConnected && totalPaid < payers.length && (
            <div
              className="rounded-xl px-4 py-3 mt-4 flex items-center gap-3"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-strong)' }}
            >
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Connect a wallet to pay your share.</span>
            </div>
          )}
          {totalPaid === payers.length && (
            <div
              className="rounded-xl px-4 py-3 mt-4 flex items-center gap-2"
              style={{ background: '#edf7f1', border: '1px solid #cce5d5' }}
            >
              <CheckCircle2 size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: '#155f39' }}>Bill settled. Everyone has paid their share.</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
