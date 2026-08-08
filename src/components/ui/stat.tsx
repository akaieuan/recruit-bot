import Link from 'next/link'
import { cn } from '@/lib/ui'

/**
 * A headline number. Not a chart: one value, its name, and optionally what it
 * means. Numbers wear text tokens; the accent is a hairline, so the tile reads
 * as information rather than as a warning.
 */
export function Stat({
  label,
  value,
  hint,
  href,
  accent,
  emphasis,
}: {
  label: string
  value: number | string
  hint?: string
  href?: string
  accent?: string
  emphasis?: boolean
}) {
  const body = (
    <>
      <span
        className={cn('absolute inset-x-0 top-0 h-px', accent ?? 'bg-line2')}
        aria-hidden
      />
      <span className="eyebrow text-dim2">{label}</span>
      <span
        className={cn(
          'tabular mt-2 block text-[26px] font-semibold leading-none tracking-[-0.02em]',
          emphasis ? 'text-fg' : 'text-fg',
        )}
      >
        {value}
      </span>
      {hint && <span className="mt-1.5 block text-[11.5px] leading-snug text-dim">{hint}</span>}
    </>
  )

  const className = cn(
    'relative block overflow-hidden rounded-[8px] border border-line bg-panel px-3.5 py-3 transition-colors',
    href && 'hover:border-line2 hover:bg-panel2',
  )

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
}
