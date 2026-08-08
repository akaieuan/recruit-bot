import Link from 'next/link'
import { pipelineSummary, queueRows } from '@/lib/views'
import { StageFilter } from '@/components/stage-filter'
import { Stat, StatRow } from '@/components/ui/stat'
import { Badge, Dot } from '@/components/ui/badge'
import { EmptyState, SectionHeading } from '@/components/ui/section'
import { Table, TableShell, TD, TH, TR } from '@/components/ui/table'
import { cn, formatComp, STAGE_STYLE, TIER_STYLE } from '@/lib/ui'
import type { Stage } from '@/lib/types'

export const dynamic = 'force-dynamic'

/*
 * Company leads the row and is the pinned column. Stage sits second: it is the
 * dimension you filter by, so once a filter is on it repeats down the whole
 * table, and a pinned column of "To score, To score, To score" tells you
 * nothing about which row you are looking at.
 *
 * Widths are declared here and summed into the table's minimum, so the columns
 * are the same width on every filter and never squash below it.
 */
const COLUMNS = [
  { label: 'Company', width: 190, pinned: true },
  { label: 'Stage', width: 124 },
  { label: 'Role', width: 260 },
  { label: 'Comp', width: 110 },
  { label: 'Location', width: 170 },
  { label: 'Signal', width: 120 },
  { label: 'Score', width: 100 },
]

const MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0)

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage } = await searchParams
  const current = stage ?? 'active'
  const summary = pipelineSummary()
  const rows = queueRows(current as Stage | 'active')

  const heading = current === 'active' ? 'Active queue' : (STAGE_STYLE[current as Stage]?.label ?? 'Queue')

  return (
    <main>
      <StatRow>
        <Stat label="In play" value={summary.active} hint="roles being worked" accent="bg-applied" />
        <Stat
          label="Your review"
          value={summary.toReview}
          hint={summary.toReview ? 'drafts waiting on you' : 'nothing waiting'}
          accent="bg-viewed"
          emphasis
        />
        <Stat label="Sent" value={summary.apps} hint="applications on record" href="/tracker" accent="bg-dim2" />
        <Stat
          label="Movement"
          value={summary.movement}
          hint="viewed or downloaded"
          href="/tracker"
          accent="bg-interview"
        />
        <Stat
          label="Follow-ups due"
          value={summary.followUps}
          hint="seven days, no reply"
          href="/tracker?filter=followups"
          accent="bg-closed"
          emphasis
        />
      </StatRow>

      <StageFilter counts={summary.counts} current={current} />

      <div className="mt-8">
        <SectionHeading
          eyebrow="Queue"
          title={heading}
          description="Sorted by what needs you first, then by New York and in person."
          action={
            <span className="tabular text-[12px] text-dim">
              <span className="font-medium text-fg">{rows.length}</span> {rows.length === 1 ? 'role' : 'roles'}
            </span>
          }
        />

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing at this stage."
              hint="Either the filter is narrower than the pipeline, or there is nothing new to triage."
              command="pnpm cli poll && pnpm cli filter"
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
                {rows.map(({ posting, score, draftCount, critiqueVerdict, keywordHits }) => {
                  const style = STAGE_STYLE[posting.stage]
                  const href = `/posting/${posting.id}`
                  return (
                    // A fixed height so the rows carrying a second line (a remote
                    // policy, a years flag) do not make the column of rows around
                    // them jump. Scanning a ragged column is slower.
                    <TR key={posting.id} interactive className="h-[54px]">
                      <TD pinned>
                        <Link
                          href={href}
                          title={posting.company}
                          className="block truncate font-medium text-fg underline-offset-2 hover:underline"
                        >
                          {posting.company}
                        </Link>
                      </TD>

                      <TD>
                        <span className={cn('flex items-center gap-2 text-[12px]', style.text)}>
                          <Dot className={cn('size-[6px]', style.dot)} />
                          <span className="truncate">{style.label}</span>
                        </span>
                      </TD>

                      <TD>
                        <div className="flex items-center gap-2">
                          <Link
                            href={href}
                            title={posting.role_title}
                            className="truncate text-[13px] text-dim underline-offset-2 hover:text-fg hover:underline"
                          >
                            {posting.role_title}
                          </Link>
                          {draftCount > 0 && (
                            <Badge>
                              {draftCount} draft{draftCount === 1 ? '' : 's'}
                            </Badge>
                          )}
                          {critiqueVerdict === 'revise' && (
                            <Badge className="border-viewed/35 bg-viewed/10 text-viewed" title="critique: revise">
                              revise
                            </Badge>
                          )}
                        </div>
                      </TD>

                      <TD className="tabular whitespace-nowrap font-mono text-[11.5px] text-dim">
                        {formatComp(posting.comp_min, posting.comp_max)}
                        {posting.comp_flag ? <span className="ml-1.5 text-closed">low</span> : null}
                      </TD>

                      <TD className="text-[12px] text-dim">
                        <span className="block truncate" title={posting.location ?? undefined}>
                          {posting.location ?? '—'}
                        </span>
                        {posting.remote_policy && posting.remote_policy !== 'unknown' && (
                          <span className="eyebrow mt-0.5 block text-dim2">{posting.remote_policy}</span>
                        )}
                      </TD>

                      <TD className="text-[12px] text-dim2">
                        {keywordHits.length > 0 && (
                          <span className="font-mono" title={keywordHits.join(', ')}>
                            {keywordHits.length} kw
                          </span>
                        )}
                        {posting.years_flag && (
                          <span className="mt-0.5 block truncate text-[11px] text-viewed">
                            {posting.years_flag.replace(/_/g, ' ')}
                          </span>
                        )}
                      </TD>

                      <TD>
                        {score ? (
                          <span
                            className={cn(
                              'tabular inline-flex items-center gap-1.5 rounded-[6px] border px-1.5 py-0.5 text-[11px]',
                              TIER_STYLE[score.tier],
                            )}
                          >
                            <span className="font-medium">{score.score}</span>
                            <span className="opacity-70">{score.tier.replace('_', ' ')}</span>
                          </span>
                        ) : (
                          <span className="text-[12px] text-dim2">—</span>
                        )}
                      </TD>
                    </TR>
                  )
                })}
              </tbody>
            </Table>
          </TableShell>
        )}
      </div>
    </main>
  )
}
