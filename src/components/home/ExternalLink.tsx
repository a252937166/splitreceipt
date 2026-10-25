import type { ReactNode } from 'react'

/** An outside link: opens in a new tab, never passes the opener, and says so to screen readers. */
export default function ExternalLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
