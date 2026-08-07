import { nowIso, openDb, plainAll } from '../../lib/db.ts'
import { draftableQuestions, fetchGreenhouseQuestions } from '../../lib/greenhouse.ts'
import { args, plural, table } from '../util.ts'
import type { Posting } from '../../lib/types.ts'

/**
 * Greenhouse's ?questions=true endpoint returns the application form schema.
 * Fetching it before a form is ever opened is what lets custom prompts ("why
 * us", "most challenging project") be drafted and reviewed in advance rather
 * than answered cold in a browser tab.
 */
export async function run(argv: string[]): Promise<void> {
  const { values } = args(argv, {
    limit: { type: 'string' },
    all: { type: 'boolean' },
    posting: { type: 'string' },
  })
  const db = openDb()

  const stages = values.all
    ? "('needs_score', 'scored', 'needs_research', 'researched', 'needs_draft', 'in_review')"
    : "('needs_score', 'scored', 'needs_research', 'researched', 'needs_draft')"

  const where = values.posting
    ? 'p.id = ?'
    : `p.ats = 'greenhouse' AND p.closed_at IS NULL AND p.stage IN ${stages} AND q.id IS NULL`

  const sql = `
    SELECT p.* FROM postings p
    LEFT JOIN question_schemas q ON q.posting_id = p.id
    WHERE ${where}
    ORDER BY p.id
    LIMIT ?
  `
  const params: unknown[] = values.posting ? [Number(values.posting)] : []
  const postings = plainAll<Posting>(db.prepare(sql).all(...params, Number(values.limit ?? 25)))

  if (!postings.length) {
    console.log('no Greenhouse postings need a question schema')
    return
  }

  const insert = db.prepare(
    `INSERT INTO question_schemas (posting_id, fetched_at, raw_json, questions)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (posting_id) DO UPDATE SET fetched_at = excluded.fetched_at,
       raw_json = excluded.raw_json, questions = excluded.questions`,
  )

  let ok = 0
  for (const p of postings) {
    if (!p.board_token || !p.job_id) continue
    try {
      const { raw, questions } = await fetchGreenhouseQuestions(p.board_token, p.job_id)
      insert.run(p.id, nowIso(), JSON.stringify(raw), JSON.stringify(questions))
      const draftable = draftableQuestions(questions)
      ok++
      console.log(
        `${String(p.id).padStart(5)}  ${p.company.slice(0, 14).padEnd(16)}${p.role_title.slice(0, 34).padEnd(36)}` +
          `${questions.length} fields, ${draftable.length} to draft`,
      )
      for (const q of draftable) console.log(`         "${q.label.slice(0, 92)}"`)
    } catch (err) {
      console.warn(`${String(p.id).padStart(5)}  failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  console.log(`\n${plural(ok, 'schema')} stored`)
}
