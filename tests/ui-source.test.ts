import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')
const sources = (): string[] => {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(new URL(d, root), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${d}${e.name}/`)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(`${d}${e.name}`)
    }
  }
  walk('src/')
  return out.filter((f) => !['src/console-capture.ts', 'src/tracing.ts'].includes(f))
}

describe('wallet requests never go through a library path that awaits after the last check', () => {
  it('no source uses wagmi writeContract / useWriteContract / useSendTransaction', () => {
    for (const f of sources()) {
      const code = read(f)
      assert.doesNotMatch(code, /useWriteContract|writeContractAsync|useSendTransaction|sendTransactionAsync|from\s+['"]@wagmi\/core['"]/, f)
    }
  })
  it('both components send only through sendFrozenCall behind guardedWrite', () => {
    for (const f of ['src/components/CreateBill.tsx', 'src/components/BillDetails.tsx']) {
      const code = read(f)
      assert.match(code, /guardedWrite\(/, f)
      assert.match(code, /sendFrozenCall\(/, f)
      assert.match(code, /freeze(CreateBill|PayShare)\(/, f)
    }
  })
  it('the viem transport used for sends has retries disabled and wraps the acknowledged provider only', () => {
    const code = read('src/walletSend.ts')
    assert.match(code, /retryCount: 0/)
    assert.doesNotMatch(code, /window\.ethereum|globalThis\.ethereum/)
  })
})

describe('success is never claimed from receipt.status alone', () => {
  it('BillDetails and CreateBill have no waitForTransactionReceipt-then-toast path', () => {
    for (const f of ['src/components/CreateBill.tsx', 'src/components/BillDetails.tsx']) {
      const code = read(f)
      assert.doesNotMatch(code, /waitForTransactionReceipt/, f)
      assert.doesNotMatch(code, /Payment confirmed/, f)
      assert.match(code, /settle(Create|Pay)\(/, f)
    }
  })
  it('the success toast only follows a verified settlement', () => {
    const code = read('src/components/BillDetails.tsx')
    const toastAt = code.indexOf('toast.success')
    const verifiedAt = code.indexOf("result.kind === 'verified'")
    assert.ok(verifiedAt > 0 && toastAt > verifiedAt)
    assert.doesNotMatch(code, /status === 'success'/)
  })
})

describe('mobile header (375px and 390px) is structurally two rows with no fixed wide children', () => {
  const app = read('src/App.tsx')
  const menu = read('src/wallet/WalletMenu.tsx')
  it('wraps: brand and wallet share the first row, the network choice takes the second', () => {
    assert.match(app, /flex-wrap/)
    assert.match(app, /order-2 ml-auto/)
    assert.match(app, /order-3 flex w-full min-w-0/)
    assert.match(app, /flex-1 justify-center sm:flex-none/)
  })
  it('network choices and the wallet trigger are touch targets', () => {
    assert.match(app, /touch-target min-w-0 flex-1/)
    assert.match(menu, /btn-wallet touch-target max-w-full/)
  })
  it('the wallet dialog is capped to the viewport and scrolls instead of overflowing', () => {
    assert.match(menu, /w-\[min\(20rem,calc\(100vw-2rem\)\)\]/)
    assert.match(menu, /maxHeight: 'calc\(100dvh - 5rem\)'/)
    assert.match(menu, /overflowY: 'auto'/)
  })
  it('responsive display utilities are never combined with a component class that sets display', () => {
    // index.css (protected) defines .badge-draft/.btn-ghost/etc. AFTER the utilities, so `hidden` on them would not apply.
    const displayClasses = ['badge-draft', 'badge-network', 'btn-ghost', 'btn-wallet', 'btn-primary', 'alert-warn']
    for (const code of [app, menu]) {
      for (const m of code.matchAll(/className=\{?[`"']([^`"']*)[`"']/g)) {
        const cls = m[1]
        if (!/(^|\s)(hidden|sm:hidden)(\s|$)/.test(cls)) continue
        for (const c of displayClasses) assert.ok(!cls.includes(c), `"${cls}" mixes hidden with ${c}`)
      }
    }
  })
})

describe('invalid context footer makes no network claim', () => {
  const app = read('src/App.tsx')
  it('says no network was validated when the context is invalid, and never mentions free test USDC there', () => {
    assert.match(app, /No network or contract was validated for this link/)
    const footer = app.slice(app.indexOf('<footer'))
    const invalidBranch = footer.slice(footer.indexOf(': \'No network'))
    assert.ok(!invalidBranch.slice(0, 160).includes('free test USDC'))
    // the testnet claim is only inside the validated-context branch
    assert.match(footer, /context\s*\?\s*`\$\{context\.network\.realFunds \?/)
  })
  it('mainnet-facing error copy never says test USDC', () => {
    for (const f of ['src/components/CreateBill.tsx', 'src/components/BillDetails.tsx']) {
      assert.doesNotMatch(read(f), /test USDC/, f)
    }
  })
})

describe('round-2 UI source guards', () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  it('Start over / Dismiss controls that unlocked a second write are gone; Check again remains', () => {
    for (const f of ['src/components/CreateBill.tsx', 'src/components/BillDetails.tsx']) {
      const src = read(f)
      assert.ok(!/Start over|Dismiss/.test(src), `${f} must not offer a way to discard a submitted intent`)
      assert.ok(/Check again/.test(src), `${f} keeps the read-only recovery`)
      assert.ok(/SubmissionLock/.test(src) && /lock\.held/.test(src) && /lock\.hold\(/.test(src) && /lock\.reconcile\(/.test(src))
    }
  })
  it('the receipt retry stays enabled while candidates are unresolved', () => {
    const src = read('src/components/BillDetails.tsx')
    assert.ok(/Retry receipt check/.test(src))
    assert.ok(/disabled=\{rec\.scanning \|\| rec\.historyDone\}/.test(src))
    const ctl = read('src/receiptController.ts')
    assert.ok(/exhausted: this\.exhausted && this\.carry\.length === 0/.test(ctl))
  })
})
