import type { ComponentProps } from 'react'
import { cn } from '@/lib/ui'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-[8px] border border-line bg-panel', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-[13.5px] font-semibold tracking-[-0.01em] text-fg', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-4 py-3', className)} {...props} />
}

export function Eyebrow({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('eyebrow text-dim2', className)} {...props} />
}
