import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'

const root = new URL('../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')
const sourceFiles = (): string[] => {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}${e.name}/`)
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(`${dir}${e.name}`)
    }
  }
  walk('src/')
  return out
}

describe('the entry ships no wallet or fetch instrumentation', () => {
  it('main.tsx never imports the capture or tracing modules itself', () => {
    const main = read('src/main.tsx')
    assert.doesNotMatch(main, /console-capture|tracing/)
    assert.doesNotMatch(main, /^\s*import\s+['"]\.\/studio-preview/m, 'no static import of the bridge')
  })

  it('the Studio preview bridge is loaded only inside import.meta.env.DEV', () => {
    const main = read('src/main.tsx')
    const loads = main.match(/import\(\s*['"]\.\/studio-preview\.ts['"]\s*\)/g) ?? []
    assert.equal(loads.length, 1)
    const guard = main.indexOf('if (import.meta.env.DEV)')
    assert.ok(guard >= 0 && main.indexOf(loads[0]) > guard)
    // nothing before the guard may reference the bridge
    assert.ok(!main.slice(0, guard).includes('studio-preview'))
  })

  it('the bridge is the only importer of the instrumentation, always dynamically, DEV-guarded', () => {
    const bridge = read('src/studio-preview.ts')
    assert.match(bridge, /if \(!import\.meta\.env\.DEV\) return false/)
    assert.ok(bridge.indexOf('import.meta.env.DEV') < bridge.indexOf("import('./console-capture.ts')"))
    assert.ok(bridge.indexOf('isStudioPreviewFrame(readFrameFacts())') < bridge.indexOf("import('./console-capture.ts')"))
    assert.doesNotMatch(bridge, /^\s*import\s+['"]\.\/(console-capture|tracing)/m)
    for (const f of sourceFiles()) {
      if (['src/console-capture.ts', 'src/tracing.ts', 'src/studio-preview.ts', 'src/main.tsx'].includes(f)) continue
      assert.doesNotMatch(read(f), /console-capture|\/tracing|studio-preview/, f)
    }
  })

  it('the application source never patches fetch or window.ethereum', () => {
    for (const f of sourceFiles()) {
      if (f === 'src/console-capture.ts' || f === 'src/tracing.ts') continue
      const code = read(f)
      assert.doesNotMatch(code, /(globalThis|window)\.fetch\s*=/, f)
      assert.doesNotMatch(code, /window\.ethereum/, f)
      assert.doesNotMatch(code, /postMessage\(\s*\{\s*type:\s*'studio-/, f)
    }
  })

  it('a built bundle (when present) contains no trace, console-capture or bridge markers', () => {
    const dist = new URL('dist/assets/', root)
    if (!existsSync(dist)) return
    const files = readdirSync(dist).filter((n) => n.endsWith('.js'))
    assert.ok(files.length > 0)
    for (const f of files) {
      const code = readFileSync(new URL(f, dist), 'utf8')
      for (const marker of ['studio-trace-event', 'studio-console-log', 'studio-trace-config', 'preview.studio.arc.io', 'startStudioPreviewBridge']) {
        assert.ok(!code.includes(marker), `${f} has ${marker}`)
      }
    }
  })
})

describe('wallet connection policy', () => {
  it('has no targetless injected connector and never reconnects automatically', () => {
    const config = read('src/config.ts')
    assert.doesNotMatch(config, /injected\s*\(/)
    assert.doesNotMatch(config, /from\s+['"]wagmi\/connectors['"]/)
    assert.match(config, /multiInjectedProviderDiscovery:\s*true/)
    assert.match(config, /storage:\s*null/)
    assert.match(read('src/main.tsx'), /reconnectOnMount=\{false\}/)
  })

  it('no source calls reconnect or connects without an explicit connector', () => {
    for (const f of sourceFiles()) {
      if (f === 'src/console-capture.ts' || f === 'src/tracing.ts') continue
      const code = read(f)
      assert.doesNotMatch(code, /useReconnect|reconnect\(/, f)
      assert.doesNotMatch(code, /connectAsync\(\s*\)/, f)
    }
  })
})
