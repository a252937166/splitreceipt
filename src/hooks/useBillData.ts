import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { PublicClient } from 'viem'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../splitReceiptAbi'
import type { Address, PageContext } from '../networks'
import { verifyRuntime } from '../writeGuard'

/** The shared read-only client, typed loosely enough for the pure verification modules. */
export function useReadClient(chainId: number): PublicClient | undefined {
  return usePublicClient({ chainId }) as unknown as PublicClient | undefined
}

export interface BillData {
  title: string
  recipient: Address
  payers: readonly Address[]
  share: bigint
  /** getBill()[4]: index-aligned with payers. */
  paid: readonly boolean[]
}

export type BillState =
  | { status: 'loading' }
  | { status: 'ready'; bill: BillData }
  | { status: 'missing' }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; message: string }

const POLL_MS = 10_000

/**
 * Reads one bill. The contract runtime is verified against the reviewed hash
 * first; if it does not match, nothing is read or offered (fail closed).
 */
export function useBillData(context: PageContext, billId: bigint) {
  const client = useReadClient(context.network.chainId)
  const [state, setState] = useState<BillState>({ status: 'loading' })
  const run = useRef(0)
  const runtimeOk = useRef(false)

  const load = useCallback(
    async (silent: boolean) => {
      if (!client) return
      const mine = ++run.current
      if (!silent) setState({ status: 'loading' })
      try {
        if (!runtimeOk.current) {
          const rt = await verifyRuntime(client, context.network, context.deployment)
          if (mine !== run.current) return
          if (!rt.ok) {
            if (rt.transient) {
              if (!silent) setState({ status: 'error', message: rt.reason })
            } else {
              setState({ status: 'blocked', reason: rt.reason })
            }
            return
          }
          runtimeOk.current = true
        }
        const res = (await client.readContract({
          address: context.deployment.address,
          abi: SPLIT_RECEIPT_HUMAN_ABI,
          functionName: 'getBill',
          args: [billId],
        })) as readonly [string, Address, readonly Address[], bigint, readonly boolean[]]
        if (mine !== run.current) return
        const [title, recipient, payers, share, paid] = res
        setState({ status: 'ready', bill: { title, recipient, payers, share, paid } })
      } catch (err) {
        if (mine !== run.current) return
        const text = `${(err as Error)?.message ?? ''} ${(err as { shortMessage?: string })?.shortMessage ?? ''}`
        if (text.includes('InvalidBillId')) setState({ status: 'missing' })
        else if (!silent) setState({ status: 'error', message: 'Could not load this bill. Check your connection and retry.' })
      }
    },
    [client, context.network, context.deployment, billId],
  )

  useEffect(() => {
    runtimeOk.current = false
    void load(false)
    const id = window.setInterval(() => void load(true), POLL_MS)
    return () => {
      run.current++
      window.clearInterval(id)
    }
  }, [load])

  return { state, refresh: () => load(false), refreshSilently: () => load(true), client }
}
