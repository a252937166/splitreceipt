const ITEMS = [
  {
    q: 'Who pays what?',
    a: 'Everyone listed on the bill pays the same share, once. The share and the recipient are fixed when the bill is created. Each payment is forwarded straight to the recipient, and the payer also covers the network fee for their own payment.',
  },
  {
    q: 'Do I need a wallet?',
    a: 'Not to look. Anyone with the link can see who has paid and open each receipt without a wallet. To create a bill or pay a share you choose a wallet yourself and confirm the request in it. SplitReceipt never asks for a private key or recovery phrase.',
  },
  {
    q: 'Is it real money?',
    a: 'It depends on the network. The app starts on Arc Testnet, which uses free test USDC. Arc Mainnet is a separate choice inside the app and uses real USDC for both the payment and the network fee, and a confirmed transaction cannot be undone.',
  },
  {
    q: 'What can it not do?',
    a: 'Shares are always equal, between two and five payers, with one fixed recipient. There are no partial payments, refunds, edits after creation, or identity checks, and the contract has not had a professional audit. Bill titles, addresses, amounts and payments are public onchain.',
  },
] as const

export default function Faq() {
  return (
    <section id="faq" className="sr-home-section" aria-labelledby="faq-title">
      <div className="sr-home-wrap sr-home-faq">
        <div className="sr-home-sectionhead sr-home-faq__head">
          <h2 id="faq-title" className="sr-home-h2">Questions, answered plainly</h2>
        </div>
        <div className="sr-home-faq__list">
          {ITEMS.map((item) => (
            <details key={item.q} className="sr-home-faqItem">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
