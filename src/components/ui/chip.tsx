import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/ui'

export function ChipRow({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center gap-1.5', className)} {...props} />
}

const base =
  'group inline-flex items-center gap-2 rounded-chip border px-2.5 py-1.5 text-[12px] leading-none transition-colors'

const tone = (selected?: boolean) =>
  selected
    ? 'border-line2 bg-panel2 text-fg'
    : 'border-line bg-panel text-dim hover:border-line2 hover:bg-panel2 hover:text-fg'

/**
 * One filter control for both views. The count is part of the chip rather than
 * a separate line, so choosing a filter and knowing what it costs is one read.
 */
export function Chip({
  href,
  selected,
  leading,
  count,
  children,
  className,
}: {
  href: string
  selected?: boolean
  leading?: ReactNode
  count?: number
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      className={cn(base, tone(selected), className)}
    >
      {leading}
      <span className="whitespace-nowrap">{children}</span>
      {count !== undefined && (
        <span className={cn('tabular text-[11px] font-medium', selected ? 'text-fg' : 'text-dim2')}>
          {count}
        </span>
      )}
    </Link>
  )
}

/** The same chip as a toggle, for filters that are state rather than a route. */
export function ChipButton({
  selected,
  className,
  children,
  ...props
}: ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(base, tone(selected), 'cursor-pointer', className)}
      {...props}
    >
      {children}
    </button>
  )
}
