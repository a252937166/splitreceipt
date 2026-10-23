/**
 * Arc Studio preview bridge (development only).
 *
 * The Studio Preview panel reads console output and optional RPC traces that
 * the framed app forwards with postMessage (`console-capture.ts`, `tracing.ts`).
 * Those modules patch `console`, `fetch` and the wallet provider's `request`,
 * so they must never reach a user-facing build:
 *
 *  - `main.tsx` calls `startStudioPreviewBridge` only inside `import.meta.env.DEV`,
 *    which is statically false in a production build, so this module and both
 *    instrumentation modules are removed from the bundle;
 *  - even in development nothing is loaded unless the page is framed AND is the
 *    Studio preview host (`*.preview.studio.arc.io`) or is framed by a Studio origin.
 *
 * Opening the dev server directly in a browser tab loads none of this.
 */

const STUDIO_HOST = /(^|\.)studio\.arc\.io$/i
const PREVIEW_HOST = /\.preview\.studio\.arc\.io$/i

function hostOf(origin: string | null | undefined): string | null {
  if (!origin) return null
  try {
    return new URL(origin).hostname
  } catch {
    return null
  }
}

export interface FrameFacts {
  framed: boolean
  ownHostname: string
  ancestorOrigin?: string | null
  referrer?: string | null
}

/** Pure decision, unit tested: is this the actual Studio preview frame? */
export function isStudioPreviewFrame(f: FrameFacts): boolean {
  if (!f.framed) return false
  if (PREVIEW_HOST.test(f.ownHostname)) return true
  const parent = hostOf(f.ancestorOrigin) ?? hostOf(f.referrer)
  return parent !== null && STUDIO_HOST.test(parent)
}

export function readFrameFacts(): FrameFacts {
  let ancestorOrigin: string | null = null
  try {
    ancestorOrigin = window.location.ancestorOrigins?.[0] ?? null
  } catch {
    ancestorOrigin = null
  }
  return {
    framed: window.self !== window.top,
    ownHostname: window.location.hostname,
    ancestorOrigin,
    referrer: document.referrer || null,
  }
}

export async function startStudioPreviewBridge(): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  if (!isStudioPreviewFrame(readFrameFacts())) return false
  await import('./console-capture.ts')
  await import('./tracing.ts')
  return true
}
