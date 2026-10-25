import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { MAINNET, defaultDeployment } from '../src/networks.ts'
import { CONTRACT_EXPLORER_URL, EXAMPLE_PAYMENT_HASH, GITHUB_URL, PAYMENT_EXPLORER_URL, STUDIO_URL, VIDEO_URL } from '../src/components/home/links.ts'

const root = new URL('../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')
const homeFiles = ['src/components/Home.tsx', ...readdirSync(new URL('src/components/home/', root)).filter((f) => /\.tsx?$/.test(f)).map((f) => `src/components/home/${f}`)]
const homeSource = homeFiles.map((f) => read(f)).join('\n')
const css = read('src/home.css')

/** clamp(min, a + b*vw, max) in px for a viewport width, with 1rem = 16px. */
const h1At = (vw: number) => Math.min(72, Math.max(40, 1.6 * 16 + 0.042 * vw))

describe('homepage content and composition', () => {
  it('has the real headline, supporting copy and both calls to action in the hero', () => {
    const hero = read('src/components/home/Hero.tsx')
    assert.match(hero, /Split the bill\./)
    assert.match(hero, /Keep the proof\./)
    assert.match(hero, /Open app/)
    assert.match(hero, /View a settled bill/)
    assert.match(hero, /two to five people/)
  })

  it('has a real header: brand, three anchors, GitHub and the Open app action', () => {
    const header = read('src/components/home/HomeHeader.tsx')
    for (const a of ['#how-it-works', '#receipts', '#faq']) assert.match(header, new RegExp(a))
    for (const l of ['How it works', 'Receipts', 'FAQ', 'Open app', 'SplitReceipt']) assert.match(header, new RegExp(l))
    assert.match(header, /GITHUB_URL/)
  })

  it('every in-page anchor has a target section id', () => {
    const hrefs = [...homeSource.matchAll(/['"]#([a-z-]+)['"]/g)].map((m) => m[1])
    assert.ok(hrefs.length >= 5)
    const ids = new Set([...homeSource.matchAll(/\bid="([a-z-]+)"/g)].map((m) => m[1]))
    for (const h of hrefs) assert.ok(ids.has(h), `#${h} has a target`)
    for (const id of ['how-it-works', 'receipts', 'proof', 'faq', 'main', 'top']) assert.ok(ids.has(id), id)
  })

  it('the steps are one divided sequence of three with the create, pay-exact-share, inspect meaning', () => {
    const steps = read('src/components/home/Steps.tsx')
    assert.equal((steps.match(/n: '0\d'/g) ?? []).length, 3)
    assert.match(steps, /<ol className="sr-home-steps">/)
    assert.match(steps, /Create the bill/)
    assert.match(steps, /exact share/)
    assert.match(steps, /straight to the recipient/)
    assert.match(steps, /Inspect the receipts/)
    assert.doesNotMatch(steps, /doc-surface|rounded-/)
  })

  it('the capability section covers equal shares for 2-5 payers, payment progress and public verifiable receipts, and nothing invented', () => {
    const cap = read('src/components/home/Capabilities.tsx')
    assert.match(cap, /two to five payers/)
    assert.match(cap, /who has paid/)
    assert.match(cap, /verify/)
    assert.doesNotMatch(homeSource, /testimonial|customers? (?:use|love)|million|per cent|\d+% |volume|users?\b.*(?:trust|joined)|no fees?|zero fees?|free of charge/i)
  })

  it('the evidence section links only existing proof and is honest about what it is', () => {
    const proof = read('src/components/home/Proof.tsx')
    assert.match(proof, /Owner-operated, two accounts/)
    assert.match(proof, /0\.001 USDC per payer/)
    assert.match(proof, /Settled, 2 of 2 paid/)
    assert.match(proof, /not customer activity/)
    assert.match(proof, /no wallet/i)
    const deployment = defaultDeployment(MAINNET)
    assert.equal(CONTRACT_EXPLORER_URL, `${MAINNET.explorerBase}/address/${deployment.address}`)
    assert.equal(PAYMENT_EXPLORER_URL, `${MAINNET.explorerBase}/tx/${EXAMPLE_PAYMENT_HASH}`)
    assert.equal(EXAMPLE_PAYMENT_HASH, '0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5')
    assert.equal(GITHUB_URL, 'https://github.com/a252937166/splitreceipt')
    assert.equal(VIDEO_URL, 'https://youtu.be/b1t_0tOW3uk')
    assert.equal(STUDIO_URL, 'https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62')
  })

  it('the receipt illustration is labelled as illustrative and contains no address or transaction hash', () => {
    const ill = read('src/components/home/ReceiptIllustration.tsx')
    assert.match(ill, /Illustrative example/)
    assert.match(ill, /Not a real bill, payment or transaction/)
    assert.doesNotMatch(ill, /0x[0-9a-fA-F]{4,}/)
    assert.match(ill, /<svg/)
  })

  it('the FAQ is native details/summary and answers the required questions', () => {
    const faq = read('src/components/home/Faq.tsx')
    assert.match(faq, /<details/)
    assert.match(faq, /<summary>/)
    for (const q of ['Who pays what', 'Do I need a wallet', 'Is it real money', 'What can it not do']) assert.match(faq, new RegExp(q))
    assert.match(faq, /free test USDC/)
    assert.match(faq, /real USDC/)
    assert.match(faq, /equal/)
    assert.match(faq, /public onchain/)
  })

  it('every outside link opens in a new tab safely and says so to screen readers', () => {
    const ext = read('src/components/home/ExternalLink.tsx')
    assert.match(ext, /target="_blank"/)
    assert.match(ext, /rel="noopener noreferrer"/)
    assert.match(ext, /opens in a new tab/)
    assert.doesNotMatch(homeSource.replace(ext, ''), /target="_blank"/, 'only ExternalLink opens new tabs')
    for (const f of homeFiles) {
      if (f.endsWith('ExternalLink.tsx')) continue
      assert.doesNotMatch(read(f), /<a\s[^>]*href=\{?["'`]https?:/, `${f} uses ExternalLink for outside links`)
    }
  })

  it('has no private contact, no social handle and no external asset or font', () => {
    assert.doesNotMatch(homeSource, /@[a-z0-9-]+\.[a-z]{2,}|t\.me|discord|whatsapp|wechat|telegram|mailto:/i)
    assert.doesNotMatch(css, /@import|url\(\s*['"]?https?:|fonts\.googleapis|@font-face/)
    assert.doesNotMatch(homeSource, /<img\b|<link\b|<script\b/)
  })
})

describe('homepage stylesheet', () => {
  it('is a separate namespaced file; every class selector is sr-home-*', () => {
    const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\.[A-Za-z_][\w-]*/g) ?? []
    assert.ok(selectors.length > 100)
    for (const s of new Set(selectors)) assert.match(s, /^\.sr-home/, s)
    assert.doesNotMatch(read('src/index.css'), /sr-home/)
    assert.match(read('src/components/Home.tsx'), /import '\.\.\/home\.css'/)
  })

  it('the hero headline is 56-72px on tablet and desktop, 40px+ on a phone, and larger than any other heading', () => {
    assert.match(css, /\.sr-home-h1 \{[^}]*font-size: clamp\(2\.5rem, 1\.6rem \+ 4\.2vw, 4\.5rem\)/)
    assert.ok(h1At(375) >= 40 && h1At(375) < 48, String(h1At(375)))
    for (const vw of [768, 900, 1024, 1280, 1440]) assert.ok(h1At(vw) >= 56 && h1At(vw) <= 72, `${vw}: ${h1At(vw)}`)
    assert.equal(h1At(1440), 72)
    assert.doesNotMatch(read('src/components/home/Hero.tsx'), /sr-heading-xl/)
  })

  it('the supporting copy is 17-19px', () => {
    assert.match(css, /\.sr-home-lede \{[^}]*font-size: clamp\(1\.0625rem, 1rem \+ 0\.35vw, 1\.1875rem\)/)
  })

  it('primary actions are at least 44px tall and keyboard focus is not removed', () => {
    for (const sel of ['sr-home-btn', 'sr-home-link', 'sr-home-brand']) {
      const m = new RegExp(`\\.${sel} \\{[^}]*min-height: (\\d+)px`).exec(css)
      assert.ok(m && Number(m[1]) >= 44, `${sel} min-height`)
    }
    assert.match(css, /\.sr-home-btn--header \{[^}]*min-height: 44px/)
    assert.match(css, /\.sr-home-faqItem summary \{[^}]*min-height: 56px/)
    assert.doesNotMatch(css, /outline:\s*(none|0)/)
  })

  it('anchored sections clear the sticky header: 7rem on a phone, 5rem from 48rem, declared after the base rule', () => {
    const base = css.indexOf('.sr-home-section { padding-block')
    const wide = css.indexOf('@media (min-width: 48rem) { .sr-home-section { scroll-margin-top: 5rem; } }')
    assert.ok(base >= 0 && wide > base)
    assert.match(css.slice(base, base + 140), /scroll-margin-top: 7rem/)
  })

  it('adapts: stacked hero below 60rem, header and steps change at 48rem, and the page never forces horizontal scroll', () => {
    assert.match(css, /@media \(min-width: 60rem\)[\s\S]*?\.sr-home-hero__grid \{ grid-template-columns: minmax\(0, 1\.1fr\) minmax\(0, 0\.9fr\)/)
    assert.match(css, /@media \(min-width: 48rem\)[\s\S]*?\.sr-home-steps \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
    assert.match(css, /\.sr-home \{[^}]*overflow-x: clip/)
    assert.match(css, /@media \(max-width: 26rem\)/)
    assert.match(css, /prefers-reduced-motion: reduce/)
    // no fixed pixel width wider than a 375px phone's content box
    for (const m of css.matchAll(/(?<!min-|max-)width:\s*(\d+)px/g)) assert.ok(Number(m[1]) <= 343, `fixed width ${m[0]}`)
  })
})
