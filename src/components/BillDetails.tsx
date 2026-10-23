import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  buildContextSearch, explorerAddressUrl, explorerTxUrl, type Address, type Hash32, type PageContext,
} from '../networks'
import { SubmissionLock } from '../submissionLock'
import { guardedWrite } from '../writeGuard'
import { billReader, settlePay, viemWait } from '../settlement'
import { freezePayShare, sendFrozenCall } from '../walletSend'
import { arcMainnetChain, arcTestnetChain } from '../config'
import { verifyCreateBillTransaction } from '../createBillReceipt'
import { fmtNativeUsdc } from '../usdcFormat'
import { buildShareLink } from '../lib/share'
import { useBillData, type BillData } from '../hooks/useBillData'
import { useReceipts } from '../hooks/useReceipts'
import { useWalletSession } from '../wallet/WalletSession'
import { useRequestScope } from '../hooks/useRequestScope'
import { catalogCreationHint } from '../creationHints'
import { CopyButton, ExplorerLink, Spinner, shortAddr, shortHash } from './ui'
import type { HintHash } from '../receiptHints'

type PayPhase = 'idle' | 'checking' | 'wallet' | 'mining'

/**
 * Three outcomes stay distinct after a payment was submitted:
 *  - sent-unverified: sent, result not verified yet (may still confirm);
 *  - not-completed:   definitively not this payment (cancelled, replaced, reverted, no event); share still unpaid;
 *  - verified:        final canonical transaction, SharePaid event and paid state all agree.
 */
interface PayOutcome {
  kind: 'sent-unverified' | 'not-completed' | 'verified'
  submittedHash: Hash32
  finalHash: Hash32 | null
  reason: string
}
type Creator =
  | { kind: 'unknown' }
  | { kind: 'checking' }
  | { kind: 'verified'; address: Address; hash: Hash32 }
  | { kind: 'unverified'; reason: string }

function payError(err: unknown): string {
  const raw = `${(err as { shortMessage?: string }).shortMessage ?? ''} ${(err as Error)?.message ?? ''}`
  const m = raw.toLowerCase()
  if (m.includes('rejected') || m.includes('denied') || m.includes('cancel')) return 'You cancelled the request in your wallet. Nothing was sent.'
  if (m.includes('alreadypaid')) return 'This share is already paid.'
  if (m.includes('notapayer')) return 'This wallet is not listed as a payer on this bill.'
  if (m.includes('wrongamount')) return 'The amount did not match the bill share.'
  if (m.includes('forwardfailed')) return 'The recipient could not accept the payment, so nothing was taken.'
  if (m.includes('insufficient funds')) return 'Your wallet does not have enough USDC for the share plus the network fee.'
  if (m.includes('already pending') || m.includes('-32002')) return 'Your wallet already has a pending request. Open it to continue.'
  return 'The wallet could not send the payment. Nothing was paid.'
}

export default function BillDetails({
  context,
  billId,
  onCreateAnother,
}: {
  context: PageContext
  billId: bigint
  onCreateAnother: () => void
}) {
  const w = useWalletSession()
  const { state, refresh, refreshSilently, client } = useBillData(context, billId)
  const bill: BillData | null = state.status === 'ready' ? state.bill : null
  const rec = useReceipts(client, context, billId, bill, w.epochs)

  const [phase, setPhase] = useState<PayPhase>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingHash, setPendingHash] = useState<Hash32 | null>(null)
  const [outcome, setOutcome] = useState<PayOutcome | null>(null)
  const lock = useRef(new SubmissionLock<{ submittedHash: Hash32; payer: Address; share: bigint }>()).current
  const [creator, setCreator] = useState<Creator>({ kind: 'unknown' })
  const [shareLink, setShareLink] = useState('')

  const scope = useRequestScope(w.epochs)

  // Creator: only from a creation transaction named in the link, verified against canonical data.
  const creationHash: Hash32 | null =
    context.createdHash ??
    catalogCreationHint({ chainId: context.network.chainId, contract: context.deployment.address, billId })
  const billSig = bill ? `${bill.title}|${bill.recipient}|${bill.payers.join(',')}|${bill.share}` : ''
  useEffect(() => {
    if (!bill || !client || !creationHash) {
      setCreator({ kind: 'unknown' })
      return
    }
    let live = true
    const pageEpoch = w.epochs.page.value
    setCreator({ kind: 'checking' })
    void verifyCreateBillTransaction(client, {
      chainId: context.network.chainId,
      contract: context.deployment.address,
      hash: creationHash,
      intended: { title: bill.title, recipient: bill.recipient, payers: bill.payers, share: bill.share },
    }).then((r) => {
      if (!live || w.epochs.page.value !== pageEpoch) return
      if (r.ok && r.billId === billId) setCreator({ kind: 'verified', address: r.creator, hash: creationHash })
      else if (r.ok) setCreator({ kind: 'unverified', reason: 'The creation transaction is for a different bill.' })
      else setCreator({ kind: 'unverified', reason: r.reason })
    })
    return () => {
      live = false
    }
    // billSig stands in for the bill fields used above.
  }, [billSig, client, creationHash, context.network.chainId, context.deployment.address, billId])

  const verifiedHashes = useMemo(() => Object.values(rec.receipts), [rec.receipts])
  useEffect(() => {
    let live = true
    void buildShareLink(buildContextSearch(context, billId, { receipts: verifiedHashes })).then((l) => live && setShareLink(l))
    return () => {
      live = false
    }
  }, [context, billId, verifiedHashes])

  const me = w.snapshot.address?.toLowerCase() ?? null
  const myIndex = bill && me ? bill.payers.findIndex((p) => p.toLowerCase() === me) : -1
  const myPaid = bill && myIndex >= 0 ? bill.paid[myIndex] : false
  const paidCount = bill ? bill.paid.filter(Boolean).length : 0
  const total = bill ? bill.share * BigInt(bill.payers.length) : 0n
  const readiness = w.readiness
  const busy = phase !== 'idle'

  const settled = bill !== null && paidCount === bill.payers.length

  const chain = context.network.key === 'mainnet' ? arcMainnetChain : arcTestnetChain

  /** Read-only: decides what happened to a sent payment. Never sends anything. */
  const settle = async (sub: { submittedHash: Hash32; payer: Address; share: bigint }): Promise<void> => {
    if (!client) return
    const token = scope.begin()
    setPhase('mining')
    try {
      const result = await settlePay({
        client,
        wait: viemWait(client),
        token,
        submittedHash: sub.submittedHash,
        chainId: context.network.chainId,
        contract: context.deployment.address,
        billId,
        payer: sub.payer,
        share: sub.share,
        readBill: billReader(client, context.deployment.address, billId),
      })
      lock.reconcile(result.kind)
      if (result.kind === 'stale') {
        if (token.ownerActive()) {
          setOutcome({ kind: 'sent-unverified', submittedHash: sub.submittedHash, finalHash: null, reason: 'Your wallet or this page changed before the result was checked.' })
        }
        return
      }
      if (result.kind === 'verified') {
        // Receipts, links and the cache use the FINAL canonical hash, never the submitted one.
        rec.addCandidate(result.finalHash.toLowerCase() as HintHash)
        setOutcome({ kind: 'verified', submittedHash: result.submittedHash, finalHash: result.finalHash, reason: '' })
        toast.success('Payment verified on the chain')
      } else {
        setOutcome({
          kind: result.kind,
          submittedHash: result.submittedHash,
          finalHash: result.kind === 'not-completed' ? result.finalHash : null,
          reason: result.reason,
        })
      }
      await refreshSilently()
    } finally {
      if (token.ownerActive()) setPhase('idle')
    }
  }

  const pay = async () => {
    if (!bill || !client || busy) return
    if (lock.held) {
      // A submitted payment is unresolved: only a read-only check can release this lock.
      setNotice('A payment you sent is still being verified. Use Check again; nothing new will be requested from your wallet.')
      return
    }
    setNotice(null)
    setPendingHash(null)
    setOutcome(null)
    if (settled) return setNotice('This bill is settled. Every share is already paid, so it cannot take another payment.')
    if (!readiness.ready) {
      if (readiness.need === 'switch-network') await w.switchToNetwork()
      else if (readiness.need === 'acknowledge') w.acknowledge()
      else setNotice(readiness.message)
      return
    }
    if (myIndex < 0) return setNotice('This wallet is not listed as a payer on this bill.')
    if (myPaid) return setNotice('This share is already paid.')
    const { connector, acknowledgedProvider } = w.getWriteSession()
    if (!connector) return setNotice('Your wallet is not ready. Choose it again from the wallet menu.')

    const walletAtStart = w.getSnapshot()
    const account = walletAtStart.address as Address
    const call = freezePayShare(context.network, context.deployment, account, billId, bill.share)
    const token = scope.begin()
    let sentHash: Hash32 | null = null
    try {
      setPhase('checking')
      const sent = await guardedWrite({
        client,
        network: context.network,
        deployment: context.deployment,
        wallet: walletAtStart,
        acknowledgedKey: w.acknowledgedKey,
        acknowledgedProvider,
        getProvider: () => connector.getProvider(),
        token,
        getWallet: w.getSnapshot,
        send: (provider) => {
          setPhase('wallet')
          // The guard that matters runs on the wallet request itself (see walletSend.ts).
          return sendFrozenCall({ call, provider, chain, guard: { token, wallet: walletAtStart, getWallet: w.getSnapshot } })
        },
      })
      if (!sent.ok) {
        if (token.ownerActive()) setNotice(sent.reason)
        return
      }
      if (!sent.value.ok) {
        if (token.ownerActive()) setNotice(sent.value.reason)
        return
      }
      sentHash = sent.value.hash
      const sub = { submittedHash: sentHash, payer: account, share: bill.share }
      lock.hold(sub) // synchronous: from here on only a read-only check can release it
      setPendingHash(sentHash)
      if (!token.ownerActive()) return
      await settle(sub)
    } catch (err) {
      if (sentHash) {
        if (token.ownerActive()) setOutcome({ kind: 'sent-unverified', submittedHash: sentHash, finalHash: null, reason: 'The result could not be read yet.' })
      } else if (token.ownerActive()) {
        setNotice(payError(err))
      }
    } finally {
      if (token.ownerActive()) setPhase((p) => (p === 'checking' || p === 'wallet' ? 'idle' : p))
    }
  }

  const payLabel = (() => {
    if (phase === 'checking') return 'Checking contract…'
    if (phase === 'wallet') return 'Confirm in your wallet…'
    if (phase === 'mining') return 'Waiting for confirmation…'
    if (outcome?.kind === 'sent-unverified') return 'Waiting for the sent payment'
    if (!readiness.ready) {
      if (readiness.need === 'switch-network') return `Switch to ${context.network.label}`
      if (readiness.need === 'acknowledge') return 'Use this wallet'
      return 'Connect a wallet to pay'
    }
    return bill ? `Pay ${fmtNativeUsdc(bill.share)} ${context.network.realFunds ? 'real USDC' : 'USDC'}` : 'Pay'
  })()

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={onCreateAnother}>New bill</button>
        <span className="sr-meta" style={{ color: 'var(--subdued)' }}>
          {context.deployment.label} · <span className="sr-mono">{shortAddr(context.deployment.address)}</span>
        </span>
      </div>

      {state.status === 'loading' && (
        <div className="doc-surface flex items-center gap-3 p-6" role="status"><Spinner /> Loading bill {billId.toString()}…</div>
      )}

      {state.status === 'missing' && (
        <div className="doc-surface p-6" role="alert">
          <h1 className="sr-heading-md">Bill {billId.toString()} does not exist</h1>
          <p className="sr-small" style={{ color: 'var(--secondary)', margin: '8px 0 16px' }}>
            No bill with this number has been created on this contract yet.
          </p>
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={onCreateAnother}>Create a bill</button>
        </div>
      )}

      {state.status === 'blocked' && (
        <div className="doc-surface p-6">
          <div className="alert-danger" role="alert">
            <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Bill not shown.</strong> {state.reason} Payments are disabled until the contract matches the
              reviewed code.
            </div>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="doc-surface p-6">
          <div className="alert-danger" role="alert"><AlertCircle size={16} aria-hidden="true" /> {state.message}</div>
          <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {bill && (
        <div className="layout-details">
          <article className="doc-surface" aria-labelledby="bill-title" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="sr-meta" style={{ color: 'var(--subdued)' }}>Bill #{billId.toString()}</span>
                {paidCount === bill.payers.length ? <span className="badge-paid">Settled</span> : <span className="badge-unpaid">{paidCount} of {bill.payers.length} paid</span>}
              </div>
              <h1 id="bill-title" className="sr-heading-xl" style={{ margin: '8px 0 12px', overflowWrap: 'anywhere' }}>{bill.title || 'Untitled bill'}</h1>
              <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={bill.payers.length} aria-valuenow={paidCount} aria-label="Shares paid">
                <div className="progress-bar__fill" style={{ width: `${(paidCount / bill.payers.length) * 100}%` }} />
              </div>
            </div>

            <div className="bill-totals">
              <div className="bill-total-cell"><div className="sr-meta">Share each</div><div className="bill-total-value">{fmtNativeUsdc(bill.share)} USDC</div></div>
              <div className="bill-total-cell"><div className="sr-meta">Total</div><div className="bill-total-value">{fmtNativeUsdc(total)} USDC</div></div>
              <div className="bill-total-cell"><div className="sr-meta">Paid</div><div className="bill-total-value">{fmtNativeUsdc(bill.share * BigInt(paidCount))} USDC</div></div>
            </div>

            <div style={{ padding: '16px 24px' }}>
              <dl className="m-0 grid gap-3">
                <div>
                  <dt className="sr-meta" style={{ color: 'var(--subdued)' }}>Recipient (fixed by the contract)</dt>
                  <dd className="m-0 flex flex-wrap items-center gap-2">
                    <span className="sr-mono sr-small addr-cell">{bill.recipient}</span>
                    <ExplorerLink href={explorerAddressUrl(context.network, bill.recipient)}>Explorer</ExplorerLink>
                  </dd>
                </div>
                <div>
                  <dt className="sr-meta" style={{ color: 'var(--subdued)' }}>Created by</dt>
                  <dd className="m-0 sr-small">
                    {creator.kind === 'verified' && (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="sr-mono addr-cell">{creator.address}</span>
                        <span className="badge-paid">Verified</span>
                        <ExplorerLink href={explorerTxUrl(context.network, creator.hash)}>Creation transaction</ExplorerLink>
                      </span>
                    )}
                    {creator.kind === 'checking' && <span style={{ color: 'var(--secondary)' }}>Verifying creation transaction…</span>}
                    {creator.kind === 'unverified' && <span style={{ color: 'var(--danger)' }}>Not verified: {creator.reason}</span>}
                    {creator.kind === 'unknown' && (
                      <span style={{ color: 'var(--secondary)' }}>
                        The contract does not store who created a bill. Open the bill from its creation link to see
                        the verified sender.
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <hr className="doc-rule" />
            <div style={{ padding: '8px 24px 16px' }}>
              <h2 className="sr-heading-sm" style={{ margin: '8px 0' }}>Payers</h2>
              {bill.payers.map((p, i) => {
                const paid = bill.paid[i]
                const hash = rec.receipts[p.toLowerCase()]
                const mine = me === p.toLowerCase()
                return (
                  <div key={p} className="payer-row">
                    <span className="payer-badge">{i + 1}</span>
                    <span className="sr-mono sr-small addr-cell">
                      {p}{mine && <span className="sr-meta" style={{ color: 'var(--primary)' }}> (you)</span>}
                    </span>
                    {paid ? <span className="badge-paid"><CheckCircle2 size={12} aria-hidden="true" /> Paid</span> : <span className="badge-unpaid">Unpaid</span>}
                    <span className="sr-small" style={{ minWidth: 96, textAlign: 'right' }}>
                      {paid && hash && <ExplorerLink href={explorerTxUrl(context.network, hash)}>{shortHash(hash)}</ExplorerLink>}
                      {paid && !hash && rec.awaiting[p.toLowerCase()] && (
                        <span style={{ color: 'var(--subdued)' }}>Awaiting re-verification</span>
                      )}
                      {paid && !hash && !rec.awaiting[p.toLowerCase()] && rec.status === 'verifying' && <span style={{ color: 'var(--subdued)' }}>Verifying…</span>}
                      {paid && !hash && !rec.awaiting[p.toLowerCase()] && rec.status !== 'verifying' && <span style={{ color: 'var(--subdued)' }}>No receipt yet</span>}
                    </span>
                  </div>
                )
              })}
              <p className="sr-meta" style={{ color: 'var(--subdued)', marginTop: 8 }}>
                Paid status comes from the contract. A receipt is shown only after its transaction, block and payment
                event are confirmed on the chain.
              </p>
              {rec.message && <div className="alert-warn" style={{ marginTop: 8 }} role="status">{rec.message}</div>}
              {paidCount > 0 && Object.keys(rec.receipts).length < paidCount && rec.status !== 'verifying' && (
                <div style={{ marginTop: 12 }}>
                  <button type="button" className="btn-ghost" disabled={rec.scanning || rec.historyDone} onClick={rec.searchHistory}>
                    {rec.scanning ? 'Searching…' : rec.historyDone ? 'History searched' : rec.unresolved > 0 ? 'Retry receipt check' : 'Find missing receipts'}
                  </button>
                  {rec.historyBounded && (
                    <p className="sr-meta" style={{ color: 'var(--subdued)', marginTop: 6 }}>
                      This deployment&apos;s start block is not recorded, so only recent history is searched.
                    </p>
                  )}
                </div>
              )}
            </div>
          </article>

          <aside aria-label="Actions" className="grid gap-4">
            <div className="doc-surface" style={{ padding: 20 }}>
              <h2 className="sr-heading-sm" style={{ marginBottom: 8 }}>{settled ? 'Settled' : 'Your share'}</h2>
              {settled ? (
                <>
                  <div className="alert-success" role="status">
                    <CheckCircle2 size={16} aria-hidden="true" /> All {bill.payers.length} shares are paid.
                  </div>
                  <p className="sr-small" style={{ color: 'var(--secondary)', margin: '12px 0' }}>
                    This bill is settled and cannot take another payment. The contract also rejects a second payment
                    from the same payer.
                  </p>
                  <button type="button" className="btn-primary" disabled aria-disabled="true">Nothing to pay</button>
                </>
              ) : (
                <>
                  {myIndex >= 0 && myPaid && (
                    <div className="alert-success"><CheckCircle2 size={16} aria-hidden="true" /> You have paid this share.</div>
                  )}
                  {myIndex < 0 && w.snapshot.connected && readiness.ready && (
                    <p className="sr-small" style={{ color: 'var(--secondary)' }}>The connected wallet is not a payer on this bill.</p>
                  )}
                  {!(myIndex >= 0 && myPaid) && !(myIndex < 0 && w.snapshot.connected && readiness.ready) && (
                    <>
                      <p className="sr-small" style={{ color: 'var(--secondary)', marginBottom: 12 }}>
                        You send exactly {fmtNativeUsdc(bill.share)} USDC. The contract forwards it directly to the
                        recipient. The network fee is paid on top.
                        {context.network.realFunds && ' This is real USDC on Arc Mainnet.'}
                      </p>
                      <button type="button" className="btn-primary" onClick={() => void pay()} disabled={busy || outcome?.kind === 'sent-unverified' || (!readiness.ready && readiness.need === 'connect')}>
                        {payLabel}
                      </button>
                    </>
                  )}
                </>
              )}
              {busy && pendingHash && (
                <p className="sr-meta" style={{ marginTop: 8 }}><ExplorerLink href={explorerTxUrl(context.network, pendingHash)}>View transaction</ExplorerLink></p>
              )}
              {outcome?.kind === 'sent-unverified' && (
                <div className="alert-warn" role="status" style={{ marginTop: 12, flexDirection: 'column' }}>
                  <strong>Sent, but the result is not verified yet.</strong>
                  <span>
                    {outcome.reason} The payment may still confirm, so do not pay again yet. Your share is not shown
                    as paid until the chain confirms it.
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost touch-target"
                      disabled={busy}
                      onClick={() => lock.intent && void settle(lock.intent)}
                    >
                      Check again
                    </button>
                    <ExplorerLink href={explorerTxUrl(context.network, outcome.submittedHash)}>View transaction</ExplorerLink>
                  </div>
                </div>
              )}
              {outcome?.kind === 'not-completed' && (
                <div className="alert-danger" role="alert" style={{ marginTop: 12, flexDirection: 'column' }}>
                  <strong>This transaction did not pay your share.</strong>
                  <span>{outcome.reason}</span>
                  <span>Your share is still unpaid. Nothing is resubmitted automatically; press Pay to try again.</span>
                  <ExplorerLink href={explorerTxUrl(context.network, outcome.finalHash ?? outcome.submittedHash)}>View transaction</ExplorerLink>
                </div>
              )}
              {outcome?.kind === 'verified' && (
                <div className="alert-success" role="status" style={{ marginTop: 12 }}>
                  <CheckCircle2 size={16} aria-hidden="true" /> Payment verified on the chain.
                  <ExplorerLink href={explorerTxUrl(context.network, outcome.finalHash ?? outcome.submittedHash)}>Transaction</ExplorerLink>
                </div>
              )}
              {notice && <div className="alert-danger" role="alert" style={{ marginTop: 12 }}><AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />{notice}</div>}
            </div>

            <div className="doc-surface" style={{ padding: 20 }}>
              <h2 className="sr-heading-sm" style={{ marginBottom: 8 }}>Share this bill</h2>
              <p className="sr-small" style={{ color: 'var(--secondary)', marginBottom: 12 }}>
                The link names the network, contract and bill. It carries only receipts verified against the current bill; others are checked again by whoever opens it.
              </p>
              {shareLink ? <CopyButton value={shareLink} label="Copy bill link" /> : <Spinner />}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
