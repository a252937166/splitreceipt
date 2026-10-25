import { ArrowUpRight, FileText, Github, PlayCircle, ReceiptText } from 'lucide-react'
import ExternalLink from './ExternalLink'
import { CONTRACT_EXPLORER_URL, GITHUB_URL, PAYMENT_EXPLORER_URL, VIDEO_URL } from './links'

const FACTS = [
  ['Network', 'Arc Mainnet'],
  ['Bill', '#1, "SplitReceipt mainnet demo"'],
  ['Share', '0.001 USDC per payer'],
  ['Status', 'Settled, 2 of 2 paid'],
  ['Who', 'Owner-operated, two accounts'],
] as const

/** Real, existing evidence only: Arc Mainnet Bill 1, its explorer payment, the contract, the video and the source. */
export default function Proof({ settledHref }: { settledHref: string }) {
  return (
    <section id="proof" className="sr-home-section" aria-labelledby="proof-title">
      <div className="sr-home-wrap sr-home-proof">
        <div className="sr-home-proof__copy">
          <h2 id="proof-title" className="sr-home-h2">A real settled bill you can open now</h2>
          <p className="sr-home-sectionhead__lede">
            This is a small example on Arc Mainnet, made by the project owner with two of their own accounts. Both
            shares are paid and both receipts check out. It is a working example, not customer activity, and nothing
            here measures usage.
          </p>

          <dl className="sr-home-facts">
            {FACTS.map(([k, v]) => (
              <div key={k} className="sr-home-facts__row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <p className="sr-home-proof__fine">
            Payer 1 is also the recipient, so that payment returns to its sender; the other moves 0.001 USDC between
            the two accounts. Mainnet uses real USDC. Viewing the bill needs no wallet.
          </p>
        </div>

        <ul className="sr-home-proof__links">
          <li>
            <ExternalLink href={settledHref} className="sr-home-proofLink sr-home-proofLink--lead">
              <ReceiptText size={22} aria-hidden="true" />
              <span>
                <strong>Open Bill 1 in the app</strong>
                <small>Paid status and both receipts, no wallet needed. Opens in a new tab.</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={PAYMENT_EXPLORER_URL} className="sr-home-proofLink">
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>See a payment on the explorer</strong>
                <small>The 0.001 USDC payment from payer 2</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={CONTRACT_EXPLORER_URL} className="sr-home-proofLink">
              <FileText size={22} aria-hidden="true" />
              <span>
                <strong>The contract on the explorer</strong>
                <small>The reviewed Arc Mainnet deployment</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={VIDEO_URL} className="sr-home-proofLink">
              <PlayCircle size={22} aria-hidden="true" />
              <span>
                <strong>Watch the walkthrough</strong>
                <small>About three minutes, on YouTube</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={GITHUB_URL} className="sr-home-proofLink">
              <Github size={22} aria-hidden="true" />
              <span>
                <strong>Read the source</strong>
                <small>Open code on GitHub</small>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </ExternalLink>
          </li>
        </ul>
      </div>
    </section>
  )
}
