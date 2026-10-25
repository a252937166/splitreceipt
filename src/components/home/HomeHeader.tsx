import { ArrowRight, Github, ReceiptText } from 'lucide-react'
import ExternalLink from './ExternalLink'
import { GITHUB_URL } from './links'

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#receipts', label: 'Receipts' },
  { href: '#faq', label: 'FAQ' },
] as const

/** Brand, in-page anchors, the source link and the one primary action. Two compact rows below 48rem. */
export default function HomeHeader({ onOpenApp }: { onOpenApp: () => void }) {
  return (
    <header className="sr-home-header">
      <div className="sr-home-wrap sr-home-header__bar">
        <a className="sr-home-brand" href="#top" aria-label="SplitReceipt, top of page">
          <ReceiptText size={24} aria-hidden="true" />
          <span>SplitReceipt</span>
        </a>

        <nav className="sr-home-nav" aria-label="On this page">
          {NAV.map((item) => (
            <a key={item.href} className="sr-home-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sr-home-header__actions">
          <ExternalLink href={GITHUB_URL} className="sr-home-link sr-home-link--icon">
            <Github size={18} aria-hidden="true" />
            <span className="sr-home-link__text">GitHub</span>
          </ExternalLink>
          <button type="button" className="sr-home-btn sr-home-btn--primary sr-home-btn--header" onClick={onOpenApp}>
            Open app <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
