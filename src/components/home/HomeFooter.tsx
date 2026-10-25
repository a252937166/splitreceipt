import { ReceiptText } from 'lucide-react'
import ExternalLink from './ExternalLink'
import { CONTRACT_EXPLORER_URL, GITHUB_URL, STUDIO_URL, VIDEO_URL } from './links'

export default function HomeFooter() {
  return (
    <footer className="sr-home-footer">
      <div className="sr-home-wrap sr-home-footer__grid">
        <div>
          <p className="sr-home-footer__brand">
            <ReceiptText size={20} aria-hidden="true" /> SplitReceipt
          </p>
          <p className="sr-home-footer__fine">
            Bill titles, addresses, amounts and payments are public onchain, so keep personal details out of titles.
            This is an independent project, it has not been audited, and it is not operated or endorsed by Circle.
          </p>
        </div>
        <ul className="sr-home-footer__links">
          <li><ExternalLink href={GITHUB_URL} className="sr-home-link">Source on GitHub</ExternalLink></li>
          <li><ExternalLink href={VIDEO_URL} className="sr-home-link">Walkthrough video</ExternalLink></li>
          <li><ExternalLink href={CONTRACT_EXPLORER_URL} className="sr-home-link">Contract on the explorer</ExternalLink></li>
          <li><ExternalLink href={STUDIO_URL} className="sr-home-link">Built in Arc Studio</ExternalLink></li>
        </ul>
      </div>
    </footer>
  )
}
