import Link from 'next/link'
import { notFound } from 'next/navigation'
import { postingDetail } from '@/lib/views'
import { DraftEditor } from '@/components/draft-editor'
import { PostingActions } from '@/components/posting-actions'
import { JdPanel } from '@/components/jd-panel'
import { Card, CardBody, CardHeader, CardTitle, Eyebrow } from '@/components/ui/card'
import { Dot } from '@/components/ui/badge'
import { cn, formatComp, STAGE_STYLE, TIER_STYLE } from '@/lib/ui'

export const dynamic = 'force-dynamic'

export default async function PostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = postingDetail(Number(id))
  if (!detail) notFound()

  const { posting, score, research, drafts, questions, application } = detail
  const style = STAGE_STYLE[posting.stage]
  const answered = new Set(drafts.filter((d) => d.kind === 'answer').map((d) => d.question_key))
  const unanswered = questions.filter((q) => !answered.has(q.key))

  return (
    <main className="mt-5">
      <Link href="/" className="text-[12px] text-dim hover:text-fg">
        ← Pipeline
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-2 text-[12px]', style.text)}>
              <Dot className={style.dot} />
              {style.label}
            </span>
            {posting.closed_at && <span className="text-[12px] text-closed">closed on the board</span>}
          </div>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.01em]">
            {posting.company} <span className="text-dim">/</span> {posting.role_title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
            <span className="tabular">{formatComp(posting.comp_min, posting.comp_max)}</span>
            {posting.comp_flag ? <span className="text-closed">below the floor</span> : null}
            <span>{posting.location ?? 'location not stated'}</span>
            {posting.remote_policy !== 'unknown' && <span>{posting.remote_policy}</span>}
            {posting.years_min && (
              <span>
                {posting.years_min}
                {posting.years_max ? `–${posting.years_max}` : '+'} years
              </span>
            )}
            <a href={posting.url} target="_blank" rel="noreferrer" className="text-applied hover:underline">
              Open posting
            </a>
          </div>
        </div>

        <PostingActions
          postingId={posting.id}
          stage={posting.stage}
          hasApproved={drafts.some((d) => d.status === 'approved')}
        />
      </div>

      {application?.status === 'applied' && (
        <p className="mt-3 rounded-[7px] border border-interview/30 bg-interview/5 px-3 py-2 text-[12px] text-interview">
          Applied {application.applied_at}. Follow up on {application.follow_up_at}.
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {drafts.length === 0 ? (
            <Card>
              <CardBody className="py-8 text-center">
                <p className="text-[13px] text-dim">No drafts yet.</p>
                <p className="mt-2 font-mono text-[11.5px] text-dim2">
                  {posting.stage === 'needs_score'
                    ? '/score'
                    : posting.stage === 'needs_research'
                      ? '/research'
                      : '/draft'}
                </p>
              </CardBody>
            </Card>
          ) : (
            drafts.map((d) => (
              <DraftEditor
                key={d.id}
                draftId={d.id}
                kind={d.kind}
                questionLabel={questions.find((q) => q.key === d.question_key)?.label ?? d.question_key}
                body={d.body}
                status={d.status}
                contactVariant={d.contact_variant}
                pdfPath={d.pdf_path}
                reviewNote={d.review_note}
                critique={d.critiqueParsed}
                facts={d.factsResolved}
                jdLines={(() => {
                  try {
                    return d.jd_lines ? (JSON.parse(d.jd_lines) as string[]) : []
                  } catch {
                    return []
                  }
                })()}
              />
            ))
          )}

          {unanswered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Application questions with no draft</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5">
                  {unanswered.map((q) => (
                    <li key={q.key} className="text-[12.5px] text-dim">
                      {q.label}
                      {q.required && <span className="ml-1.5 text-viewed">required</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[11.5px] text-dim2">/draft</p>
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          {score && (
            <Card>
              <CardHeader>
                <CardTitle>Score</CardTitle>
                <span
                  className={cn('tabular rounded-[6px] border px-1.5 py-0.5 text-[11px]', TIER_STYLE[score.tier])}
                >
                  {score.score} {score.tier.replace('_', ' ')}
                </span>
              </CardHeader>
              <CardBody className="space-y-2.5">
                <p className="text-[12.5px] leading-[1.6] text-dim">{score.rationale}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
                  <Field label="Title" value={score.title_match} />
                  <Field label="NYC" value={score.nyc?.replace('_', ' ')} />
                  <Field label="Size" value={score.company_size_estimate} />
                  <Field label="Stage" value={score.stage_estimate} />
                </dl>
              </CardBody>
            </Card>
          )}

          {research && (
            <Card>
              <CardHeader>
                <CardTitle>Research</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {research.hard_problem && (
                  <div>
                    <Eyebrow>The hard problem</Eyebrow>
                    <p className="mt-1 text-[12.5px] leading-[1.6] text-fg">{research.hard_problem}</p>
                  </div>
                )}
                {research.company_summary && (
                  <p className="text-[12.5px] leading-[1.6] text-dim">{research.company_summary}</p>
                )}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
                  <Field label="Funding" value={research.funding} />
                  <Field label="Headcount" value={research.headcount} />
                </dl>

                {research.jdLines.length > 0 && (
                  <div>
                    <Eyebrow>JD lines mapped to facts</Eyebrow>
                    <ul className="mt-1.5 space-y-2">
                      {research.jdLines.map((l) => (
                        <li key={l.jd_line}>
                          <p className="text-[12px] text-dim">{l.jd_line}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.fact_ids.map((f) => (
                              <span key={f} className="rounded-[5px] border border-line bg-panel2 px-1 py-px font-mono text-[10.5px] text-dim2">
                                {f}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {research.sourceList.length > 0 && (
                  <div>
                    <Eyebrow>Sources</Eyebrow>
                    <ul className="mt-1 space-y-0.5">
                      {research.sourceList.map((s) => (
                        <li key={s}>
                          <a href={s} target="_blank" rel="noreferrer" className="text-[11.5px] text-applied hover:underline">
                            {s.replace(/^https?:\/\//, '').slice(0, 46)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <JdPanel text={posting.description_text ?? ''} />
            </CardBody>
          </Card>
        </aside>
      </div>
    </main>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="eyebrow text-dim2">{label}</dt>
      <dd className="mt-0.5 text-dim">{value || '—'}</dd>
    </div>
  )
}
