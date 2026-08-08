'use client'

import { cn } from '@/lib/ui'
import { ChevronGlyph } from './primitives'

/**
 * The opening paragraph always shows and the rest sits in a native <details>,
 * so the sheet opens as a map of the conversation rather than an essay.
 *
 * <details> rather than React state because it expands with scripting off and
 * because "expand all" can then drive every section by setting one attribute.
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)

  const lede = paras[0]
  const rest = paras.slice(1)
  if (!lede) return null

  return (
    <div className={cn('max-w-[76ch]', className)}>
      <p className="text-[13px] leading-[1.68] text-dim">{lede}</p>

      {rest.length > 0 && (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[5px] py-1 pr-2 text-[11.5px] text-dim2 transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
            <ChevronGlyph className="size-3 transition-transform duration-150 group-open:rotate-90" />
            <span className="group-open:hidden">
              {rest.length} more paragraph{rest.length === 1 ? '' : 's'}
            </span>
            <span className="hidden group-open:inline">Collapse</span>
          </summary>
          <div className="mt-1 space-y-2.5">
            {rest.map((p, i) => (
              <p key={i} className="text-[13px] leading-[1.68] text-dim">
                {p}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
