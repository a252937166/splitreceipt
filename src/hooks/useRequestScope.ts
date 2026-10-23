import { useEffect, useRef } from 'react'
import { RequestScope, type EpochSources } from '../epoch'

/** One request scope per component instance; unmounting invalidates all its tokens. */
export function useRequestScope(epochs: EpochSources): RequestScope {
  const ref = useRef<RequestScope | null>(null)
  ref.current ??= new RequestScope(epochs)
  const scope = ref.current
  useEffect(() => () => scope.dispose(), [scope])
  return scope
}
