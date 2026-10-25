import { Check, Link2 } from 'lucide-react'

const PEOPLE = [
  { name: 'Maya', paid: true },
  { name: 'Jonas', paid: true },
  { name: 'Priya', paid: false },
] as const

// A torn paper edge: 20 teeth across a 320-wide strip.
const TORN_EDGE = `M0 0H320V2${'l-8 10l-8-10'.repeat(20)}z`

const LABEL =
  'Illustrative example of a split-bill receipt: Team lunch, three people each owe 12.00 USDC to one fixed recipient, two have paid and one has not.'

/**
 * A static, hand-built receipt that shows what a SplitReceipt page contains. It is an illustration only: the names,
 * title and amounts are made up, there are no addresses or transaction hashes, and it is labelled as such. It is
 * not a live bill, a verified transaction or usage data.
 */
export default function ReceiptIllustration() {
  return (
    <figure className="sr-home-receipt">
      <div className="sr-home-receipt__sheet" role="img" aria-label={LABEL}>
        <div className="sr-home-receipt__paper" aria-hidden="true">
          <div className="sr-home-receipt__top">
            <span className="sr-home-receipt__tag">Illustrative example</span>
            <span className="sr-home-receipt__no">Bill example</span>
          </div>

          <p className="sr-home-receipt__title">Team lunch</p>
          <dl className="sr-home-receipt__meta">
            <div>
              <dt>Pays to</dt>
              <dd>Alex, one fixed recipient</dd>
            </div>
            <div>
              <dt>Share each</dt>
              <dd className="sr-home-num">12.00 USDC</dd>
            </div>
          </dl>

          <hr className="sr-home-receipt__rule" />

          <ul className="sr-home-receipt__rows">
            {PEOPLE.map((p, i) => (
              <li key={p.name} className="sr-home-receipt__row">
                <span className="sr-home-receipt__avatar">{i + 1}</span>
                <span className="sr-home-receipt__name">{p.name}</span>
                {p.paid ? (
                  <>
                    <span className="sr-home-receipt__receipt">
                      <Link2 size={13} /> receipt
                    </span>
                    <span className="sr-home-chip sr-home-chip--paid">
                      <Check size={12} /> Paid
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sr-home-receipt__receipt sr-home-receipt__receipt--none">no receipt yet</span>
                    <span className="sr-home-chip sr-home-chip--unpaid">Unpaid</span>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="sr-home-receipt__progress">
            <div className="sr-home-receipt__bar">
              <span style={{ width: '66.6%' }} />
            </div>
            <div className="sr-home-receipt__totals">
              <span>2 of 3 paid</span>
              <span className="sr-home-num">24.00 of 36.00 USDC</span>
            </div>
          </div>
        </div>
        <svg className="sr-home-receipt__edge" viewBox="0 0 320 14" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={TORN_EDGE} />
        </svg>
      </div>
      <figcaption className="sr-home-receipt__caption">
        Illustrative example. Not a real bill, payment or transaction.
      </figcaption>
    </figure>
  )
}
