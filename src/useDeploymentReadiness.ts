import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { activeNetwork } from './activeNetwork'
import { checkDeployment, type DeploymentCheck } from './networkContext'

/** No bill reads, history scans or writes run before this readonly check passes. */
export function useDeploymentReadiness() {
  const client = usePublicClient({ chainId: activeNetwork.chainId })
  const mounted = useRef(true)
  const [check, setCheck] = useState<DeploymentCheck>({
    contextKey: activeNetwork.contextKey,
    status: activeNetwork.contract ? 'invalid' : 'unconfigured',
    reason: activeNetwork.configError ?? (activeNetwork.contract
      ? 'Checking network and deployed contract bytecode…'
      : `${activeNetwork.name} deployment is not configured. Transactions and receipt queries are disabled.`),
  })
  const recheck = useCallback(async (): Promise<DeploymentCheck> => {
    const result: DeploymentCheck = client
      ? await checkDeployment(client, activeNetwork)
      : { status: 'rpc-error', contextKey: activeNetwork.contextKey, reason: 'RPC client is unavailable. Transactions are disabled.' }
    if (mounted.current) setCheck(result)
    return result
  }, [client])
  useEffect(() => {
    mounted.current = true
    void recheck()
    return () => { mounted.current = false }
  }, [recheck])
  return { check, recheck }
}
