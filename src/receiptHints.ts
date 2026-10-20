/**
 * Receipt hint catalog and browser storage adapter.
 *
 * Hints are unverified candidates — every hash must be independently checked via
 * receiptDiscovery before being shown to the user. The catalog contains public
 * transaction hashes for known settled bills; they are NOT trusted receipts.
 *
 * Storage schema version: 1
 * Key:   "sr:hints:v1:<scopeKey>"           e.g. "sr:hints:v1:5042002:0x6996...:3"
 * Value: JSON array of up to MAX_STORED_HINTS lowercase 0x-prefixed hex strings
 *
 * Byte limits use UTF-8 byte counts (TextEncoder), not JS string length (UTF-16 code units).
 *
 * An overridden contract or different chain/bill will have a different scopeKey
 * and will never match another scope's catalog entry.
 */

import type { ReceiptScope } from './receiptHistory.ts'
import { receiptScopeKey } from './receiptHistory.ts'

export type HintHash = `0x${string}`

// ── Limits ───────────────────────────────────────────────────────────────────
export const MAX_HINTS_PER_SOURCE = 5         // per catalog / URL / storage source
export const MAX_TOTAL_CANDIDATES  = 15       // hard ceiling across all sources
export const MAX_STORED_BYTES      = 8_192    // localStorage value UTF-8 byte cap
export const STORAGE_VERSION       = 1

// ── UTF-8 byte length helper ──────────────────────────────────────────────────

/**
 * Returns the UTF-8 byte length of a string.
 * Uses TextEncoder when available (all modern browsers/Node 18+).
 * Falls back to a conservative estimate (3 bytes/char) on failure.
 */
function utf8ByteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length
  } catch {
    // Fallback: each JS char can be at most 3 UTF-8 bytes for the BMP,
    // or 4 bytes for supplementary chars (which are 2 JS code units).
    // Use 3× as a conservative safe over-estimate.
    return s.length * 3
  }
}

// ── Bundled public hint catalog ───────────────────────────────────────────────
// All entries are public testnet transaction hashes that must be reverified
// via a live RPC call before any are accepted as confirmed receipts.
// Keyed by "chainId:lowercaseContract:billId" — identical to receiptScopeKey().

const CONTRACT = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const CHAIN    = 5042002

const HINT_CATALOG: Readonly<Record<string, readonly HintHash[]>> = {
  [`${CHAIN}:${CONTRACT}:1`]: [
    '0x4736c401fc2a9757d21f6c09aa8de5550e8c9e76027475ce2fb63a7e3b176b54',
    '0xe1fba09d727a8eae598de8f794ac11b4fdfbfa188355805d492ffb856b598e25',
  ],
  [`${CHAIN}:${CONTRACT}:2`]: [
    '0xc1a18f3c1698d207ca6c247643175b0e1f958ea4719da4ccb5d5b751532a2b6a',
    '0x80d5b5c0c7d5941994eddd700587051d8f054c466a071afde5c7611ace315cb7',
  ],
  [`${CHAIN}:${CONTRACT}:3`]: [
    '0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4',
    '0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9',
  ],
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Returns true for a syntactically valid 0x-prefixed 64-hex-char hash string. */
export function isValidHintHash(raw: unknown): raw is HintHash {
  return typeof raw === 'string' && /^0x[0-9a-f]{64}$/i.test(raw)
}

/** Normalise to lowercase; returns null for invalid input. */
export function normaliseHash(raw: unknown): HintHash | null {
  if (!isValidHintHash(raw)) return null
  return raw.toLowerCase() as HintHash
}

// ── Catalog lookup ────────────────────────────────────────────────────────────

/** Returns up to MAX_HINTS_PER_SOURCE catalog hints for this exact scope, or []. */
export function catalogHintsForScope(scope: ReceiptScope): readonly HintHash[] {
  const key = receiptScopeKey(scope)
  const entry = HINT_CATALOG[key]
  if (!entry) return []
  return entry.slice(0, MAX_HINTS_PER_SOURCE)
}

// ── URL hint extraction ───────────────────────────────────────────────────────

/**
 * Extracts up to MAX_HINTS_PER_SOURCE valid hash strings from a ?receipts=
 * URL parameter.
 *
 * Applies a UTF-8 byte limit to the raw parameter value BEFORE any splitting
 * or JSON parsing. Malformed, oversized, or missing input returns [].
 * Does not inspect any other URL parameter.
 */
export function hintsFromUrl(search: string): readonly HintHash[] {
  try {
    const raw = new URLSearchParams(search).get('receipts')
    if (!raw) return []
    // Check UTF-8 byte size before splitting — prevents oversized URL attack surface.
    if (utf8ByteLength(raw) > MAX_STORED_BYTES) return []
    const parts = raw.split(',').slice(0, MAX_HINTS_PER_SOURCE * 2) // generous pre-filter
    const out: HintHash[] = []
    for (const part of parts) {
      const n = normaliseHash(part.trim())
      if (n && !out.includes(n)) {
        out.push(n)
        if (out.length >= MAX_HINTS_PER_SOURCE) break
      }
    }
    return out
  } catch {
    return []
  }
}

// ── localStorage adapter ──────────────────────────────────────────────────────

function storageKey(scope: ReceiptScope): string {
  return `sr:hints:v${STORAGE_VERSION}:${receiptScopeKey(scope)}`
}

/**
 * Load stored hint candidates for this scope.
 * Returns [] on any error (missing, invalid JSON, wrong version, wrong scope,
 * oversized UTF-8, blocked storage, etc.). Never throws.
 *
 * The MAX_STORED_BYTES check uses UTF-8 byte length, not JS string length.
 */
export function loadStoredHints(scope: ReceiptScope): readonly HintHash[] {
  try {
    const key = storageKey(scope)
    const raw = localStorage.getItem(key)
    if (!raw) return []
    // UTF-8 byte check — not JS string length (which counts UTF-16 code units).
    if (utf8ByteLength(raw) > MAX_STORED_BYTES) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: HintHash[] = []
    for (const item of parsed) {
      const n = normaliseHash(item)
      if (n && !out.includes(n)) {
        out.push(n)
        if (out.length >= MAX_HINTS_PER_SOURCE) break
      }
    }
    return out
  } catch {
    return []
  }
}

/**
 * Persist a list of verified receipt hashes as future candidates for this scope.
 * Silently ignores blocked / full storage and invalid input. Never throws.
 * At most MAX_HINTS_PER_SOURCE hashes are stored.
 * The serialised value must fit within MAX_STORED_BYTES (UTF-8 bytes).
 */
export function saveVerifiedHints(scope: ReceiptScope, hashes: readonly HintHash[]): void {
  try {
    const valid: HintHash[] = []
    for (const h of hashes) {
      const n = normaliseHash(h)
      if (n && !valid.includes(n)) {
        valid.push(n)
        if (valid.length >= MAX_HINTS_PER_SOURCE) break
      }
    }
    if (valid.length === 0) return
    const value = JSON.stringify(valid)
    // UTF-8 byte check before writing.
    if (utf8ByteLength(value) > MAX_STORED_BYTES) return
    localStorage.setItem(storageKey(scope), value)
  } catch {
    // blocked or full storage — degrade silently
  }
}

// ── Candidate assembly ────────────────────────────────────────────────────────

/**
 * Assemble an ordered, deduplicated candidate list from all sources:
 *   1. Bundled public catalog (highest priority — known historical bills)
 *   2. Prior in-RAM hashes (history/session from prior run — untrusted candidates)
 *      Merged case-insensitively after catalog, capped at MAX_HINTS_PER_SOURCE.
 *      Placed before URL so they cannot be truncated by a full base list.
 *   3. Browser storage (return visits and post-payment persistence)
 *   4. URL parameter (freshly shared link)
 *
 * Returns at most MAX_TOTAL_CANDIDATES unique lowercase hashes.
 * Each source contributes at most MAX_HINTS_PER_SOURCE entries.
 * The scope check is implicit: catalog uses receiptScopeKey, storage uses
 * the scoped key, and URL hints are scope-agnostic (verified later).
 *
 * @param priorHashes Optional untrusted prior-RAM hashes (history/session for this scope).
 *   Normalised, deduplicated, and capped at MAX_HINTS_PER_SOURCE. NOT verified — must
 *   go through discoverReceiptsFromHints before any copy/cache/verified-count use.
 */
export function assembleCandidates(
  scope: ReceiptScope,
  urlSearch: string,
  priorHashes?: readonly HintHash[],
): readonly HintHash[] {
  const seen = new Set<string>()
  const out: HintHash[] = []

  function add(hashes: readonly HintHash[], cap = MAX_HINTS_PER_SOURCE) {
    let added = 0
    for (const h of hashes) {
      const n = normaliseHash(h)
      if (n && !seen.has(n) && out.length < MAX_TOTAL_CANDIDATES && added < cap) {
        seen.add(n)
        out.push(n)
        added++
      }
    }
  }

  add(catalogHintsForScope(scope))

  // Middle source: merge prior RAM hashes (prior-first) with stored hints into ONE
  // array capped at MAX_HINTS_PER_SOURCE (5). Placed between catalog and URL so a
  // full catalog cannot truncate them and they cannot displace URL hints.
  // Normalise + deduplicate across both inputs before the single add() call.
  const middleSeen = new Set<string>()
  const middle: HintHash[] = []
  for (const raw of [...(priorHashes ?? []), ...loadStoredHints(scope)]) {
    const n = normaliseHash(raw)
    if (n && !middleSeen.has(n) && middle.length < MAX_HINTS_PER_SOURCE) {
      middleSeen.add(n)
      middle.push(n)
    }
  }
  add(middle)

  add(hintsFromUrl(urlSearch))

  return out
}

// ── Copy-link URL builder ─────────────────────────────────────────────────────

/**
 * Build a shareable bill URL that includes the verified paid receipt hashes.
 * Strips any existing ?receipts parameter, then appends at most MAX_HINTS_PER_SOURCE
 * verified confirmed hashes for the current bill only.
 *
 * Deduplication is case-insensitive (all hashes are normalised to lowercase).
 * At most 5 unique hashes are included regardless of input length.
 * Existing ?bill= is preserved.
 */
export function buildShareUrl(
  billId: bigint,
  verifiedHashes: readonly HintHash[],
): string {
  const url = new URL(window.location.href)
  url.searchParams.set('bill', billId.toString())
  url.searchParams.delete('receipts')

  // Case-insensitive dedup: normalise all to lowercase, then deduplicate, then slice.
  const seen = new Set<string>()
  const hints: HintHash[] = []
  for (const h of verifiedHashes) {
    const n = normaliseHash(h)
    if (n && !seen.has(n) && hints.length < MAX_HINTS_PER_SOURCE) {
      seen.add(n)
      hints.push(n)
    }
  }

  if (hints.length > 0) {
    url.searchParams.set('receipts', hints.join(','))
  }
  return url.toString()
}
