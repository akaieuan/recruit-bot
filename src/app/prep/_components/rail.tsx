'use client'

import { cn } from '@/lib/ui'

export interface RailItem {
  id: string
  label: string
  note?: string
}

/**
 * The map of the sheet, and the only way to move around it during a call. A
 * column on the left where there is room; a scrolling strip pinned to the top
 * where there is not.
 */
export function Rail({
  items,
  active,
  onJump,
  expanded,
  onToggleAll,
}: {
  items: RailItem[]
  active: string
  onJump: (id: string) => void
  expanded: boolean
  onToggleAll: () => void
}) {
  return (
    <>
      <div className="sticky top-0 z-20 -mx-5 mt-4 border-y border-line bg-bg/85 px-5 py-1.5 backdrop-blur lg:hidden">
        <nav
          aria-label="Sheet sections"
          className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onJump(item.id)}
              aria-current={active === item.id ? 'true' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[12px] transition-colors',
                active === item.id ? 'bg-panel2 text-fg' : 'text-dim hover:text-fg',
              )}
            >
              {item.label}
              {item.note && <span className="tabular ml-1.5 text-[10.5px] text-dim2">{item.note}</span>}
            </button>
          ))}
        </nav>
      </div>

      <aside className="sticky top-6 hidden self-start lg:block">
        <nav aria-label="Sheet sections">
          <p className="eyebrow px-2.5 text-dim2">On this sheet</p>
          <ul className="mt-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onJump(item.id)}
                  aria-current={active === item.id ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 border-l-2 py-[5px] pl-2.5 pr-2 text-left text-[12px] transition-colors',
                    active === item.id
                      ? 'border-fg/60 text-fg'
                      : 'border-line text-dim hover:border-line2 hover:text-fg',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.note && <span className="tabular shrink-0 text-[10.5px] text-dim2">{item.note}</span>}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onToggleAll}
            className="mt-3 w-full rounded-[6px] border border-line bg-panel px-2.5 py-1.5 text-left text-[11.5px] text-dim transition-colors hover:border-line2 hover:text-fg"
          >
            {expanded ? 'Collapse the prose' : 'Expand the prose'}
          </button>
        </nav>
      </aside>
    </>
  )
}
