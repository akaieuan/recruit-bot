import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/ui'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-[7px] border font-medium transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-panel2 border-line2 text-fg hover:border-dim2',
        quiet: 'bg-panel border-line text-dim hover:text-fg hover:border-line2',
        approve: 'bg-interview/10 border-interview/40 text-interview hover:bg-interview/20',
        danger: 'bg-closed/10 border-closed/40 text-closed hover:bg-closed/20',
        ghost: 'border-transparent bg-transparent text-dim hover:text-fg hover:bg-panel',
      },
      size: {
        default: 'h-8 px-3 text-[12px]',
        sm: 'h-7 px-2.5 text-[11.5px]',
        lg: 'h-9 px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof button>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />
}

export { button as buttonVariants }
