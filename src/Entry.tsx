/**
 * The entry shell. It decides between the homepage and the app and imports no wallet, chain or provider code.
 *
 * The bare homepage therefore mounts no wallet provider and starts no wallet discovery. The app side
 * (`AppRoot`, which owns the wagmi config) is a lazy chunk requested only once an app address is shown: an old
 * deep link, or a click on "Open app" / "View a settled bill".
 *
 * While the homepage shows after the app was opened, the app stays mounted but hidden. That keeps a submitted
 * transaction's lock and a pending check alive across a visit to the homepage. The settled example is a true
 * new-tab link, so opening it never navigates or remounts a held app. Because every navigation bumps the page
 * epoch (which stales reads that were in flight), `ReadActivationContext` tells the mounted read-only views to
 * restart their reads under the current epoch.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { appEpochs } from './epoch'
import { ReadActivationContext } from './readActivation'
import { CommitMarker, LoadBoundary } from './loadBoundary'
import Home from './components/Home'
import { defaultCreateSearch, isHomeSearch, settledBillSearch } from './homeRoute'
import { readEnvAddress } from './envAddress'

const AppRoot = lazy(() => import('./AppRoot'))

export default function Entry() {
  const [search, setSearch] = useState(() => window.location.search)
  // The last address that belonged to the app (null until the app has been opened).
  const [appSearch, setAppSearch] = useState<string | null>(() =>
    isHomeSearch(window.location.search) ? null : window.location.search,
  )
  const latest = useRef(search)
  // Set (and never cleared) once the app side has committed; see loadBoundary.tsx.
  const committed = useRef(false)
  // The page epoch at the latest navigation; read-only views restart their reads when it changes.
  const [activation, setActivation] = useState(() => appEpochs.page.value)

  const commit = useCallback((next: string) => {
    setSearch(next)
    if (!isHomeSearch(next)) setAppSearch(next)
  }, [])

  useEffect(() => {
    const onPop = () => {
      // Every real navigation bumps the page epoch so pending requests from the old page can never commit.
      if (window.location.search !== latest.current) appEpochs.page.bump()
      latest.current = window.location.search
      setActivation(appEpochs.page.value)
      commit(window.location.search)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [commit])

  const home = isHomeSearch(search)
  const go = useCallback(
    (next: string) => {
      if (next !== latest.current) appEpochs.page.bump()
      latest.current = next
      window.history.pushState({}, '', `${window.location.pathname}${next}`)
      setActivation(appEpochs.page.value)
      commit(next)
      window.scrollTo({ top: 0 })
    },
    [commit],
  )

  // "Open app" returns to where the visitor was in the app, or opens the create form on the default network.
  const openApp = useCallback(() => go(appSearch ?? defaultCreateSearch(readEnvAddress())), [go, appSearch])
  const goHome = useCallback(() => go(''), [go])
  // A real address for the new-tab settled example. Nothing here navigates the held app.
  const settledHref = useMemo(() => `${window.location.pathname}${settledBillSearch()}`, [])

  return (
    <>
      {home && (
        <Home onOpenApp={openApp} settledHref={settledHref} />
      )}
      {appSearch !== null && (
        <div hidden={home}>
          <LoadBoundary committed={committed}>
            <Suspense
              fallback={
                <div className="mx-auto flex max-w-md items-center gap-3 p-6" role="status">
                  <span className="spinner" aria-hidden="true" /> Loading…
                </div>
              }
            >
              <ReadActivationContext.Provider value={activation}>
                <AppRoot appSearch={appSearch} go={go} goHome={goHome} />
                <CommitMarker committed={committed} />
              </ReadActivationContext.Provider>
            </Suspense>
          </LoadBoundary>
        </div>
      )}
    </>
  )
}
