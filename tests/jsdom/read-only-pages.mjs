// Optional DOM-level checks (jsdom, real RPC reads, fake EIP-1193 wallet). jsdom is NOT a project
// dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/<file>.mjs
// This is not a real browser. It runs React effects, events and focus in a simulated DOM only.
import { boot, sleep } from './harness.mjs'
const search = process.argv[2] ?? ''
const app = await boot({ search })
await sleep(Number(process.argv[3] ?? 12000))
console.log('TEXT:', app.text().slice(0, 1500))
console.log('ERRORS:', app.errors.length, app.errors.slice(0, 5))
await app.stop(); process.exit(0)
