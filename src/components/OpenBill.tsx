import { useState } from 'react'
import { parseBillId, type PageContext } from '../networks'

export default function OpenBill({
  context,
  onOpenBill,
}: {
  context: PageContext
  onOpenBill: (context: PageContext, billId: bigint) => void
}) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const id = parseBillId(value.trim())
    if (id === null || id === 'invalid') {
      setError('Enter a bill number such as 3.')
      return
    }
    setError('')
    onOpenBill(context, id)
  }

  return (
    <section className="doc-surface mx-auto max-w-md p-6" aria-labelledby="open-title">
      <h1 id="open-title" className="sr-heading-lg" style={{ marginBottom: 4 }}>Open a bill</h1>
      <p className="sr-small" style={{ color: 'var(--secondary)', marginBottom: 16 }}>
        Anyone can read a bill and its verified payment receipts without connecting a wallet.
      </p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="bill-number" className="sr-heading-sm" style={{ display: 'block', marginBottom: 6 }}>
          Bill number
        </label>
        <input
          id="bill-number"
          className="sr-input"
          inputMode="numeric"
          autoComplete="off"
          placeholder="3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'bill-number-error' : undefined}
        />
        {error && (
          <p id="bill-number-error" className="alert-danger" style={{ marginTop: 8 }} role="alert">{error}</p>
        )}
        <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>Open bill</button>
      </form>
      <p className="sr-meta" style={{ color: 'var(--subdued)', marginTop: 12 }}>
        Reading from {context.deployment.label} on {context.network.label}.
      </p>
    </section>
  )
}
