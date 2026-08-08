import Link from 'next/link'
import { cn } from '@/lib/ui'
import { Dot } from '@/components/ui/badge'

/**
 * A headline number. Not a chart: one value, its name, and what it means.
 *
 * The tiles share one bordered strip rather than sitting as five separate
 * cards, so a row that reflows to two columns still reads as one instrument
 * instead of leaving a widow tile hanging off the end.
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
  const idle = value === 0 || value === '0'

  const body = (
    <>
      {/* Emphasis is the accent spent as a state, not as trim: it marks the one
          tile that is asking for something today. */}
      {emphasis && !idle && (
        <span className={cn('pointer-events-none absolute inset-0 opacity-[0.055]', accent)} aria-hidden />
      )}
      <span className="relative flex items-center gap-2">
        <Dot className={cn('size-[6px]', idle ? 'bg-dim2/50' : (accent ?? 'bg-dim2'))} />
        <span className="eyebrow text-dim2">{label}</span>
      </span>
      <span
        className={cn(
          'tabular relative mt-3 block text-[30px] font-light leading-none tracking-[-0.03em]',
          idle ? 'text-dim2' : 'text-fg',
        )}
      >
        {value}
      </span>
      {hint && <span className="relative mt-2 block text-[11.5px] leading-snug text-dim">{hint}</span>}
    </>
  )

  const className = cn(
    'relative -ml-px -mt-px block border-l border-t border-line px-4 py-3.5 transition-colors',
    href && 'hover:bg-panel2',
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
  return (
    <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-panel sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  )
}
