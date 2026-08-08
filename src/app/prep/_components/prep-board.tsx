'use client'

import { useState } from 'react'
import type { PrepView } from '@/lib/prep'
import { cn } from '@/lib/ui'
import { Sheet } from './sheet'

/**
 * One conversation at a time. Stacking every sheet is what made this page a
 * wall of text: the vocabulary of a company he is not talking to today is
 * noise on the day he is talking to someone else.
 */
export function PrepBoard({ sheets }: { sheets: PrepView[] }) {
  const [selected, setSelected] = useState(sheets[0]?.posting_id ?? 0)
  const sheet = sheets.find((s) => s.posting_id === selected) ?? sheets[0]
  if (!sheet) return null

  return (
    <>
      {sheets.length > 1 && (
        <nav
          aria-label="Prep sheets"
          className="-mx-5 mt-5 flex gap-1.5 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sheets.map((s) => {
            const on = s.posting_id === sheet.posting_id
            return (
              <button
                key={s.posting_id}
                type="button"
                onClick={() => setSelected(s.posting_id)}
                aria-current={on ? 'true' : undefined}
                className={cn(
                  'shrink-0 rounded-[7px] border px-3 py-1.5 text-left transition-colors',
                  on
                    ? 'border-line2 bg-panel2 text-fg'
                    : 'border-line bg-panel text-dim hover:border-line2 hover:text-fg',
                )}
              >
                <span className="block text-[12.5px] font-medium">{s.posting.company}</span>
                <span className="block text-[11px] text-dim2">{s.posting.role_title}</span>
              </button>
            )
          })}
        </nav>
      )}

      <Sheet key={sheet.posting_id} sheet={sheet} />
    </>
  )
}
