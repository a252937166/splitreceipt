import '../home.css'
import HomeHeader from './home/HomeHeader'
import Hero from './home/Hero'
import Steps from './home/Steps'
import Capabilities from './home/Capabilities'
import Proof from './home/Proof'
import Faq from './home/Faq'
import HomeFooter from './home/HomeFooter'

/**
 * The marketing homepage. Static content and links only: it imports no wallet, chain or provider code, makes no
 * network request, and reads nothing from the page except what its two parents pass in.
 */
export default function Home({
  onOpenApp,
  settledHref,
}: {
  onOpenApp: () => void
  /**
   * The real address of the settled example. Both settled-example links are true new-tab anchors, so opening the
   * read-only proof never navigates or remounts an app that is still held (and may hold a submission lock).
   */
  settledHref: string
}) {
  return (
    <div className="sr-home" id="top">
      <a className="sr-home-skip" href="#main">Skip to content</a>
      <HomeHeader onOpenApp={onOpenApp} />
      <main id="main">
        <Hero onOpenApp={onOpenApp} settledHref={settledHref} />
        <Steps />
        <Capabilities />
        <Proof settledHref={settledHref} />
        <Faq />
      </main>
      <HomeFooter />
    </div>
  )
}
