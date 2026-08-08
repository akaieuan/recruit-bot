'use client'

import { useMemo, useState } from 'react'
import { TrackerRow } from '@/components/tracker-row'
import { cn } from '@/lib/ui'
import type { Application } from '@/lib/types'

type SortKey = 'applied' | 'company' | 'status'
type Direction = 'desc' | 'asc'

/**
 * 366 rows is past the point where a flat table is useful, so this adds the
 * two things that make a long list navigable: search, and a sort that defaults
 * to newest. Movement is pulled out of the notes column into its own filter,
 * because an employer who opened the application is the only row that suggests
 * doing something today.
 */
export function TrackerTable({ rows }: { rows: Application[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('applied')
  // Chronological by default, newest first: the most recent application is the
  // one most likely to need something today.
  const [dir, setDir] = useState<Direction>('desc')
  const [movementOnly, setMovementOnly] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = rows

    if (q) {
      out = out.filter(
        (r) =>
          r.company.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          (r.location ?? '').toLowerCase().includes(q) ||
          (r.notes ?? '').toLowerCase().includes(q),
      )
    }
    if (movementOnly) out = out.filter((r) => /viewed|downloaded/i.test(r.notes ?? ''))

    const flip = dir === 'asc' ? -1 : 1
    return [...out].sort((a, b) => {
      if (sort === 'company') return a.company.localeCompare(b.company) * flip
      if (sort === 'status') return (a.status.localeCompare(b.status) || a.company.localeCompare(b.company)) * flip
      // Undated rows sink to the bottom either way: they carry no position in
      // a timeline, and floating them to the top would bury the real history.
      if (!a.applied_at && !b.applied_at) return a.company.localeCompare(b.company)
      if (!a.applied_at) return 1
      if (!b.applied_at) return -1
      if (a.applied_at === b.applied_at) {
        // "before 2026-08-07" is a bound, not a day. It shares the date with
        // rows that really happened then, so it ranks below them rather than
        // crowding the top of a timeline it has no true position in.
        const pa = a.applied_at_precision === 'before' ? 1 : 0
        const pb = b.applied_at_precision === 'before' ? 1 : 0
        if (pa !== pb) return pa - pb
        return a.company.localeCompare(b.company)
      }
      return b.applied_at.localeCompare(a.applied_at) * flip
    })
  }, [rows, query, sort, dir, movementOnly])

  const movementCount = useMemo(() => rows.filter((r) => /viewed|downloaded/i.test(r.notes ?? '')).length, [rows])

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, role, notes..."
          className="w-64 rounded-[7px] border border-line bg-panel px-3 py-1.5 text-[12px] text-fg placeholder:text-dim2 focus:border-line2 focus:outline-none"
        />

        {movementCount > 0 && (
          <button
            type="button"
            onClick={() => setMovementOnly((v) => !v)}
            className={cn(
              'rounded-[7px] border px-2.5 py-1.5 text-[12px] transition-colors',
              movementOnly
                ? 'border-viewed/50 bg-viewed/10 text-viewed'
                : 'border-line bg-panel text-dim hover:border-line2 hover:text-fg',
            )}
          >
            Movement <span className="tabular font-semibold">{movementCount}</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-[11.5px] text-dim2">
          <span>sort</span>
          {(['applied', 'company', 'status'] as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => (sort === k ? setDir((d) => (d === 'desc' ? 'asc' : 'desc')) : setSort(k))}
              className={cn(
                'rounded-[6px] border px-2 py-1 transition-colors',
                sort === k ? 'border-line2 bg-panel2 text-fg' : 'border-line bg-panel text-dim hover:text-fg',
              )}
            >
              {k === 'applied' ? 'date' : k}
              {sort === k && <span className="ml-1 text-dim2">{dir === 'desc' ? '↓' : '↑'}</span>}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2.5 text-[12px] text-dim">
        <span className="tabular font-semibold text-fg">{visible.length}</span>
        {visible.length === rows.length ? ' applications' : ` of ${rows.length}`}
      </p>

      <div className="mt-2.5 overflow-hidden rounded-[8px] border border-line">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-panel2">
              {['Company', 'Role', 'Status', 'Applied', 'Follow-up', 'Signal'].map((h) => (
                <th key={h} className="eyebrow px-3 py-2 text-dim2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((app) => (
              <TrackerRow key={app.id} app={app} />
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="mt-6 text-center text-[12.5px] text-dim2">
          {query ? `Nothing matches "${query}".` : 'Nothing here.'}
        </p>
      )}
    </div>
  )
}
