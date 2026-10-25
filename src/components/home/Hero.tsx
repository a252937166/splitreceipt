import { ArrowRight, Eye } from 'lucide-react'
import ExternalLink from './ExternalLink'
import ReceiptIllustration from './ReceiptIllustration'

export default function Hero({
  onOpenApp,
  settledHref,
}: {
  onOpenApp: () => void
  /** The real address of the settled bill. It opens in a separate tab and never touches a held app. */
  settledHref: string
}) {
  return (
    <section className="sr-home-hero" aria-labelledby="home-title">
      <div className="sr-home-wrap sr-home-hero__grid">
        <div className="sr-home-hero__copy">
          <h1 id="home-title" className="sr-home-h1">
            <span>Split the bill.</span> <span className="sr-home-h1__accent">Keep the proof.</span>
          </h1>
          <p className="sr-home-lede">
            Create a bill for two to five people. Each person pays their exact share in USDC, and the money goes
            straight to one recipient. Every payment gets a public receipt that anyone can open and check.
          </p>

          <div className="sr-home-hero__actions">
            <button type="button" className="sr-home-btn sr-home-btn--primary" onClick={onOpenApp}>
              Open app <ArrowRight size={18} aria-hidden="true" />
            </button>
            <ExternalLink href={settledHref} className="sr-home-btn sr-home-btn--secondary">
              <Eye size={18} aria-hidden="true" /> View a settled bill
            </ExternalLink>
          </div>
          <p className="sr-home-hero__note">
            Looking at a bill needs no wallet. Nothing is sent until you confirm it in your own wallet.
          </p>
        </div>

        <div className="sr-home-hero__visual">
          <ReceiptIllustration />
        </div>
      </div>
    </section>
  )
}
