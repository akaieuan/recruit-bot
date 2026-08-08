import Link from 'next/link'
import { pipelineSummary, trackerRows } from '@/lib/views'
import { TrackerTable } from '@/components/tracker-table'
import { Stat, StatRow } from '@/components/ui/stat'
import { cn } from '@/lib/ui'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'followups', label: 'Follow-ups due' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'applied', label: 'Applied' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'ambiguous', label: 'Needs confirming' },
]

export default async function TrackerPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams
  const current = filter ?? 'all'
  const rows = trackerRows(current)
  const s = pipelineSummary()

  return (
    <main>
      <StatRow>
        <Stat label="Sent" value={s.apps} hint="applications on record" accent="bg-dim2" />
        <Stat label="Awaiting reply" value={s.awaiting} hint="no response yet" accent="bg-applied" />
        <Stat
          label="Movement"
          value={s.movement}
          hint="viewed or resume downloaded"
          href="/tracker"
          accent="bg-viewed"
          emphasis
        />
        <Stat label="Interviewing" value={s.interviewing} hint="live conversations" href="/tracker?filter=interviewing" accent="bg-interview" />
        <Stat label="Follow-ups due" value={s.followUps} hint="seven days and no reply" href="/tracker?filter=followups" accent="bg-closed" />
      </StatRow>

      <div className="mt-5 flex flex-wrap gap-1.5">
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

      <TrackerTable rows={rows} />
    </main>
  )
}
