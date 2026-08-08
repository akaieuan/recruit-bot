import type { ComponentProps } from 'react'
import { cn } from '@/lib/ui'

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-line bg-panel2 px-1.5 py-0.5 text-[11px] leading-[1.45] text-dim',
        className,
      )}
      {...props}
    />
  )
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('size-[7px] shrink-0 rounded-full', className)} />
}
