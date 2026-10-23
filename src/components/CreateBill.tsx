import { useEffect, useMemo, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import type { PublicClient } from 'viem'
import { AlertCircle, CheckCircle2, PlusCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { buildContextSearch, explorerTxUrl, type Address, type Hash32, type PageContext } from '../networks'
import { MAX_PAYERS, MAX_TITLE_BYTES, MIN_PAYERS, utf8ByteLength, validateBillForm, type BillFormErrors } from '../billForm'
import type { IntendedBill } from '../createBillReceipt'
import { settleCreate, viemWait, type Settlement } from '../settlement'
import { freezeCreateBill, sendFrozenCall } from '../walletSend'
import { arcMainnetChain, arcTestnetChain } from '../config'
import { SubmissionLock } from '../submissionLock'
import { guardedWrite } from '../writeGuard'
import { fmtNativeUsdc, parseUsdcToNative } from '../usdcFormat'
import { buildShareLink } from '../lib/share'
import { useWalletSession } from '../wallet/WalletSession'
import { useRequestScope } from '../hooks/useRequestScope'
import { CopyButton, ExplorerLink, Spinner, shortAddr } from './ui'

type Phase = 'idle' | 'checking' | 'wallet' | 'mining' | 'verifying'

interface Created {
  billId: bigint
  hash: Hash32
  creator: Address
}

/** A transaction was sent but is not (yet) a verified bill. */
interface Unsettled {
  kind: 'sent-unverified' | 'not-completed'
  submittedHash: Hash32
  finalHash: Hash32 | null
  reason: string
}

interface Submission {
  submittedHash: Hash32
  intended: IntendedBill
  creator: Address
}

function writeErrorMessage(err: unknown): string {
  const m = ((err as { shortMessage?: string }).shortMessage ?? (err as Error)?.message ?? '').toLowerCase()
  if (m.includes('rejected') || m.includes('denied') || m.includes('cancel')) return 'You cancelled the request in your wallet. Nothing was sent.'
  if (m.includes('insufficient funds')) return 'Your wallet does not have enough USDC to pay the network fee.'
  if (m.includes('already pending') || m.includes('-32002')) return 'Your wallet already has a pending request. Open it to continue.'
  return 'The wallet could not send the transaction. Nothing was created.'
}

export default function CreateBill({
  context,
  onOpenBill,
}: {
  context: PageContext
  onOpenBill: (context: PageContext, billId: bigint, created?: Hash32 | null) => void
}) {
  const w = useWalletSession()
  const client = usePublicClient({ chainId: context.network.chainId }) as unknown as PublicClient | undefined

  const [title, setTitle] = useState('')
  const [recipient, setRecipient] = useState('')
  const [payers, setPayers] = useState<string[]>(['', ''])
  const [share, setShare] = useState('')
  const [errors, setErrors] = useState<BillFormErrors>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingHash, setPendingHash] = useState<Hash32 | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [unsettled, setUnsettled] = useState<Unsettled | null>(null)
  const lock = useRef(new SubmissionLock<Submission>()).current
  const [shareLink, setShareLink] = useState('')

  const scope = useRequestScope(w.epochs)

  useEffect(() => {
    if (!created) return
    let live = true
    void buildShareLink(buildContextSearch(context, created.billId)).then((l) => live && setShareLink(l))
    return () => {
      live = false
    }
  }, [created, context])

  const busy = phase !== 'idle'
  const readiness = w.readiness

  const preview = useMemo(() => {
    let shareNative: bigint | null = null
    try {
      shareNative = parseUsdcToNative(share)
    } catch {
      shareNative = null
    }
    const filled = payers.map((p) => p.trim()).filter(Boolean)
    return {
      shareNative,
      total: shareNative !== null ? shareNative * BigInt(Math.max(payers.length, 1)) : null,
      filled,
    }
  }, [share, payers])

  const chain = context.network.key === 'mainnet' ? arcMainnetChain : arcTestnetChain

  /** Read-only: decides what happened to a sent transaction. Never sends anything. */
  const settle = async (sub: Submission): Promise<void> => {
    if (!client) return
    const token = scope.begin()
    setPhase('mining')
    try {
      const result: Settlement<{ billId: bigint; creator: Address }> = await settleCreate({
        client,
        wait: viemWait(client),
        token,
        submittedHash: sub.submittedHash,
        chainId: context.network.chainId,
        contract: context.deployment.address,
        intended: sub.intended,
        creator: sub.creator,
      })
      lock.reconcile(result.kind)
      if (result.kind === 'stale') {
        if (token.ownerActive()) {
          setUnsettled({
            kind: 'sent-unverified',
            submittedHash: sub.submittedHash,
            finalHash: null,
            reason: 'Your wallet or this page changed before the result was checked.',
          })
        }
        return
      }
      if (result.kind === 'verified') {
        setUnsettled(null)
        setCreated({ billId: result.data.billId, hash: result.finalHash, creator: result.data.creator })
        toast.success(`Bill ${result.data.billId} created`)
        return
      }
      setUnsettled({
        kind: result.kind,
        submittedHash: result.submittedHash,
        finalHash: result.kind === 'not-completed' ? result.finalHash : null,
        reason: result.reason,
      })
    } finally {
      if (token.ownerActive()) setPhase('idle')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (lock.held) {
      // A submitted transaction is unresolved: only a read-only check can release this lock.
      setNotice('A transaction you sent is still being verified. Use Check again; nothing new will be requested from your wallet.')
      return
    }
    setNotice(null)
    setCreated(null)
    setUnsettled(null)
    setPendingHash(null)

    const result = validateBillForm({ title, recipient, payers, share })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})

    if (!readiness.ready) {
      if (readiness.need === 'switch-network') await w.switchToNetwork()
      else if (readiness.need === 'acknowledge') w.acknowledge()
      else setNotice(readiness.message)
      return
    }
    const { connector, acknowledgedProvider } = w.getWriteSession()
    if (!client || !connector) {
      setNotice('The network connection is not ready yet. Try again in a moment.')
      return
    }

    const intended = result.intended
    const walletAtStart = w.getSnapshot()
    const creator = walletAtStart.address as Address
    const call = freezeCreateBill(context.network, context.deployment, creator, intended)
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
      const sub: Submission = { submittedHash: sentHash, intended, creator }
      lock.hold(sub) // synchronous: from here on only a read-only check can release it

      // The transaction exists now. It is never reported as "nothing was created".
      setPendingHash(sentHash)
      if (!token.ownerActive()) return
      setPhase('mining')
      await settle(sub)
    } catch (err) {
      if (sentHash) {
        if (token.ownerActive()) {
          setUnsettled({ kind: 'sent-unverified', submittedHash: sentHash, finalHash: null, reason: 'The result could not be read yet.' })
        }
      } else if (token.ownerActive()) {
        setNotice(writeErrorMessage(err))
      }
    } finally {
      if (token.ownerActive()) setPhase((p) => (p === 'checking' || p === 'wallet' ? 'idle' : p))
    }
  }

  const ctaLabel = (() => {
    if (phase === 'checking') return 'Checking contract…'
    if (phase === 'wallet') return 'Confirm in your wallet…'
    if (phase === 'mining') return 'Waiting for confirmation…'
    if (phase === 'verifying') return 'Verifying the bill…'
    if (unsettled?.kind === 'sent-unverified') return 'Waiting for the sent transaction'
    if (!readiness.ready) {
      if (readiness.need === 'switch-network') return `Switch to ${context.network.label}`
      if (readiness.need === 'acknowledge') return 'Use this wallet'
      return 'Connect a wallet to create'
    }
    return context.network.realFunds ? 'Create bill (pays network fee in real USDC)' : 'Create bill'
  })()
  const ctaDisabled = busy || unsettled?.kind === 'sent-unverified' || (!readiness.ready && readiness.need === 'connect')

  const titleBytes = utf8ByteLength(title.trim())

  return (
    <div className="layout-create">
      <section aria-labelledby="create-title">
        <h1 id="create-title" className="sr-heading-xl" style={{ marginBottom: 4 }}>Split a bill</h1>
        <p className="sr-body" style={{ color: 'var(--secondary)', marginBottom: 24, maxWidth: '60ch' }}>
          Name the recipient and each payer. Every payer sends their exact share, and the contract forwards it straight
          to the recipient.
        </p>

        <form onSubmit={(e) => void submit(e)} noValidate className="doc-surface" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="title" className="sr-heading-sm" style={{ display: 'block', marginBottom: 6 }}>Title</label>
            <input
              id="title"
              className="sr-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team dinner"
              autoComplete="off"
              aria-invalid={Boolean(errors.title)}
              aria-describedby="title-help"
            />
            <p id="title-help" className="sr-meta" style={{ color: errors.title ? 'var(--danger)' : 'var(--subdued)', marginTop: 4 }}>
              {errors.title ?? `${titleBytes}/${MAX_TITLE_BYTES} bytes. Titles are public.`}
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="recipient" className="sr-heading-sm" style={{ display: 'block', marginBottom: 6 }}>Recipient</label>
            <input
              id="recipient"
              className="sr-input sr-mono"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.recipient)}
            />
            {errors.recipient && <p className="sr-meta" style={{ color: 'var(--danger)', marginTop: 4 }}>{errors.recipient}</p>}
            {w.snapshot.address && (
              <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setRecipient(w.snapshot.address ?? '')}>
                Use my wallet
              </button>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="share" className="sr-heading-sm" style={{ display: 'block', marginBottom: 6 }}>
              Share per payer (USDC)
            </label>
            <input
              id="share"
              className="sr-input sr-mono"
              inputMode="decimal"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              placeholder="10.50"
              autoComplete="off"
              aria-invalid={Boolean(errors.share)}
            />
            <p className="sr-meta" style={{ color: errors.share ? 'var(--danger)' : 'var(--subdued)', marginTop: 4 }}>
              {errors.share ?? 'Up to 6 decimal places. Network fees are paid on top.'}
            </p>
          </div>

          <fieldset style={{ border: 0, padding: 0, margin: '0 0 20px' }}>
            <legend className="sr-heading-sm" style={{ marginBottom: 6 }}>
              Payers ({payers.length} of {MAX_PAYERS})
            </legend>
            <div className="flex flex-col gap-2">
              {payers.map((p, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2">
                    <span className="payer-badge" aria-hidden="true">{i + 1}</span>
                    <input
                      className="sr-input sr-mono"
                      aria-label={`Payer ${i + 1} address`}
                      value={p}
                      onChange={(e) => setPayers((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="0x…"
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={Boolean(errors.payers?.[i])}
                    />
                    {payers.length > MIN_PAYERS && (
                      <button
                        type="button"
                        className="btn-ghost touch-target"
                        aria-label={`Remove payer ${i + 1}`}
                        onClick={() => setPayers((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {errors.payers?.[i] && (
                    <p className="sr-meta" style={{ color: 'var(--danger)', margin: '4px 0 0 30px' }}>{errors.payers[i]}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
              {payers.length < MAX_PAYERS && (
                <button type="button" className="btn-ghost" onClick={() => setPayers((prev) => [...prev, ''])}>
                  <PlusCircle size={14} aria-hidden="true" /> Add payer
                </button>
              )}
              {w.snapshot.address && !payers.some((p) => p.toLowerCase() === w.snapshot.address) && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    setPayers((prev) => {
                      const idx = prev.findIndex((x) => x.trim() === '')
                      if (idx === -1) return prev
                      return prev.map((x, j) => (j === idx ? (w.snapshot.address ?? '') : x))
                    })
                  }
                >
                  Add my wallet
                </button>
              )}
            </div>
            {errors.form && <p className="sr-meta" style={{ color: 'var(--danger)', marginTop: 6 }}>{errors.form}</p>}
          </fieldset>

          {notice && (
            <div className="alert-danger" role="alert" style={{ marginBottom: 16 }}>
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div>{notice}</div>
                {pendingHash && (
                  <div style={{ marginTop: 4 }}>
                    <ExplorerLink href={explorerTxUrl(context.network, pendingHash)}>View transaction</ExplorerLink>
                  </div>
                )}
              </div>
            </div>
          )}

          {unsettled?.kind === 'sent-unverified' && (
            <div className="alert-warn" role="status" style={{ marginBottom: 16, flexDirection: 'column' }}>
              <strong>Sent, but the result is not verified yet.</strong>
              <span>
                {unsettled.reason} The transaction may still confirm, so do not create the bill again yet. Check it in
                the explorer, or check again here.
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
                <ExplorerLink href={explorerTxUrl(context.network, unsettled.submittedHash)}>View transaction</ExplorerLink>
              </div>
            </div>
          )}

          {unsettled?.kind === 'not-completed' && (
            <div className="alert-danger" role="alert" style={{ marginBottom: 16, flexDirection: 'column' }}>
              <strong>This transaction did not create the bill.</strong>
              <span>{unsettled.reason}</span>
              <span>Nothing was created by it. You can review the form and try again; nothing is resubmitted automatically.</span>
              <ExplorerLink href={explorerTxUrl(context.network, unsettled.finalHash ?? unsettled.submittedHash)}>View transaction</ExplorerLink>
            </div>
          )}

          {busy && (
            <div className="alert-info" role="status" style={{ marginBottom: 16 }}>
              <Spinner />
              <span>{ctaLabel}</span>
              {pendingHash && <ExplorerLink href={explorerTxUrl(context.network, pendingHash)}>Explorer</ExplorerLink>}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={ctaDisabled}>{ctaLabel}</button>
          {!readiness.ready && readiness.need === 'connect' && (
            <p className="sr-meta" style={{ color: 'var(--subdued)', marginTop: 8 }}>
              Use Connect wallet at the top of the page. You can still fill in the bill first.
            </p>
          )}
        </form>

        {created && (
          <div className="alert-success" role="status" style={{ marginTop: 16, flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Bill {created.billId.toString()} is created and verified.</span>
            </div>
            <p className="sr-small" style={{ margin: '4px 0 8px', fontWeight: 400 }}>
              Created by <span className="sr-mono">{shortAddr(created.creator)}</span> (the sender of the verified
              transaction). Share the link so each payer can pay their share.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-primary"
                style={{ width: 'auto' }}
                onClick={() => onOpenBill(context, created.billId, created.hash)}
              >
                Open bill {created.billId.toString()}
              </button>
              {shareLink && <CopyButton value={`${shareLink}`} label="Copy bill link" />}
              <ExplorerLink href={explorerTxUrl(context.network, created.hash)}>Creation transaction</ExplorerLink>
            </div>
          </div>
        )}
      </section>

      <aside className="create-preview" aria-label="Receipt preview">
        <div className="receipt-preview" style={{ padding: 20 }}>
          <div className="flex items-center justify-between">
            <span className="sr-heading-sm">Receipt preview</span>
            <span className="badge-draft">Draft</span>
          </div>
          <h2 className="sr-heading-md" style={{ margin: '12px 0 4px', overflowWrap: 'anywhere' }}>
            {title.trim() || 'Untitled bill'}
          </h2>
          <p className="sr-meta addr-cell" style={{ color: 'var(--subdued)' }}>
            To {recipient.trim() ? shortAddr(recipient.trim()) : 'recipient not set'}
          </p>
          <hr className="doc-rule doc-rule--dashed" style={{ margin: '12px 0' }} />
          {preview.filled.length === 0 ? (
            <p className="sr-small" style={{ color: 'var(--subdued)' }}>Payers appear here as you add them.</p>
          ) : (
            preview.filled.map((p, i) => (
              <div key={`${p}-${i}`} className="payer-row">
                <span className="payer-badge">{i + 1}</span>
                <span className="sr-mono sr-small addr-cell">{shortAddr(p)}</span>
                <span className="sr-mono sr-small">{preview.shareNative !== null ? fmtNativeUsdc(preview.shareNative) : '-'}</span>
                <span className="badge-unpaid">Unpaid</span>
              </div>
            ))
          )}
          <hr className="doc-rule" style={{ margin: '12px 0' }} />
          <div className="flex items-baseline justify-between">
            <span className="sr-small" style={{ color: 'var(--secondary)' }}>Total</span>
            <span className="sr-mono" style={{ fontWeight: 600 }}>
              {preview.total !== null ? fmtNativeUsdc(preview.total) : '-'} USDC
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
