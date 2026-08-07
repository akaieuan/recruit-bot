import { existsSync, readdirSync } from 'node:fs'
import { openDb, plainAll } from '../../lib/db.ts'
import { stageCounts } from '../../lib/postings.ts'
import { dueFollowUps } from '../../lib/tracker.ts'
import { WORK_STEPS, workDir } from '../../lib/paths.ts'
import { STAGES } from '../../lib/types.ts'
import { plural, table } from '../util.ts'

/** The "what do I run next" screen, for a person or a session. */
export function run(): void {
  const db = openDb()
  const counts = stageCounts(db)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  console.log(`pipeline: ${plural(total, 'open posting')}\n`)
  console.log(
    table(
      STAGES.filter((s) => counts[s]).map((s) => [`  ${s}`, counts[s] ?? 0]),
    ),
  )

  const closed = (db.prepare('SELECT count(*) AS n FROM postings WHERE closed_at IS NOT NULL').get() as { n: number }).n
  if (closed) console.log(`  (${closed} closed)`)

  const apps = (db.prepare('SELECT count(*) AS n FROM applications').get() as { n: number }).n
  const applied = (db.prepare("SELECT count(*) AS n FROM applications WHERE status = 'applied'").get() as { n: number }).n
  const unknown = (db.prepare("SELECT count(*) AS n FROM applications WHERE status = 'unknown'").get() as { n: number }).n
  console.log(`\ntracker: ${apps} applications, ${applied} awaiting a reply, ${unknown} needing an outcome`)

  const due = dueFollowUps(db)
  if (due.length) console.log(`  ${plural(due.length, 'follow-up')} due: pnpm cli tracker followups`)

  const work: string[][] = []
  for (const step of WORK_STEPS) {
    const pending = countJson(workDir(step, 'pending'))
    const results = countJson(workDir(step, 'results'))
    if (pending || results) work.push([`  ${step}`, `${pending} pending`, `${results} results waiting to submit`])
  }
  if (work.length) {
    console.log('\nwork queue:')
    console.log(table(work))
  }

  console.log(`\nnext:`)
  for (const line of suggestions(counts, db)) console.log(`  ${line}`)
}

function countJson(dir: string): number {
  if (!existsSync(dir)) return 0
  return readdirSync(dir).filter((f) => f.endsWith('.json')).length
}

function suggestions(counts: Record<string, number>, db: ReturnType<typeof openDb>): string[] {
  const out: string[] = []
  for (const step of WORK_STEPS) {
    const results = countJson(workDir(step, 'results'))
    if (results) out.push(`pnpm cli submit ${step} --dir      (${results} waiting)`)
  }
  if (counts.new) out.push(`pnpm cli filter                   (${counts.new} untriaged)`)
  if (counts.needs_score) out.push(`/score                            (${counts.needs_score} to score)`)
  if (counts.needs_research) out.push(`/research                         (${counts.needs_research} to research)`)
  if (counts.needs_draft) out.push(`/draft                            (${counts.needs_draft} to draft)`)

  const uncritiqued = (
    db.prepare("SELECT count(*) AS n FROM drafts WHERE status = 'draft' AND critique IS NULL").get() as { n: number }
  ).n
  if (uncritiqued) out.push(`/critique                         (${uncritiqued} uncritiqued)`)

  if (counts.in_review) out.push(`pnpm dev                          (${counts.in_review} awaiting your review)`)
  if (!out.length) out.push('pnpm cli poll')
  return out
}
