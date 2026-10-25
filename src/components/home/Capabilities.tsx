import { FileCheck2, ListChecks, Users } from 'lucide-react'

const ROWS = [
  {
    icon: Users,
    title: 'Equal shares for two to five payers',
    body: 'You set one share. The contract takes exactly that amount from each listed payer, once, and refuses anything else. There are no partial payments and no edits after the bill is created.',
  },
  {
    icon: ListChecks,
    title: 'Everyone can see who has paid',
    body: 'Each payer shows as paid or unpaid straight from the contract, with a running count. Anyone with the link can look, with no wallet and no account.',
  },
  {
    icon: FileCheck2,
    title: 'Receipts anyone can verify',
    body: 'Each payment links to its public transaction. Before the page calls it verified, it checks that the transaction succeeded, sits in a canonical block, and carries the matching payment event for that bill and payer.',
  },
] as const

/** The substance of the product, set as a dark panel so it reads as a different register from the steps above. */
export default function Capabilities() {
  return (
    <section id="receipts" className="sr-home-section sr-home-section--tight" aria-labelledby="cap-title">
      <div className="sr-home-wrap">
        <div className="sr-home-panel">
          <div className="sr-home-panel__intro">
            <h2 id="cap-title" className="sr-home-h2 sr-home-h2--light">Built around the receipt, not around trust</h2>
            <p className="sr-home-panel__lede">
              SplitReceipt does not hold anyone's money and keeps no private ledger. The contract moves each share to
              the recipient and the page reads the result back from public chain data.
            </p>
            <p className="sr-home-panel__fine">One recipient. Equal shares. Public proof.</p>
          </div>

          <ul className="sr-home-feats">
            {ROWS.map((row) => (
              <li key={row.title} className="sr-home-feat">
                <span className="sr-home-feat__icon" aria-hidden="true">
                  <row.icon size={22} />
                </span>
                <div>
                  <h3 className="sr-home-feat__title">{row.title}</h3>
                  <p className="sr-home-feat__body">{row.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
