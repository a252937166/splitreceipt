import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    // The provider moved out of the entry into the lazy app side; the policy follows it.
    assert.match(read('src/AppRoot.tsx'), /reconnectOnMount=\{false\}/)
    assert.doesNotMatch(read('src/main.tsx'), /WagmiProvider/)
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

describe('the bare homepage has no static path to any wallet, chain or provider code', () => {
  const rootPath = fileURLToPath(root)
  const BANNED_PACKAGES = /^(wagmi|viem|@wagmi\/|@tanstack\/|sonner|connectkit|@circle-fin\/|mipd)/
  const BANNED_FILES = [
    'src/config.ts', 'src/AppRoot.tsx', 'src/App.tsx', 'src/walletSend.ts', 'src/writeGuard.ts',
    'src/wallet/WalletSession.tsx', 'src/wallet/WalletMenu.tsx',
  ]

  const staticImports = (code: string): string[] => {
    const noComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const out: string[] = []
    const re = /import\s+(?!type\b)(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]/g
    for (let m = re.exec(noComments); m; m = re.exec(noComments)) out.push(m[1])
    return out
  }
  const resolveLocal = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : normalize(join(dirname(from), spec))
    for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (/\.(ts|tsx)$/.test(c) && existsSync(join(rootPath, c))) return c
    }
    return null
  }
  const closure = (entry: string) => {
    const seen = new Set<string>()
    const packages = new Set<string>()
    const walk = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      for (const spec of staticImports(read(file))) {
        if (spec.startsWith('.') || spec.startsWith('@/')) {
          const next = resolveLocal(file, spec)
          if (next) walk(next)
        } else packages.add(spec)
      }
    }
    walk(entry)
    return { files: [...seen].sort(), packages: [...packages].sort() }
  }

  it('main.tsx reaches the homepage, the router and the route helpers, and nothing wallet-related', () => {
    const { files, packages } = closure('src/main.tsx')
    for (const f of ['src/Entry.tsx', 'src/components/Home.tsx', 'src/homeRoute.ts', 'src/networks.ts']) assert.ok(files.includes(f), `${f} should be reachable`)
    for (const f of BANNED_FILES) assert.ok(!files.includes(f), `${f} must not be statically reachable from the entry`)
    for (const p of packages) assert.ok(!BANNED_PACKAGES.test(p), `entry closure imports ${p}`)
    for (const f of files) assert.doesNotMatch(read(f), /\bEIP-?6963\b|eip6963:|announceProvider|window\.ethereum/i, f)
  })

  it('the app side is reached only through one lazy import, requested only for an app address', () => {
    const entry = read('src/Entry.tsx')
    assert.equal((entry.match(/import\(\s*['"]\.\/AppRoot['"]\s*\)/g) ?? []).length, 1)
    assert.match(entry, /lazy\(\(\) => import\('\.\/AppRoot'\)\)/)
    assert.match(entry, /appSearch !== null &&/)
    // nothing else may import the app side statically
    for (const f of sourceFiles()) {
      if (f === 'src/Entry.tsx') continue
      assert.doesNotMatch(read(f), /from\s+['"]\.\/?(\.\/)?AppRoot['"]/, f)
    }
  })

  it('the wallet config and provider live only on the app side', () => {
    const appRoot = read('src/AppRoot.tsx')
    assert.match(appRoot, /WagmiProvider config=\{config\} reconnectOnMount=\{false\}/)
    const importers = sourceFiles().filter((f) => /from\s+['"](\.\.?\/)+config(\.ts)?['"]/.test(read(f)))
    for (const f of importers) assert.ok(['src/AppRoot.tsx'].includes(f) || f.startsWith('src/wallet/') || f.startsWith('src/components/') || f.startsWith('src/hooks/'), f)
  })

  it('a built entry chunk (when present) has no wallet discovery, wagmi or send code; that code is in the lazy chunk', () => {
    const dist = new URL('dist/', root)
    if (!existsSync(new URL('index.html', dist))) return
    const html = readFileSync(new URL('index.html', dist), 'utf8')
    const entrySrc = /<script[^>]+src="[^"]*\/(assets\/[^"]+\.js)"/.exec(html)?.[1]
    assert.ok(entrySrc, 'index.html names an entry script')
    const entry = readFileSync(new URL(entrySrc, dist), 'utf8')
    for (const marker of ['eip6963', 'requestProvider', 'announceProvider', 'eth_sendTransaction', 'wagmi']) {
      assert.ok(!entry.includes(marker), `entry chunk has ${marker}`)
    }
    assert.doesNotMatch(html, /rel="modulepreload"[^>]*AppRoot/, 'the app chunk is not preloaded by the page')
    const lazy = readdirSync(new URL('assets/', dist)).find((n) => /^AppRoot-.*\.js$/.test(n))
    assert.ok(lazy, 'the app side is a separate chunk')
    assert.ok(readFileSync(new URL(`assets/${lazy}`, dist), 'utf8').includes('requestProvider'))
  })
})
