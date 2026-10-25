import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { PublicClient } from 'viem'
import { ReceiptsController, startReceiptRead, type ReceiptStatus } from '../receiptController'
import { assembleCandidates, saveVerifiedHints, type HintHash } from '../receiptHints'
import type { ReceiptScope } from '../receiptHistory'
import type { PageContext } from '../networks'
import type { EpochSources } from '../epoch'
import { useReadActivation } from '../readActivation'
import type { BillData } from './useBillData'

export type { ReceiptStatus }

export interface ReceiptsView {
  /** Proved against the CURRENT bill snapshot (payer lowercase to final canonical hash). Only these are "verified". */
  receipts: Record<string, HintHash>
  /** Kept from an earlier snapshot of this bill and awaiting re-verification. Never shown as verified. */
  awaiting: Record<string, HintHash>
  status: ReceiptStatus
  message: string | null
  scanning: boolean
  historyDone: boolean
  /** Candidates waiting on a retry (for example a receipt RPC outage). Keeps the read-only retry enabled. */
  unresolved: number
  /** True when the deployment block is unknown, so history is a bounded lookback only. */
  historyBounded: boolean
  searchHistory: () => void
  /** Verifies a just-confirmed payment's final hash together with the other candidates. */
  addCandidate: (hash: HintHash) => void
}

const EMPTY: HintHash[] = []

/**
 * Thin React shell around `ReceiptsController`, which owns generations and stale-result
 * handling. A receipt is shown as verified only after the canonical block/event check AND
 * the transaction-level check, in the generation for the current bill snapshot.
 */
export function useReceipts(
  client: PublicClient | undefined,
  context: PageContext,
  billId: bigint,
  bill: BillData | null,
  epochs: EpochSources,
): ReceiptsView {
  const controller = useRef<ReceiptsController | null>(null)
  controller.current ??= new ReceiptsController()
  const ctl = controller.current
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  // Restarts the read under the current page epoch after every navigation (see readActivation.ts).
  const activation = useReadActivation()
  useEffect(() => ctl.subscribe(rerender), [ctl])

  const scope = useMemo<ReceiptScope>(
    () => ({ chainId: context.network.chainId, contract: context.deployment.address, billId }),
    [context.network.chainId, context.deployment.address, billId],
  )
  const scopeKey = `${scope.chainId}:${scope.contract}:${scope.billId}`

  const paidKey = bill ? bill.payers.filter((_, i) => bill.paid[i]).map((p) => p.toLowerCase()).join(',') : ''
  const share = bill?.share ?? 0n
  const deployBlock = context.deployment.deployBlock
  const label = context.network.label

  // Candidates added by the view (a just-confirmed payment). Kept in a ref: it changes
  // what the NEXT verification looks at, and `addCandidate` triggers that run explicitly.
  const extra = useRef<HintHash[]>(EMPTY)
  useEffect(() => {
    extra.current = EMPTY
  }, [scopeKey])

  const buildInput = useCallback(
    (isStale: () => boolean) => ({
      client: client as PublicClient,
      scope,
      share,
      paidPayers: paidKey ? paidKey.split(',') : [],
      candidates: assembleCandidates(scope, window.location.search, [...extra.current, ...Object.values(ctl.proofs.fresh())]),
      deployBlock,
      isStale,
      persist: saveVerifiedHints,
    }),
    [client, scope, share, paidKey, deployBlock, ctl],
  )

  // One verification generation per bill snapshot (scope, share, paid set), restarted after each navigation.
  useEffect(() => {
    if (!client) return
    return startReceiptRead(ctl, epochs, buildInput)
  }, [client, ctl, buildInput, epochs, scopeKey, activation])

  const addCandidate = useCallback(
    (hash: HintHash) => {
      if (!client) return
      extra.current = [hash, ...extra.current].slice(0, 5)
      void ctl.refreshWith([hash]).catch(() => undefined)
    },
    [client, ctl],
  )

  const searchHistory = useCallback(() => {
    void ctl.searchHistory()
  }, [ctl])

  const v = ctl.view()
  const message = v.message ? v.message.replace('requires Arc Testnet', `requires ${label}`) : null
  return {
    receipts: v.fresh,
    awaiting: v.awaiting,
    status: v.status,
    message,
    scanning: v.scanning,
    historyDone: v.exhausted,
    unresolved: v.unresolved,
    historyBounded: deployBlock === null,
    searchHistory,
    addCandidate,
  }
}
