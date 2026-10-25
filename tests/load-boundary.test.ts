import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { CommitMarker, LoadBoundary, classifyFailure } from '../src/loadBoundary.tsx'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

/** All React elements in a rendered tree (no renderer needed: the class's render() returns plain elements). */
function elements(node: ReactNode): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(elements)
  const el = node as { type?: unknown; props?: Record<string, unknown> }
  if (!el.props) return []
  return [{ type: el.type, props: el.props }, ...elements(el.props.children as ReactNode)]
}
const textOf = (node: ReactNode): string =>
  !node ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'object' && 'props' in node ? textOf((node as { props: { children?: ReactNode } }).props.children) : ''

function failedBoundary(committed: boolean, reload: () => void) {
  const flag = { current: committed }
  const b = new LoadBoundary({ children: createElement('span', null, 'app'), committed: flag, reload } as never)
  b.state = LoadBoundary.getDerivedStateFromError()
  return { b, flag }
}

describe('first-load failure versus failure after the app committed', { timeout: 20_000 }, () => {
  it('classifies by whether the app ever committed', () => {
    assert.equal(classifyFailure(false), 'first-load')
    assert.equal(classifyFailure(true), 'after-commit')
  })

  it('before the app committed: an accessible alert with an explicit "Reload latest version" button, and no reload by itself', () => {
    let reloads = 0
    const { b } = failedBoundary(false, () => { reloads++ })
    const tree = b.render()
    const els = elements(tree)
    const alert = els.find((e) => e.props.role === 'alert')
    const button = els.find((e) => e.type === 'button')
    assert.ok(alert, 'announced to assistive technology')
    assert.ok(button, 'there is a button')
    assert.equal(button!.props.type, 'button')
    assert.match(textOf(tree as ReactNode), /Reload latest version/)
    assert.equal(reloads, 0, 'rendering (and any lifecycle) never reloads')
    ;(button!.props.onClick as () => void)()
    assert.equal(reloads, 1, 'only the user clicking the button reloads, once')
  })

  it('the default reload keeps the exact address: location.reload() with no argument, never a navigation to a new URL', () => {
    const src = read('src/loadBoundary.tsx')
    assert.match(src, /window\.location\.reload\(\)/)
    assert.doesNotMatch(src, /location\.(href|assign|replace)\s*[=(]/)
  })

  it('after the app committed: a later failure shows NO reload action and does not claim a submitted lock survives a reload', () => {
    let reloads = 0
    const { b } = failedBoundary(true, () => { reloads++ })
    const tree = b.render()
    const els = elements(tree)
    assert.equal(els.some((e) => e.type === 'button'), false)
    assert.ok(els.some((e) => e.props.role === 'alert'))
    const text = textOf(tree as ReactNode)
    assert.doesNotMatch(text, /Reload latest version/)
    assert.doesNotMatch(text, /\b(will be kept|is kept|survive[sd]?|stays|remain[s]? (held|locked))\b/i)
    assert.match(text, /cannot promise/)
    assert.equal(reloads, 0)
  })

  it('the first-load message does not mention locks or promise anything about in-memory state', () => {
    const { b } = failedBoundary(false, () => {})
    assert.doesNotMatch(textOf(b.render() as ReactNode), /lock|survive|kept/i)
  })

  it('a boundary that has not failed renders its children untouched (no remount, no reset)', () => {
    const child = createElement('span', null, 'app')
    const b = new LoadBoundary({ children: child, committed: { current: false } } as never)
    assert.equal(b.render(), child)
  })

  it('the commit marker marks only from an effect (after commit): rendering it alone, as a fallback would, marks nothing', () => {
    const flag = { current: false }
    renderToString(createElement(CommitMarker, { committed: flag }))
    assert.equal(flag.current, false)
  })
})

describe('where the marker lives and what never exists', { timeout: 20_000 }, () => {
  const entry = read('src/Entry.tsx')

  it('CommitMarker is a sibling of AppRoot inside the resolved Suspense content, never in the fallback', () => {
    const suspense = entry.slice(entry.indexOf('<Suspense'), entry.indexOf('</Suspense>'))
    const fallbackStart = suspense.indexOf('fallback={')
    const contentStart = suspense.indexOf('<ReadActivationContext.Provider')
    assert.ok(fallbackStart >= 0 && contentStart > fallbackStart)
    assert.doesNotMatch(suspense.slice(fallbackStart, contentStart), /CommitMarker/)
    assert.match(suspense.slice(contentStart), /<AppRoot[\s\S]*<CommitMarker committed=\{committed\} \/>/)
  })

  it('the monotonic flag is a ref created once in Entry and passed to both the boundary and the marker; nothing resets it', () => {
    assert.match(entry, /const committed = useRef\(false\)/)
    assert.match(entry, /<LoadBoundary committed=\{committed\}>/)
    assert.doesNotMatch(entry, /committed\.current\s*=\s*false/)
    assert.doesNotMatch(read('src/loadBoundary.tsx'), /committed\.current\s*=\s*false/)
  })

  it('there is no automatic reload anywhere: no preload-error handler, no timed or load-time reload', () => {
    const walk = (dir: string): string[] =>
      readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap((n) => {
        const rel = `${dir}/${n}`
        return statSync(new URL(`../${rel}`, import.meta.url)).isDirectory() ? walk(rel) : [rel]
      })
    for (const f of walk('src').filter((x) => /\.(ts|tsx)$/.test(x))) {
      const s = read(f)
      assert.doesNotMatch(s, /vite:preloadError/, f)
      if (f !== 'src/loadBoundary.tsx') assert.doesNotMatch(s, /location\.reload\(/, f)
    }
    const boundary = read('src/loadBoundary.tsx')
    assert.equal((boundary.match(/window\.location\.reload\(\)/g) ?? []).length, 1, 'one call site, inside the click handler')
    assert.doesNotMatch(boundary, /setTimeout|setInterval|componentDidCatch|componentDidMount|useEffect\([^)]*reload/)
    assert.match(boundary, /private readonly onReload = \(\) => \{/)
  })

  it('the homepage still keeps a held app mounted: Entry has no key and no reset on the boundary', () => {
    assert.doesNotMatch(entry, /\bkey=\{/)
    assert.match(entry, /<div hidden=\{home\}>/)
  })
})

describe('no external font service', { timeout: 20_000 }, () => {
  it('the page loads no Google Fonts stylesheet or preconnect, and the active CSS uses local stacks only', () => {
    const html = read('index.html')
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|rel="preconnect"|rel="stylesheet"/)
    const css = read('src/index.css')
    assert.doesNotMatch(css, /DM Sans|JetBrains|@import|@font-face|url\(\s*['"]?https?:/)
    assert.match(css, /font-family: 'Avenir Next', 'Avenir', system-ui/)
    assert.match(css, /font-family: ui-monospace/)
    assert.doesNotMatch(read('src/home.css'), /DM Sans|JetBrains|@import|@font-face|https?:/)
  })
})
