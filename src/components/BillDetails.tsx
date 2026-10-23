import { useState, useRef, useEffect, useCallback } from 'react'
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
} from '../splitReceiptContract'
import { activeNetwork } from '../activeNetwork'
import { getWriteBlockReason } from '../networkContext'
import { transactionFeeFields } from '../mainnetDeployment'
import { useDeploymentReadiness } from '../useDeploymentReadiness'
import { useActionScope } from '../useActionScope'
import { checkScopedWrite } from '../actionScope'
import { checkExplicitWalletWrite, walletSnapshotMatchesDisplay } from '../walletSelection'
import { fmtNativeUsdc } from '../usdcFormat'
import { networkSwitchErrorMessage, useExplicitWalletSelection } from '../wallet-ui'
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
import {
  assembleCandidates,
  buildShareUrl,
  loadStoredHints,
  normaliseHash,
  saveVerifiedHints,
  type HintHash,
} from '../receiptHints'
import { discoverReceiptsFromHints } from '../receiptDiscovery'

const chain = activeNetwork

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

/**
 * freshVerifiedRef context key: encodes scope + current paid-payer snapshot + scan
 * generation. Copy is only valid when the key matches the current render.
 */
function makeFreshContextKey(scopeKey: string, paidPayersLc: string[], scanToken: number): string {
  return `${scopeKey}:${[...paidPayersLc].sort().join(',')}:${scanToken}`
}

interface FreshVerified {
  contextKey: string
  receipts: Record<string, HintHash>
}

export default function BillDetails({ billId, onBack }: BillDetailsProps) {
  const { address, chainId, isConnected, connector } = useAccount()
  const readiness = useDeploymentReadiness()
  const actionScope = useActionScope(chainId, address, connector?.uid)
  const walletSelection = useExplicitWalletSelection()
  const explicitlySelected = walletSelection.isSelected()
  const [checkingWrite, setCheckingWrite] = useState(false)
  const writeLock = useRef(false)
  const paymentScope = useRef<ReturnType<typeof actionScope.capture> | null>(null)
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: activeNetwork.chainId })

  const isWrongChain = isConnected && chainId !== activeNetwork.chainId
  const isContractDeployed = readiness.check.status === 'ready'
  const writeBlockReason = getWriteBlockReason(activeNetwork, readiness.check, chainId, address)
  const scopeKey = receiptScopeKey({ chainId: activeNetwork.chainId, contract: activeNetwork.contract ?? 'unconfigured', billId })

  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Session receipts from confirmed payments this session (by scope → payer → hash).
  const [sessionReceiptHashes, setSessionReceiptHashes] = useState<
    Record<string, Record<string, `0x${string}`>>
  >({})

  // Log-scan history (resumable, paginated).
  const historiesRef = useRef<Record<string, ReceiptHistory>>({})
  const [histories, setHistories] = useState<Record<string, ReceiptHistory>>({})
  const [historyStatus, setHistoryStatus] = useState<Record<string, { loading: boolean; error?: string }>>({})

  // Hint fast-path state — only freshly verified hashes from the current run.
  const [freshHintHashes, setFreshHintHashes] = useState<Record<string, Record<string, HintHash>>>({})
  const [hintStatus, setHintStatus] = useState<Record<string, { loading: boolean; rpcError?: string }>>({})

  // Fresh verified ref: scoped by context key (scope + paid snapshot + scan generation).
  // Copy is valid ONLY when the context key matches the current render state.
  // Reset to empty before EVERY early return and at start of each run.
  const freshVerifiedRef = useRef<FreshVerified>({ contextKey: '', receipts: {} })

  // Cancellation token for the combined hint+scan effect.
  const scanCancelRef = useRef<(() => void) | null>(null)
  // Bumped on every explicit refresh to restart the combined effect.
  const [scanToken, setScanToken] = useState(0)

  // ── contract read ────────────────────────────────────────────────
  const { data: billData, isLoading, error: readError, refetch } = useReadContract({
    address: activeNetwork.contract ?? undefined,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'getBill',
    args: [billId],
    chainId: activeNetwork.chainId,
    query: { enabled: isContractDeployed },
  })

  // ── write + wait ─────────────────────────────────────────────────
  const { writeContract, data: submittedTxHash, isPending, error: writeError, reset } = useWriteContract()
  const pendingPaymentRef = useRef<PaymentSnapshot | null>(null)
  const [paymentContext, setPaymentContext] = useState<PaymentSnapshot | null>(null)
  const [replacementNotice, setReplacementNotice] = useState<string | null>(null)

  const { isLoading: isConfirming, isSuccess, data: receiptData, error: confirmationError } =
    useWaitForTransactionReceipt({
      hash: submittedTxHash,
      chainId: pendingPaymentRef.current?.chainId ?? activeNetwork.chainId,
      onReplaced: ({ reason }) => {
        if (!paymentScope.current || !actionScope.isCurrent(paymentScope.current)) return
        if (reason === 'cancelled' || reason === 'replaced') writeLock.current = false
        setReplacementNotice(reason === 'cancelled'
          ? 'Your wallet cancelled this transaction. No payment receipt was recorded; you can try again.'
          : reason === 'repriced'
            ? 'Your wallet sped up this transaction. The receipt uses the final mined transaction.'
            : 'Your wallet replaced this transaction. A payment is confirmed only if the final transaction includes your SharePaid event.')
      },
    })

  // ── confirmed receipt effect ──────────────────────────────────────
  // Protected region — do not modify logic, only UI around it may change.
  const confirmedForTx = useRef<`0x${string}` | null>(null)
  useEffect(() => {
    if (!isSuccess || !receiptData || confirmedForTx.current === receiptData.transactionHash) return
    const pending = pendingPaymentRef.current
    if (!pending || !paymentScope.current || !actionScope.isCurrent(paymentScope.current)) return
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
    writeLock.current = false
    confirmedForTx.current = receiptData.transactionHash
    const paymentScopeKey = receiptScopeKey(pending)
    // Persist confirmed hash as a candidate for future visits (hash-only, not proof).
    saveVerifiedHints(pending, [matchedHash, ...loadStoredHints(pending)])
    setSessionReceiptHashes(prev => ({
      ...prev,
      [paymentScopeKey]: { ...(prev[paymentScopeKey] ?? {}), [pending.payer]: matchedHash },
    }))
    if (paymentScopeKey === scopeKey) void refetch()
  }, [isSuccess, receiptData, submittedTxHash, refetch, scopeKey, address, chainId, actionScope])

  // ── sequenced hint → invalidation → log scan ─────────────────────
  //
  // Design invariants:
  //   1. Hint discovery runs FIRST and completes before fallback log scan starts.
  //   2. On ANY hint RPC error or conflict: set paused status and RETURN — zero
  //      fallback getLogs calls after such failure.
  //   3. Hashes in historiesRef/histories/sessionReceiptHashes that fail re-verification
  //      are removed from ALL maps before the scan reads them.
  //   4. When a previously-scanned range had an invalidated hash removed, that scope's
  //      history cursor is reset so the range is re-scannable.
  //   5. The fallback log scan's trusted "already found" set is the current-run fresh
  //      verification result only — not old history.receipts or session hashes.
  //   6. Fresh fallback scan discoveries are saved as hash-only hints for future visits.
  //   7. freshVerifiedRef is scoped to a context key and reset before every early return
  //      and at the start of each run.
  //   8. Prior RAM hashes (historiesRef + session) are included as untrusted candidates
  //      alongside catalog/storage/URL hints (≤15 total, source limits apply).
  //   9. Confirmed payment hashes from this session also become untrusted hint candidates
  //      (hash-only, without changing any pay hook arguments).
  //  10. Raw RPC error messages never reach the UI — concise retry messages only.
  //
  const billReadKey = billData
    ? `${billData[3]}:${billData[2].map((p, i) => `${p.toLowerCase()}:${billData[4][i]}`).join(',')}`
    : ''

  useEffect(() => {
    if (!isContractDeployed || !activeNetwork.contract || !publicClient || !billData) return
    if (!publicClient.chain || publicClient.chain.id !== activeNetwork.chainId) return

    const paidPayers = billData[2].filter((_, i) => billData[4][i])
    const paidPayersLc = paidPayers.map(p => p.toLowerCase())
    const scope = { chainId: activeNetwork.chainId, contract: activeNetwork.contract!, billId }
    const contextKey = makeFreshContextKey(scopeKey, paidPayersLc, scanToken)

    // Reset fresh-verified ref before any early return.
    freshVerifiedRef.current = { contextKey, receipts: {} }

    if (paidPayers.length === 0) return

    // Cancel any prior in-flight run.
    scanCancelRef.current?.()
    let cancelled = false
    scanCancelRef.current = () => { cancelled = true }

    // ── Phase 1: hint fast-path ──────────────────────────────────────
    const runHintPhase = async (): Promise<{
      fresh: Record<string, HintHash>
      invalidated: HintHash[]
      rpcError: string | null
    }> => {
      const emptyResult = { fresh: {}, invalidated: [] as HintHash[], rpcError: null }

      // Assemble candidates from all sources including prior RAM hashes (untrusted).
      // Prior RAM hashes: historiesRef + session for this scope, normalised, capped at 5.
      const priorHistory = historiesRef.current[scopeKey]
      const priorRAMHashes: HintHash[] = []
      const seenPrior = new Set<string>()
      const addPrior = (raw: string) => {
        const n = normaliseHash(raw)
        if (n && !seenPrior.has(n) && priorRAMHashes.length < 5) { seenPrior.add(n); priorRAMHashes.push(n) }
      }
      for (const h of Object.values(priorHistory?.receipts ?? {})) addPrior(h)
      for (const h of Object.values(sessionReceiptHashes[scopeKey] ?? {})) addPrior(h)
      // assembleCandidates places priorRAMHashes between catalog and storage/URL,
      // so they cannot be truncated by a full catalog and do not outrank it.
      const candidates: HintHash[] = [
        ...assembleCandidates(scope, window.location.search, priorRAMHashes),
      ]

      if (candidates.length === 0) return emptyResult
      if (cancelled) return emptyResult

      setHintStatus(prev => ({ ...prev, [scopeKey]: { loading: true } }))

      const result = await discoverReceiptsFromHints({
        client: publicClient as Parameters<typeof discoverReceiptsFromHints>[0]['client'],
        scope,
        candidates,
        paidPayers: paidPayersLc,
        amount: billData[3],
        isCancelled: () => cancelled,
        onProgress: partial => {
          if (cancelled) return
          const filtered: Record<string, HintHash> = {}
          for (const [payer, hash] of Object.entries(partial.receipts)) {
            if (paidPayersLc.includes(payer)) filtered[payer] = hash as HintHash
          }
          setFreshHintHashes(prev => ({ ...prev, [scopeKey]: filtered }))
        },
      })

      if (cancelled) return emptyResult

      // Final fresh set: only current paid payers, at most 5.
      const fresh: Record<string, HintHash> = {}
      let count = 0
      for (const [payer, hash] of Object.entries(result.receipts)) {
        if (paidPayersLc.includes(payer) && count < 5) {
          fresh[payer] = hash as HintHash
          count++
        }
      }

      setFreshHintHashes(prev => ({ ...prev, [scopeKey]: fresh }))
      setHintStatus(prev => ({
        ...prev,
        [scopeKey]: { loading: false, rpcError: result.rpcError ?? undefined },
      }))

      // Persist verified hashes on clean success for future visits.
      if (!result.rpcError && result.complete) {
        const verified = Object.values(fresh) as HintHash[]
        if (verified.length > 0) saveVerifiedHints(scope, verified)
      }

      // Update scoped freshVerifiedRef — used ONLY by handleCopyLink.
      if (!result.rpcError) {
        freshVerifiedRef.current = { contextKey, receipts: { ...fresh } }
      } else {
        // On any error/conflict: clear fresh — do not share ambiguous hashes.
        freshVerifiedRef.current = { contextKey, receipts: {} }
      }

      return { fresh, invalidated: result.invalidatedHashes, rpcError: result.rpcError }
    }

    // ── Phase 2: invalidation sweep ──────────────────────────────────
    // Removes explicitly invalidated hashes from all in-memory maps.
    // For paid payers with a fresh verified result, removes any prior mismatching hash.
    // When an invalidated hash is removed from a scanned range, resets the cursor
    // for that scope so the range is re-scannable.
    const runInvalidationSweep = (
      fresh: Record<string, HintHash>,
      invalidated: HintHash[],
    ) => {
      if (cancelled) return

      const invalidatedSet = new Set(invalidated.map(h => h.toLowerCase()))
      const freshPayers = new Set(Object.keys(fresh))
      let didInvalidateScannedHash = false

      // Purge historiesRef and histories.
      const existing = historiesRef.current[scopeKey]
      if (existing && Object.keys(existing.receipts).length > 0) {
        const cleaned: Record<string, `0x${string}`> = {}
        for (const [payer, hash] of Object.entries(existing.receipts)) {
          const hashLc = hash.toLowerCase()
          if (invalidatedSet.has(hashLc)) { didInvalidateScannedHash = true; continue }
          if (freshPayers.has(payer) && fresh[payer]?.toLowerCase() !== hashLc) { didInvalidateScannedHash = true; continue }
          cleaned[payer] = hash
        }
        if (Object.keys(cleaned).length !== Object.keys(existing.receipts).length) {
          // If a hash was removed that was discovered in a previously scanned range,
          // reset the cursor so that range is re-scannable on next scan.
          const updated: ReceiptHistory = didInvalidateScannedHash
            ? newReceiptHistory(scope, activeNetwork.deploymentBlock)
            : { ...existing, receipts: cleaned }
          if (didInvalidateScannedHash) {
            // Carry forward the remaining clean receipts into the fresh history.
            updated.receipts = cleaned
          }
          historiesRef.current[scopeKey] = updated
          setHistories(prev => ({ ...prev, [scopeKey]: updated }))
        }
      }

      // Purge sessionReceiptHashes.
      setSessionReceiptHashes(prev => {
        const scopeSession = prev[scopeKey]
        if (!scopeSession) return prev
        const cleaned: Record<string, `0x${string}`> = {}
        for (const [payer, hash] of Object.entries(scopeSession)) {
          const hashLc = hash.toLowerCase()
          if (invalidatedSet.has(hashLc)) continue
          if (freshPayers.has(payer) && fresh[payer]?.toLowerCase() !== hashLc) continue
          cleaned[payer] = hash
        }
        if (Object.keys(cleaned).length === Object.keys(scopeSession).length) return prev
        return { ...prev, [scopeKey]: cleaned }
      })
    }

    // ── Phase 3: fallback log scan ────────────────────────────────────
    // Starts only after hint phase completes with NO rpc error or conflict.
    // Prior scan outputs are kept as untrusted candidates for retry; they are never
    // trusted as already-verified. New scan hashes MUST pass the receipt+canonical
    // RPC verifier before Copy/cache/verified counts. On-page candidate retention
    // deliberately avoids losing successful-page progress when later receipt RPC pauses.
    const runLogScan = async (fresh: Record<string, HintHash>) => {
      if (cancelled) return
      const remainingPaidPayers = paidPayers.filter(p => !fresh[p.toLowerCase()])
      if (remainingPaidPayers.length === 0) {
        setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: false } }))
        return
      }
      const pause = () => {
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        freshVerifiedRef.current = { contextKey, receipts: {} }
        setFreshHintHashes(prev => ({ ...prev, [scopeKey]: {} }))
        setHistoryStatus(prev => ({ ...prev, [scopeKey]: {
          loading: false, error: 'Receipt lookup paused. Check your connection and retry.',
        } }))
      }
      const publishCandidates = (history: ReceiptHistory) => {
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        // These hashes are candidates/display links only until the verifier finishes.
        historiesRef.current[scopeKey] = history
        setHistories(prev => ({ ...prev, [scopeKey]: history }))
      }
      setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: true } }))
      try {
        const liveChainId = await publicClient.getChainId()
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        if (liveChainId !== activeNetwork.chainId) { pause(); return }
        const head = await publicClient.getBlockNumber()
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        const oldRange = historiesRef.current[scopeKey] ?? newReceiptHistory(scope, activeNetwork.deploymentBlock)
        // Crucial: preserve range progress, replace trusted receipts with fresh proof ONLY.
        const startingHistory: ReceiptHistory = { ...oldRange, receipts: { ...fresh } }
        const result = await scanReceiptHistoryBatch({
          history: startingHistory,
          head,
          payers: billData[2],
          paidPayers: remainingPaidPayers,
          amount: billData[3],
          isCancelled: () => cancelled,
          onPage: publishCandidates,
          fetchLogs: range => publicClient.getLogs({
            address: activeNetwork.contract!,
            event: SHARE_PAID_EVENT,
            args: { billId },
            strict: true,
            ...range,
          }),
        })
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        publishCandidates(result.history)
        if (result.error) { pause(); return }
        const rawHashes = Object.values(result.history.receipts)
        const candidates = rawHashes.map(normaliseHash).filter((h): h is HintHash => h !== null)
        if (candidates.length !== rawHashes.length) {
          const reopened = newReceiptHistory(scope, activeNetwork.deploymentBlock)
          reopened.receipts = { ...fresh }
          publishCandidates(reopened)
          pause()
          return
        }
        if (candidates.length === 0) {
          setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: false } }))
          return
        }
        const checked = await discoverReceiptsFromHints({
          client: publicClient as Parameters<typeof discoverReceiptsFromHints>[0]['client'],
          scope,
          candidates,
          paidPayers: paidPayersLc,
          amount: billData[3],
          isCancelled: () => cancelled,
        })
        if (cancelled || freshVerifiedRef.current.contextKey !== contextKey) return
        const confirmed: Record<string, HintHash> = {}
        for (const [payer, hash] of Object.entries(checked.receipts)) {
          if (paidPayersLc.includes(payer)) confirmed[payer] = hash as HintHash
        }
        // Purge explicit invalid/orphaned hashes even if a later RPC call failed.
        runInvalidationSweep(confirmed, checked.invalidatedHashes)
        if (checked.rpcError) { pause(); return }
        // A sweep may have rewound the range, so do not overwrite it with result.history.
        const checkedRange = historiesRef.current[scopeKey] ?? result.history
        publishCandidates({ ...checkedRange, receipts: { ...confirmed } })
        freshVerifiedRef.current = { contextKey, receipts: { ...confirmed } }
        setFreshHintHashes(prev => ({ ...prev, [scopeKey]: confirmed }))
        if (Object.keys(confirmed).length > 0) saveVerifiedHints(scope, Object.values(confirmed))
        setHistoryStatus(prev => ({ ...prev, [scopeKey]: { loading: false } }))
      } catch {
        pause()
      }
    }

    // ── Orchestrate phases sequentially ──────────────────────────────
    const run = async () => {
      const { fresh, invalidated, rpcError: hintRpcError } = await runHintPhase()
      if (cancelled) return

      // RPC is reachable if no error, OR if we got some invalidated hashes
      // (which required RPC responses). This allows the sweep to run on partial results.
      const rpcReachable = hintRpcError === null || invalidated.length > 0
      if (rpcReachable) {
        runInvalidationSweep(fresh, invalidated)
      }
      if (cancelled) return

      // CRITICAL: If hint phase had an RPC error or conflict, do NOT start the
      // fallback log scan. Set a paused status and return.
      if (hintRpcError !== null) {
        setHistoryStatus(prev => ({
          ...prev,
          [scopeKey]: { loading: false, error: 'Receipt scan paused after lookup error. Retry to continue.' },
        }))
        return
      }

      await runLogScan(fresh)
    }

    void run()

    return () => { cancelled = true }
  // billReadKey encodes share + payer paid-states; changes when a new payment confirms.
  // scanToken is bumped by handleRefresh to force a fresh run.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId, scopeKey, billReadKey, isContractDeployed, publicClient, scanToken])

  // ── refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (!isContractDeployed || !activeNetwork.contract) return
    void refetch()
    setScanToken(t => t + 1)
  }, [refetch, isContractDeployed])

  const handleRetryFullHistory = useCallback(() => {
    if (!isContractDeployed || !activeNetwork.contract) return
    const previous = historiesRef.current[scopeKey]
    const history = newReceiptHistory(
      { chainId: activeNetwork.chainId, contract: activeNetwork.contract ?? 'unconfigured', billId },
      activeNetwork.deploymentBlock
    )
    // Carry forward receipts that survived the last invalidation sweep.
    history.receipts = { ...(previous?.receipts ?? {}) }
    historiesRef.current[scopeKey] = history
    setHistories(prev => ({ ...prev, [scopeKey]: history }))
    void refetch()
    setScanToken(t => t + 1)
  }, [billId, scopeKey, refetch, isContractDeployed])

  // ── copy link ────────────────────────────────────────────────────
  // Uses ONLY freshVerifiedRef when context key matches the current render.
  // Never uses the merged receiptHashes display map.
  const handleCopyLink = useCallback(() => {
    // Compute context key synchronously from current render state.
    const paidPayersLc = billData
      ? billData[2].filter((_, i) => billData[4][i]).map(p => p.toLowerCase())
      : []
    const currentContextKey = makeFreshContextKey(scopeKey, paidPayersLc, scanToken)
    const fresh = freshVerifiedRef.current
    // Only use fresh hashes if the context key matches — prevents stale hint leakage
    // after bill navigation, wallet switch, or mid-render refresh.
    const verifiedHashes: HintHash[] = fresh.contextKey === currentContextKey
      ? (Object.entries(fresh.receipts)
          .filter(([payer]) => paidPayersLc.includes(payer))
          .map(([, hash]) => hash)
          .slice(0, 5))
      : []
    if (!isContractDeployed || !activeNetwork.contract) return
    const url = buildShareUrl(billId, verifiedHashes, activeNetwork)
    setCopyError('')
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setCopyError('Could not copy. Please copy the URL from the address bar.')
        setTimeout(() => setCopyError(''), 4000)
      })
  }, [billId, billData, scopeKey, scanToken, isContractDeployed])

  // ── pay ──────────────────────────────────────────────────────────
  // Recheck deployment and immutable wallet/page scope before opening a transaction.
  const handlePay = useCallback(async () => {
    if (!billData || !isConnected || !address || chainId !== activeNetwork.chainId || isWrongChain || isPending || isConfirming || checkingWrite || writeLock.current || !activeNetwork.contract) return
    const walletSnapshot = walletSelection.capture()
    if (!walletSnapshot || !walletSnapshotMatchesDisplay(walletSnapshot, { account: address, chainId, connectorUid: connector?.uid })) {
      setReplacementNotice('The displayed wallet changed. Review and confirm the wallet in the wallet menu before paying.'); return
    }
    const payerIndex = billData[2].findIndex(p => p.toLowerCase() === walletSnapshot.account.toLowerCase())
    if (payerIndex < 0 || billData[4][payerIndex]) return
    writeLock.current = true
    setCheckingWrite(true)
    const walletGate = await checkExplicitWalletWrite(walletSelection, walletSnapshot,
      () => checkScopedWrite(activeNetwork, actionScope, readiness.recheck, walletSnapshot.chainId, walletSnapshot.account))
    setCheckingWrite(false)
    const verified = walletGate.verification
    if (walletGate.blocked || !verified || !walletSelection.isCurrent(walletSnapshot) || !actionScope.isCurrent(verified.snapshot)) {
      writeLock.current = false; setReplacementNotice(walletGate.blocked ?? 'Select and confirm your wallet before paying.'); return
    }
    paymentScope.current = verified.snapshot
    reset()
    setReplacementNotice(null)
    const pending: PaymentSnapshot = {
      payer: walletSnapshot.account.toLowerCase(), billId,
      chainId: activeNetwork.chainId, contract: activeNetwork.contract!,
      amount: billData[3],
    }
    pendingPaymentRef.current = pending
    setPaymentContext(pending)
    confirmedForTx.current = null
    const [, , , share] = billData
    writeContract({
      address: activeNetwork.contract!, abi: SPLIT_RECEIPT_ABI,
      functionName: 'payShare', args: [billId],
      connector: walletSnapshot.connector, account: walletSnapshot.account,
      value: share, chainId: activeNetwork.chainId, ...transactionFeeFields(activeNetwork),
    }, { onSuccess: hash => { pending.submittedHash = hash }, onError: () => { writeLock.current = false } })
  }, [billData, billId, writeContract, reset, address, chainId, connector?.uid, isConnected, isWrongChain, isPending, isConfirming, checkingWrite, readiness, actionScope, walletSelection])

  useEffect(() => {
    if (confirmationError || receiptData?.status === 'reverted') writeLock.current = false
  }, [confirmationError, receiptData])

  // ── derived state ─────────────────────────────────────────────────
  let myIndex = -1, myPaidState = false, totalPaid = 0
  let payers: readonly `0x${string}`[] = []
  let paidStates: readonly boolean[] = []
  let title = '', recipient = '' as `0x${string}`, share = 0n
  let totalAmount = '0', shareDisplay = '0'

  const history = histories[scopeKey]
  const logStatus = historyStatus[scopeKey]
  const currentHintStatus = hintStatus[scopeKey]
  const currentFreshHints = freshHintHashes[scopeKey] ?? {}
  const isCurrentPayment = Boolean(
    paymentContext &&
    receiptScopeKey(paymentContext) === scopeKey &&
    paymentContext.payer === address?.toLowerCase()
  )

  // Display map: merges log-scan receipts, fresh hint receipts, session receipts.
  // Used ONLY for "View receipt" link display — NOT for copy-link URL building.
  const receiptHashes: Record<string, `0x${string}`> = {
    ...(history?.receipts ?? {}),
    ...currentFreshHints,
    ...(sessionReceiptHashes[scopeKey] ?? {}),
  }

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

  const isAnyLookupLoading = Boolean(currentHintStatus?.loading || logStatus?.loading)

  // verifiedPaidCount and allPaidReceiptsFound derive ONLY from freshVerifiedRef when
  // its context key matches the current render scope + paid snapshot + scan generation.
  // Display-only links (historiesRef/session) must NOT inflate the verified count.
  const renderContextKey = billData
    ? makeFreshContextKey(
        scopeKey,
        billData[2].filter((_, i) => billData[4][i]).map(p => p.toLowerCase()),
        scanToken,
      )
    : ''
  const freshMatchesRender = freshVerifiedRef.current.contextKey === renderContextKey
  const freshVerified = freshMatchesRender ? freshVerifiedRef.current.receipts : {}

  const verifiedPaidCount = payers.filter((p, i) =>
    paidStates[i] && Boolean(freshVerified[p.toLowerCase()])
  ).length
  const allPaidReceiptsFound = totalPaid > 0 && verifiedPaidCount === totalPaid
  const allHistorySearched = Boolean(history && historyRangeComplete(history))
  const olderBlocksRemain = Boolean(history?.scannedFrom !== null && history?.scannedFrom !== undefined && history.scannedFrom > history.floor)
  const newerBlocksRemain = Boolean(history?.scannedTo !== null && history?.lastHead !== null && history?.scannedTo !== undefined && history?.lastHead !== undefined && history.scannedTo < history.lastHead)
  const pendingTxUrl = submittedTxHash ? `${chain.explorerBase}/tx/${submittedTxHash}` : null
  const isSettled = billData && totalPaid === payers.length
  const paidPct = payers.length > 0 ? Math.round((totalPaid / payers.length) * 100) : 0

  /* ── JSX ───────────────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Toolbar row ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost"
          style={{ gap: '6px' }}
        >
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

      {isConnected && !explicitlySelected && (
        <div className="alert-warn mb-6" role="alert"><AlertCircle size={15} aria-hidden="true" />
          <span>Confirm the wallet you intend to use in the wallet menu before paying.</span>
        </div>
      )}
      {!isContractDeployed && (
        <div className="alert-warn mb-6" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{readiness.check.reason ?? 'Checking the selected network deployment…'}</span>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="doc-surface p-12 flex flex-col items-center gap-3">
          <div className="spinner" aria-hidden="true" />
          <p className="sr-small" style={{ color: 'var(--subdued)' }}>Loading bill…</p>
        </div>
      )}

      {/* ── Read error ─────────────────────────────────────────────── */}
      {readError && !isLoading && (
        <div className="doc-surface p-10 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={28} style={{ color: 'var(--danger)' }} aria-hidden="true" />
          <p className="sr-small" style={{ color: 'var(--danger)' }}>
            {readError.message.includes('InvalidBillId')
              ? `Bill #${billId} does not exist.`
              : 'Could not load bill. Check your connection and try again.'}
          </p>
          <button type="button" onClick={handleRefresh} className="btn-ghost">
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {/* ── Bill content ───────────────────────────────────────────── */}
      {isContractDeployed && billData && !isLoading && !readError && (
        <div className="layout-details">

            {/* ── LEFT: receipt document ───────────────────────────── */}
            <div className="doc-surface overflow-hidden">

              {/* Document header */}
              <div
                className="px-6 py-5"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="sr-meta font-semibold mb-1" style={{ color: 'var(--subdued)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Bill #{billId.toString()}
                    </p>
                    <h1 className="sr-heading-lg break-words" style={{ color: 'var(--ink)' }}>{title}</h1>
                  </div>
                  {isSettled && (
                    <span
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full sr-meta font-semibold"
                      style={{ background: 'var(--success-bg)', color: 'var(--success-ink)', border: '1px solid var(--success-border)' }}
                    >
                      <CheckCircle2 size={13} aria-hidden="true" /> Settled
                    </span>
                  )}
                </div>

                {/* Copy link */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="btn-ghost"
                    style={{ gap: '5px', padding: '4px 12px', minHeight: '36px', fontSize: '12px' }}
                    aria-live="polite"
                    aria-label={copied ? 'Link copied' : 'Copy bill link'}
                  >
                    <Copy size={12} aria-hidden="true" />
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                  {copyError && (
                    <p className="sr-meta" style={{ color: 'var(--danger)' }} role="alert">{copyError}</p>
                  )}
                </div>
              </div>

              {/* Totals summary */}
              <div
                className="bill-totals"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                {[
                  { label: 'Each pays', value: `${shareDisplay} USDC` },
                  { label: 'Total', value: `${totalAmount} USDC` },
                  { label: 'Paid', value: `${totalPaid} / ${payers.length}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bill-total-cell">
                    <p className="sr-meta mb-1" style={{ color: 'var(--subdued)' }}>{label}</p>
                    <p className="bill-total-value">{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div
                className="px-6 pt-4 pb-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
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
                <div className="flex items-center justify-between mt-1.5">
                  <p className="sr-meta" style={{ color: 'var(--subdued)' }}>
                    {totalPaid} of {payers.length} paid
                  </p>
                  {totalPaid > 0 && (
                    <div className="flex items-center gap-1 sr-meta" style={{ color: allPaidReceiptsFound ? 'var(--success)' : 'var(--subdued)' }}>
                      {allPaidReceiptsFound
                        ? <><CheckCircle2 size={12} aria-hidden="true" /> {verifiedPaidCount}/{totalPaid} receipts verified</>
                        : isAnyLookupLoading
                          ? <><div className="spinner" style={{ width: '11px', height: '11px' }} aria-hidden="true" /> Looking up receipts…</>
                          : <>{verifiedPaidCount}/{totalPaid} receipts verified</>
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Payer ledger header */}
              <div
                className="hidden sm:grid px-6 py-2"
                style={{
                  gridTemplateColumns: '1.5rem 1fr auto auto',
                  gap: '12px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-subtle)',
                }}
              >
                <span className="sr-meta font-semibold" style={{ color: 'var(--subdued)' }}>#</span>
                <span className="sr-meta font-semibold" style={{ color: 'var(--subdued)' }}>Payer</span>
                <span className="sr-meta font-semibold" style={{ color: 'var(--subdued)' }}>Status</span>
                <span className="sr-meta font-semibold text-right" style={{ color: 'var(--subdued)' }}>Receipt</span>
              </div>

              {/* Payer rows */}
              <div>
                {payers.map((p, i) => {
                  const isMe = p.toLowerCase() === address?.toLowerCase()
                  const paid = paidStates[i]
                  const payerLc = p.toLowerCase()
                  const payerReceiptHash = receiptHashes[payerLc]
                  const isVerifiedFresh = paid && Boolean(freshVerified[payerLc])
                  const isDisplayOnly = paid && Boolean(payerReceiptHash) && !isVerifiedFresh
                  const payerTxUrl = paid && payerReceiptHash
                    ? `${chain.explorerBase}/tx/${payerReceiptHash}`
                    : null

                  return (
                    <div
                      key={p}
                      className="px-6 py-3"
                      style={{ borderBottom: i < payers.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      {/* Desktop row */}
                      <div
                        className="hidden sm:grid items-center"
                        style={{ gridTemplateColumns: '1.5rem 1fr auto auto', gap: '12px' }}
                      >
                        <span className="sr-meta" style={{ color: 'var(--subdued)' }}>{i + 1}</span>
                        <div className="flex items-center gap-2 min-w-0 addr-cell">
                          <a
                            href={`${chain.explorerBase}/address/${p}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sr-mono sr-small min-w-0 addr-cell"
                            style={{ color: isMe ? 'var(--primary)' : 'var(--ink-2)' }}
                            title={p}
                          >
                            {fmtAddress(p)}
                          </a>
                          {isMe && (
                            <span
                              className="sr-meta font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: 'var(--success-bg)', color: 'var(--success-ink)', border: '1px solid var(--success-border)' }}
                            >
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
                        <div className="text-right" style={{ minWidth: '100px' }}>
                          {payerTxUrl ? (
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <a
                                href={payerTxUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[36px] items-center gap-1 sr-small font-medium"
                                style={{ color: 'var(--primary)' }}
                              >
                                View receipt <ExternalLink size={11} aria-hidden="true" />
                              </a>
                              {isDisplayOnly && (
                                <span className="sr-meta" style={{ color: 'var(--subdued)' }}>
                                  awaiting verification
                                </span>
                              )}
                            </div>
                          ) : paid ? (
                            <span className="sr-meta" style={{ color: 'var(--subdued)' }}>
                              {isAnyLookupLoading ? 'Looking up…' : '—'}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="sm:hidden flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {paid
                            ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} aria-label="Paid" />
                            : <Clock size={16} style={{ color: 'var(--subdued)' }} aria-label="Unpaid" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="sr-mono sr-small break-all" style={{ color: isMe ? 'var(--primary)' : 'var(--ink-2)' }}>
                              {p}
                            </span>
                            {isMe && (
                              <span
                                className="sr-meta font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: 'var(--success-bg)', color: 'var(--success-ink)', border: '1px solid var(--success-border)' }}
                              >
                                you
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {paid
                              ? <span className="badge-paid sr-meta"><CheckCircle2 size={10} aria-hidden="true" />Paid</span>
                              : <span className="badge-unpaid sr-meta">Unpaid</span>
                            }
                            {payerTxUrl && (
                              <div className="flex flex-col gap-0.5">
                                <a
                                  href={payerTxUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-[44px] items-center gap-1 sr-small font-medium"
                                  style={{ color: 'var(--primary)' }}
                                >
                                  View receipt <ExternalLink size={11} aria-hidden="true" />
                                </a>
                                {isDisplayOnly && (
                                  <span className="sr-meta" style={{ color: 'var(--subdued)' }}>
                                    awaiting verification
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Recipient row */}
              <div
                className="px-6 py-4"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-subtle)' }}
              >
                <p className="sr-meta font-semibold mb-1" style={{ color: 'var(--subdued)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Recipient
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="sr-mono sr-small break-all" style={{ color: 'var(--ink-2)' }}>{fmtAddress(recipient)}</span>
                  <a
                    href={`${chain.explorerBase}/address/${recipient}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View recipient on explorer"
                    className="touch-target inline-flex items-center justify-center"
                    style={{ color: 'var(--subdued)' }}
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <span className="sr-meta" style={{ color: 'var(--subdued)' }}>
                    Receives {totalAmount} USDC
                  </span>
                </div>
              </div>

              {/* Receipt verification details (collapsible) */}
              {totalPaid > 0 && (
                <div className="px-6 pb-4">
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
                      <p className="sr-meta" style={{ color: 'var(--subdued)' }}>
                        {verifiedPaidCount} of {totalPaid} paid receipt{totalPaid === 1 ? '' : 's'} verified onchain.
                        {logStatus?.loading && ' Scanning blocks…'}
                        {currentHintStatus?.loading && !logStatus?.loading && ' Checking known transactions…'}
                      </p>

                      {history?.scannedFrom !== null && history?.scannedFrom !== undefined && history.scannedTo !== null && (
                        <p className="sr-meta" style={{ color: 'var(--subdued)' }}>
                          Scanned blocks {history.scannedFrom.toLocaleString()}–{history.scannedTo.toLocaleString()}.
                          {allHistorySearched
                            ? ` Full range from ${activeNetwork.deploymentBlock === null ? 'genesis' : 'deployment block'} through block ${history.lastHead?.toLocaleString()} checked.`
                            : olderBlocksRemain && newerBlocksRemain ? ' Newer and older blocks remain.'
                            : newerBlocksRemain ? ' Newer blocks remain.'
                            : olderBlocksRemain ? ' Older blocks remain.' : ''}
                        </p>
                      )}

                      {currentHintStatus?.rpcError && (
                        <p className="sr-meta" style={{ color: 'var(--subdued)' }} role="alert">
                          Fast-path lookup paused — existing links kept. {currentHintStatus.rpcError}
                        </p>
                      )}

                      {logStatus?.error && (
                        <p className="sr-meta" style={{ color: 'var(--danger)' }} role="alert">
                          {logStatus.error}
                        </p>
                      )}

                      {!isAnyLookupLoading && !logStatus?.error && allHistorySearched && !allPaidReceiptsFound && (
                        <p className="sr-meta" style={{ color: 'var(--subdued)' }}>
                          Some receipts were not returned by this RPC. The event index may still be catching up. Retry or check the explorer.
                        </p>
                      )}

                      {!isAnyLookupLoading && (!allPaidReceiptsFound || logStatus?.error) && (
                        <button
                          type="button"
                          onClick={allHistorySearched && !logStatus?.error ? handleRetryFullHistory : handleRefresh}
                          className="btn-ghost mt-1"
                          style={{ fontSize: '12px', padding: '4px 10px', minHeight: '36px' }}
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

            {/* ── RIGHT: action panel ───────────────────────────────── */}
            <div className="space-y-4" style={{ position: 'sticky', top: '32px' }}>

              {/* Wrong chain */}
              {isWrongChain && myIndex !== -1 && !myPaidState && (
                <div className="alert-warn" role="alert">
                  <AlertCircle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span className="flex-1 sr-small">Switch to {activeNetwork.name} to pay.</span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ minHeight: '36px', padding: '4px 12px', fontSize: '12px', flexShrink: 0 }}
                    onClick={() => switchChain({ chainId: activeNetwork.chainId })}
                    disabled={isSwitching}
                    aria-busy={isSwitching}
                  >
                    {isSwitching ? 'Switching…' : 'Switch'}
                  </button>
                </div>
              )}
              {isWrongChain && myIndex !== -1 && !myPaidState && switchError && (
                <p role="alert" className="sr-small" style={{ color: 'var(--danger)' }}>
                  {networkSwitchErrorMessage(switchError)}
                </p>
              )}

              {/* Pay CTA */}
              {isConnected && myIndex !== -1 && !myPaidState && !isWrongChain && (
                <div className="doc-surface p-5 space-y-3">
                  <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '4px' }}>
                    <p className="sr-meta font-semibold" style={{ color: 'var(--subdued)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your payment</p>
                    <p className="sr-heading-md sr-mono mt-1" style={{ color: 'var(--ink)' }}>{shareDisplay} <span className="sr-small font-medium" style={{ color: 'var(--subdued)' }}>USDC</span></p>
                  </div>

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
                    <p className="sr-meta" style={{ color: 'var(--subdued)' }}>{replacementNotice}</p>
                  )}

                  {(isPending || isConfirming) && (
                    <div className="alert-info" aria-live="polite">
                      <div className="spinner" style={{ width: '14px', height: '14px' }} aria-hidden="true" />
                      <span className="flex-1 sr-small">
                        {isCurrentPayment
                          ? isPending ? 'Waiting for wallet confirmation…' : 'Confirming on chain…'
                          : `A payment from ${fmtAddress(paymentContext?.payer ?? '')} is still in progress.`}
                      </span>
                      {pendingTxUrl && (
                        <a href={pendingTxUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 sr-meta shrink-0"
                          style={{ color: 'var(--primary)' }}
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
                        className="flex items-center gap-1 sr-small font-semibold shrink-0"
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
                      disabled={!explicitlySelected || checkingWrite || writeLock.current || Boolean(writeBlockReason)}
                    >
                      {checkingWrite ? 'Verifying deployment…' : `Pay ${shareDisplay} USDC`}
                    </button>
                  )}
                </div>
              )}

              {/* Settled */}
              {isSettled && (
                <div className="alert-success">
                  <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span className="font-medium sr-small">Bill settled. Everyone has paid.</span>
                </div>
              )}

              {/* Not connected */}
              {!isConnected && !isSettled && (
                <div className="alert-info">
                  <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <span className="sr-small" style={{ color: 'var(--info-ink)' }}>
                    Connect a wallet to pay your share.
                  </span>
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  )
}
