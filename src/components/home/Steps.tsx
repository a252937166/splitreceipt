const STEPS = [
  {
    n: '01',
    title: 'Create the bill',
    body: 'Give it a title, name the one person who gets paid, list two to five payers, and set a single equal share.',
    lines: ['Title and recipient', '2 to 5 payers', 'One equal share'],
  },
  {
    n: '02',
    title: 'Share the link, each person pays',
    body: 'Everyone opens the link and pays their own exact share from their own wallet, once. The contract forwards each payment straight to the recipient.',
    lines: ['Exact amount only', 'Once per payer', 'Straight to the recipient'],
  },
  {
    n: '03',
    title: 'Inspect the receipts',
    body: "The bill page shows who has paid and who hasn't. Every payment links to its transaction, and the page checks it against the chain before calling it a receipt.",
    lines: ['Paid or unpaid', 'A link per payment', 'Checked against the chain'],
  },
] as const

/** One divided sequence, laid out like a ledger row: three columns on a wide screen, stacked on a narrow one. */
export default function Steps() {
  return (
    <section id="how-it-works" className="sr-home-section" aria-labelledby="how-title">
      <div className="sr-home-wrap">
        <div className="sr-home-sectionhead">
          <h2 id="how-title" className="sr-home-h2">From a shared bill to a proof of payment in three steps</h2>
          <p className="sr-home-sectionhead__lede">
            One recipient is fixed when the bill is created. Every share goes to that person and nobody else.
          </p>
        </div>

        <ol className="sr-home-steps">
          {STEPS.map((step) => (
            <li key={step.n} className="sr-home-step">
              <span className="sr-home-step__num sr-home-num" aria-hidden="true">{step.n}</span>
              <h3 className="sr-home-step__title">
                <span className="sr-only">Step {Number(step.n)}: </span>
                {step.title}
              </h3>
              <p className="sr-home-step__body">{step.body}</p>
              <ul className="sr-home-step__lines">
                {step.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
