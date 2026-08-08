import type { ReactNode } from 'react'
import { cn } from '@/lib/ui'

/**
 * A table floating under a row of chips does not say what it is a table of.
 * This is the line that says it: the label, the count, and whatever acts on
 * the set sitting on the right of the same baseline.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow text-dim2">{eyebrow}</div>}
        <h2 className="mt-2 text-[17px] font-normal tracking-[-0.02em] text-fg">{title}</h2>
        {description && <p className="mt-1 max-w-[68ch] text-[12.5px] text-dim">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

/** An empty view should say what would put something in it. */
export function EmptyState({
  title,
  hint,
  command,
}: {
  title: string
  hint?: string
  command?: string
}) {
  return (
    <div className="rounded-panel border border-dashed border-line bg-panel/50 px-6 py-12 text-center">
      <p className="text-[13.5px] text-fg">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-[46ch] text-[12.5px] text-dim">{hint}</p>}
      {command && (
        <code className="mt-4 inline-block rounded-chip border border-line bg-panel2 px-2.5 py-1.5 font-mono text-[11.5px] text-dim2">
          {command}
        </code>
      )}
    </div>
  )
}
