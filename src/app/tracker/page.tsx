import Link from 'next/link'
import { trackerRows } from '@/lib/views'
import { TrackerRow } from '@/components/tracker-row'
import { cn } from '@/lib/ui'
import { today } from '@/lib/db'
import { APPLICATION_STATUSES } from '@/lib/types'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'followups', label: 'Follow-ups due' },
  { key: 'ambiguous', label: 'Needs confirming' },
  ...APPLICATION_STATUSES.map((s) => ({ key: s, label: s.replace(/_/g, ' ') })),
]

export default async function TrackerPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  const current = filter ?? 'all'
  const rows = trackerRows(current)
  const now = today()

  return (
    <main className="mt-5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '/tracker' : `/tracker?filter=${f.key}`}
            className={cn(
              'rounded-[7px] border px-2.5 py-1 text-[11.5px] transition-colors',
              current === f.key
                ? 'border-line2 bg-panel2 text-fg'
                : 'border-line bg-panel text-dim hover:border-line2 hover:text-fg',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <p className="mt-3 text-[12px] text-dim">
        {rows.length} application{rows.length === 1 ? '' : 's'}
        {current === 'ambiguous' && ' imported with a status that could not be read confidently'}
      </p>

      <div className="mt-4 overflow-hidden rounded-[8px] border border-line">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-panel2">
              {['Company', 'Role', 'Status', 'Applied', 'Follow-up', 'Notes'].map((h) => (
                <th key={h} className="eyebrow px-3 py-2 text-dim2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((app) => (
              <TrackerRow
                key={app.id}
                app={app}
                overdue={Boolean(app.follow_up_at && app.follow_up_at <= now && !app.followed_up_at)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-4 text-center text-[12.5px] text-dim2">Nothing matches this filter.</p>
      )}
    </main>
  )
}
