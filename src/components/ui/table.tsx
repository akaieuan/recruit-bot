import type { ComponentProps } from 'react'
import { cn } from '@/lib/ui'

/**
 * A narrow viewport gives a wide table two options and squashing is the wrong
 * one: a comp range broken over three lines stops being a comp range. So the
 * shell takes the horizontal scroll and the page body never does, and the
 * identity column stays pinned, because a row scrolled halfway across that no
 * longer says whose it is may as well not be on screen.
 */
export function TableShell({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('scroll-x rounded-panel border border-line', className)} {...props}>
      {children}
    </div>
  )
}

/**
 * Fixed layout, with every width declared on the header cell. Auto layout
 * decides column widths from content, which is why the same column is a
 * different width on every filter, and why truncation cannot be relied on.
 * `minWidth` is the sum of those widths: below it the table scrolls.
 */
export function Table({
  className,
  minWidth,
  ...props
}: ComponentProps<'table'> & { minWidth: number }) {
  return (
    <table
      style={{ minWidth: `${minWidth}px` }}
      className={cn('w-full table-fixed border-separate border-spacing-0 text-left', className)}
      {...props}
    />
  )
}

/** `group/row` so a pinned cell can pick up the hover its own background hides. */
export function TR({
  className,
  interactive,
  ...props
}: ComponentProps<'tr'> & { interactive?: boolean }) {
  return (
    <tr
      className={cn('group/row', interactive && 'transition-colors hover:bg-panel2', className)}
      {...props}
    />
  )
}

/* Pinned cells draw their own right edge: a collapsed border would scroll away
   with the columns it belongs to. */
const PINNED = 'sticky left-0 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-line'

export function TH({ className, pinned, ...props }: ComponentProps<'th'> & { pinned?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'eyebrow whitespace-nowrap border-b border-line bg-panel2 px-3 py-2.5 text-dim2',
        pinned && `${PINNED} z-20`,
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, pinned, ...props }: ComponentProps<'td'> & { pinned?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-line px-3 py-2.5 align-middle group-last/row:border-b-0',
        pinned && `${PINNED} z-10 bg-panel group-hover/row:bg-panel2`,
        className,
      )}
      {...props}
    />
  )
}
