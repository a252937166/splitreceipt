import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { PublicClient } from 'viem'
import type { PageContext } from '../networks'
import { BillReader, type BillState } from '../billReader'

export type { BillData, BillState } from '../billReader'

/** The shared read-only client, typed loosely enough for the pure verification modules. */
export function useReadClient(chainId: number): PublicClient | undefined {
  return usePublicClient({ chainId }) as unknown as PublicClient | undefined
}

/**
 * Reads one bill. The contract runtime is verified against the reviewed hash first; if it does not match, nothing
 * is read or offered (fail closed). All scheduling (one in-flight read, coalesced refreshes, ownership across
 * context changes) lives in `BillReader`; this hook only creates one reader per live context and disposes it on
 * a context change or unmount.
 */
export function useBillData(context: PageContext, billId: bigint) {
  const client = useReadClient(context.network.chainId)
  const [state, setState] = useState<BillState>({ status: 'loading' })
  const reader = useRef<BillReader | null>(null)

  useEffect(() => {
    if (!client) {
      // No live client: nothing from a previous context may stay on screen as this bill.
      reader.current = null
      setState({ status: 'loading' })
      return
    }
    const mine = new BillReader({ client, network: context.network, deployment: context.deployment, billId, onState: setState })
    reader.current = mine
    mine.start()
    return () => {
      mine.dispose()
      if (reader.current === mine) reader.current = null
    }
  }, [client, context.network, context.deployment, billId])

  const refresh = useCallback(() => reader.current?.refresh() ?? Promise.resolve(), [])
  const refreshSilently = useCallback(() => reader.current?.refreshSilently() ?? Promise.resolve(), [])

  return { state, refresh, refreshSilently, client }
}
