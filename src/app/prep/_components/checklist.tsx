'use client'

import { cn } from '@/lib/ui'
import { CheckGlyph } from './primitives'

/**
 * Both of these are lists he works through: questions during the call, prep
 * before it. Ticking is the whole point, so the row is the hit target and the
 * count sits in the heading where he can see progress without counting.
 */

const ACCENT: Record<'interview' | 'applied', { box: string; label: string }> = {
  interview: { box: 'peer-checked:border-interview peer-checked:bg-interview', label: 'text-interview' },
  applied: { box: 'peer-checked:border-applied peer-checked:bg-applied', label: 'text-applied' },
}

export function Checklist({
  title,
  hint,
  items,
  checked,
  onToggle,
  onReset,
  accent,
  twoUp,
}: {
  title: string
  hint?: string
  items: string[]
  checked: readonly string[]
  onToggle: (item: string) => void
  onReset: () => void
  accent: keyof typeof ACCENT
  twoUp?: boolean
}) {
  const done = items.filter((i) => checked.includes(i)).length
  const tone = ACCENT[accent]

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
          {title}
          <span className={cn('tabular ml-2 text-[11px] font-normal', done > 0 ? tone.label : 'text-dim2')}>
            {done} of {items.length}
          </span>
        </h2>
        {done > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-dim2 transition-colors hover:text-fg"
          >
            Clear ticks
          </button>
        )}
      </div>

      {hint && <p className="mt-1 max-w-[76ch] text-[12px] text-dim2">{hint}</p>}

      <ul className={cn('mt-3 grid gap-1.5', twoUp && 'md:grid-cols-2 md:gap-x-3')}>
        {items.map((item) => {
          const on = checked.includes(item)
          return (
            <li key={item}>
              <label
                className={cn(
                  'flex h-full cursor-pointer items-start gap-2.5 rounded-[7px] border bg-panel px-3 py-2.5 transition-colors',
                  on ? 'border-line bg-panel/40' : 'border-line hover:border-line2 hover:bg-panel2/60',
                )}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => onToggle(item)}
                />
                <span
                  aria-hidden
                  className={cn(
                    'mt-px grid size-[15px] shrink-0 place-items-center rounded-[4px] border border-line2 text-transparent transition-colors peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-line2',
                    tone.box,
                  )}
                >
                  <CheckGlyph className="size-[9px]" />
                </span>
                <span
                  className={cn(
                    'text-[12.5px] leading-[1.55] transition-colors',
                    on ? 'text-dim2 line-through decoration-line2' : 'text-dim',
                  )}
                >
                  {item}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
