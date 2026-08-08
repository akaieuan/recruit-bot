'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { TrackerRow } from '@/components/tracker-row'
import { ChipButton } from '@/components/ui/chip'
import { EmptyState, SectionHeading } from '@/components/ui/section'
import { Table, TableShell, TH, TR } from '@/components/ui/table'
import { cn } from '@/lib/ui'
import type { Application } from '@/lib/types'

type SortKey = 'applied' | 'company' | 'status'
type Direction = 'desc' | 'asc'

/*
 * Widths are declared once and summed into the table's minimum, so a column is
 * the same width on every filter and the row never squashes into three lines.
 */
export const COLUMNS = [
  { label: 'Company', width: 200, pinned: true },
  { label: 'Role', width: 280 },
  { label: 'Status', width: 145 },
  { label: 'Applied', width: 165 },
  { label: 'Follow-up', width: 130 },
  { label: 'Signal', width: 145 },
]

const MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0)

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'applied', label: 'Date' },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status' },
]

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
  const Arrow = dir === 'desc' ? ArrowDown : ArrowUp

  return (
    <div className="mt-8">
      <SectionHeading
        eyebrow="History"
        title="Applications"
        description="Every row is something already sent. Status is editable in place."
        action={
          <span className="tabular text-[12px] text-dim">
            <span className="font-medium text-fg">{visible.length}</span>
            {visible.length === rows.length ? ' shown' : ` of ${rows.length}`}
          </span>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:w-[300px] sm:flex-none">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, role, notes"
            aria-label="Search applications"
            className="h-8 w-full rounded-chip border border-line bg-panel pl-8 pr-3 text-[12.5px] text-fg transition-colors placeholder:text-dim2 hover:border-line2 focus:border-line2 focus:outline-none"
          />
        </div>

        {movementCount > 0 && (
          <ChipButton
            selected={movementOnly}
            onClick={() => setMovementOnly((v) => !v)}
            className={cn('h-8', movementOnly && 'border-viewed/45 bg-viewed/10 text-viewed')}
          >
            Movement
            <span className="tabular font-medium">{movementCount}</span>
          </ChipButton>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <span className="eyebrow text-dim2">Sort</span>
          <div className="flex gap-0.5 rounded-chip border border-line bg-panel p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => (sort === s.key ? setDir((d) => (d === 'desc' ? 'asc' : 'desc')) : setSort(s.key))}
                className={cn(
                  'flex cursor-pointer items-center gap-1 rounded-[6px] px-2 py-1 text-[11.5px] transition-colors',
                  sort === s.key ? 'bg-panel3 text-fg' : 'text-dim hover:text-fg',
                )}
              >
                {s.label}
                {sort === s.key && <Arrow className="size-3 text-dim2" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={query ? `Nothing matches "${query}".` : 'Nothing here.'}
            hint={query ? 'Search covers company, role, location and notes.' : undefined}
          />
        </div>
      ) : (
        <TableShell className="mt-4">
          <Table minWidth={MIN_WIDTH}>
            <thead>
              <TR>
                {COLUMNS.map((c) => (
                  <TH key={c.label} pinned={c.pinned} style={{ width: c.width }}>
                    {c.label}
                  </TH>
                ))}
              </TR>
            </thead>
            <tbody>
              {visible.map((app) => (
                <TrackerRow key={app.id} app={app} />
              ))}
            </tbody>
          </Table>
        </TableShell>
      )}
    </div>
  )
}
