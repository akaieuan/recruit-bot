import Link from 'next/link'
import { pipelineSummary, queueRows } from '@/lib/views'
import { StageFilter } from '@/components/stage-filter'
import { Stat, StatRow } from '@/components/ui/stat'
import { Dot } from '@/components/ui/badge'
import { cn, formatComp, STAGE_STYLE, TIER_STYLE } from '@/lib/ui'
import type { Stage } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const { stage } = await searchParams
  const current = stage ?? 'active'
  const summary = pipelineSummary()
  const rows = queueRows(current as Stage | 'active')

  return (
    <main>
      <StatRow>
        <Stat label="In play" value={summary.active} hint="roles being worked" accent="bg-applied" />
        <Stat
          label="Your review"
          value={summary.toReview}
          hint={summary.toReview ? 'drafts waiting on you' : 'nothing waiting'}
          accent="bg-viewed"
          emphasis={summary.toReview > 0}
        />
        <Stat label="Sent" value={summary.apps} hint="applications on record" href="/tracker" accent="bg-dim2" />
        <Stat label="Movement" value={summary.movement} hint="viewed or downloaded" href="/tracker" accent="bg-interview" />
        <Stat
          label="Follow-ups due"
          value={summary.followUps}
          hint="seven days, no reply"
          href="/tracker?filter=followups"
          accent="bg-closed"
        />
      </StatRow>

      <StageFilter counts={summary.counts} current={current} />

      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="mt-5 overflow-hidden rounded-[8px] border border-line">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-panel2">
                {['Stage', 'Company', 'Role', 'Comp', 'Location', 'Signal', 'Score'].map((h) => (
                  <th key={h} className="eyebrow px-3 py-2 text-dim2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ posting, score, draftCount, critiqueVerdict, keywordHits }) => {
                const style = STAGE_STYLE[posting.stage]
                return (
                  <tr key={posting.id} className="border-b border-line last:border-0 hover:bg-panel">
                    <td className="px-3 py-2.5 align-top">
                      <span className={cn('flex items-center gap-2 text-[12px]', style.text)}>
                        <Dot className={style.dot} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Link href={`/posting/${posting.id}`} className="text-fg hover:underline">
                        {posting.company}
                      </Link>
                    </td>
                    <td className="max-w-[300px] px-3 py-2.5 align-top">
                      <Link href={`/posting/${posting.id}`} className="text-dim hover:text-fg hover:underline">
                        {posting.role_title}
                      </Link>
                      {draftCount > 0 && (
                        <span className="ml-2 text-[11px] text-dim2">
                          {draftCount} draft{draftCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {critiqueVerdict === 'revise' && (
                        <span className="ml-2 text-[11px] text-viewed">critique: revise</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-2.5 align-top text-[12px] text-dim">
                      {formatComp(posting.comp_min, posting.comp_max)}
                      {posting.comp_flag ? <span className="ml-1.5 text-closed">low</span> : null}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 align-top text-[12px] text-dim">
                      {posting.location ?? '—'}
                      {posting.remote_policy && posting.remote_policy !== 'unknown' && (
                        <span className="ml-1.5 text-dim2">{posting.remote_policy}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-[12px] text-dim2">
                      {keywordHits.length > 0 && <span title={keywordHits.join(', ')}>{keywordHits.length} kw</span>}
                      {posting.years_flag && <span className="ml-1.5 text-viewed">{posting.years_flag.replace(/_/g, ' ')}</span>}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {score ? (
                        <span
                          className={cn(
                            'tabular inline-flex items-center gap-1.5 rounded-[6px] border px-1.5 py-0.5 text-[11px]',
                            TIER_STYLE[score.tier],
                          )}
                        >
                          {score.score}
                          <span className="opacity-70">{score.tier.replace('_', ' ')}</span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-dim2">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function Empty() {
  return (
    <div className="mt-5 rounded-[8px] border border-line bg-panel px-4 py-8 text-center">
      <p className="text-[13px] text-dim">Nothing at this stage.</p>
      <p className="mt-2 font-mono text-[11.5px] text-dim2">pnpm cli poll &amp;&amp; pnpm cli filter</p>
    </div>
  )
}
