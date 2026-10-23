import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

export function shortHash(h: string): string {
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h
}

export function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 sr-small font-semibold"
      style={{ color: 'var(--primary)' }}
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  )
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn-ghost"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => {
            setDone(true)
            window.setTimeout(() => setDone(false), 1600)
          })
          .catch(() => setDone(false))
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />
}
