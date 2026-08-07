import type { ComponentProps } from 'react'
import { cn } from '@/lib/ui'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] border border-line bg-panel2 px-2 py-0.5 text-[11px] text-dim',
        className,
      )}
      {...props}
    />
  )
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('size-[7px] shrink-0 rounded-full', className)} />
}
