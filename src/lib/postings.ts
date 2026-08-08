import { nowIso, plain, plainAll, type Db } from './db.ts'
import { contentHash } from './normalize.ts'
import type { NormalizedPosting, Posting, Stage } from './types.ts'

export interface UpsertResult {
  inserted: number
  updated: number
  changed: number
  ids: number[]
}

/**
 * Insert new postings, refresh ones already seen.
 *
 * A posting whose description changed goes back to 'new' so it gets refiltered
 * and rescored: an edited JD can turn a reject into a fit or the reverse. A
 * posting already drafted or applied to is never rewound, because that would
 * discard human review.
 */
export function upsertPostings(db: Db, items: NormalizedPosting[]): UpsertResult {
  const now = nowIso()
  const result: UpsertResult = { inserted: 0, updated: 0, changed: 0, ids: [] }

  const findByUrl = db.prepare('SELECT * FROM postings WHERE url = ?')
  const insert = db.prepare(`
    INSERT INTO postings (
      ats, board_token, job_id, url, company, role_title, location, remote_policy,
      comp_min, comp_max, years_min, years_max, description_html, description_text,
      content_hash, first_seen, last_seen, stage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `)
  // company is refreshed too: Ashby publishes no company name, so a display
  // name added to the boards table later has to reach postings already stored.
  const refresh = db.prepare(`
    UPDATE postings SET
      company = ?, role_title = ?, location = ?, remote_policy = ?, comp_min = ?, comp_max = ?,
      years_min = ?, years_max = ?, description_html = ?, description_text = ?,
      content_hash = ?, last_seen = ?, closed_at = NULL
    WHERE id = ?
  `)
  const rewind = db.prepare("UPDATE postings SET stage = 'new', stage_reason = ? WHERE id = ?")

  const SETTLED: Stage[] = ['needs_draft', 'in_review', 'approved', 'applied']

  for (const p of items) {
    const hash = contentHash(p.role_title, p.location, p.description_text, String(p.comp_min), String(p.comp_max))
    const existingRow = findByUrl.get(p.url)
    const existing = existingRow ? plain<Posting>(existingRow) : undefined

    if (!existing) {
      insert.run(
        p.ats, p.board_token, p.job_id, p.url, p.company, p.role_title, p.location, p.remote_policy,
        p.comp_min, p.comp_max, p.years_min, p.years_max, p.description_html, p.description_text,
        hash, now, now,
      )
      const row = plain<Posting>(findByUrl.get(p.url))
      result.inserted++
      result.ids.push(row.id)
      continue
    }

    refresh.run(
      p.company, p.role_title, p.location, p.remote_policy, p.comp_min, p.comp_max,
      p.years_min, p.years_max, p.description_html, p.description_text,
      hash, now, existing.id,
    )
    result.updated++
    result.ids.push(existing.id)

    if (existing.content_hash && existing.content_hash !== hash && !SETTLED.includes(existing.stage)) {
      rewind.run('description changed since last poll', existing.id)
      result.changed++
    }
  }

  return result
}

/**
 * Mark postings that a successful board poll no longer lists. Only called on a
 * clean fetch: a network error must never be read as "every job closed".
 */
export function closeMissing(db: Db, ats: string, token: string, liveIds: string[]): number {
  const rows = plainAll<Posting>(
    db.prepare('SELECT * FROM postings WHERE ats = ? AND board_token = ? AND closed_at IS NULL').all(ats, token),
  )
  const live = new Set(liveIds)
  const close = db.prepare('UPDATE postings SET closed_at = ? WHERE id = ?')
  const now = nowIso()
  let n = 0
  for (const row of rows) {
    if (row.job_id && !live.has(row.job_id)) {
      close.run(now, row.id)
      n++
    }
  }
  return n
}

/**
 * A posting ingested from a saved list carries a title, a company and a link.
 * Once the same role turns up on a real board it has a description, a salary
 * and a form, so the hand-entered copy is retired rather than left to show up
 * twice in the queue. Anything already drafted or applied to is left alone.
 */
export function supersedeManual(db: Db): number {
  const { changes } = db
    .prepare(
      `UPDATE postings SET stage = 'skipped', stage_reason = 'superseded by the posting on the company board'
       WHERE ats = 'manual'
         AND stage NOT IN ('needs_draft', 'in_review', 'approved', 'applied', 'skipped')
         AND EXISTS (
           SELECT 1 FROM postings live
           WHERE live.ats != 'manual'
             AND live.closed_at IS NULL
             AND lower(live.company) = lower(postings.company)
             AND lower(live.role_title) = lower(postings.role_title)
         )`,
    )
    .run()
  return Number(changes)
}

export function getPosting(db: Db, id: number): Posting | undefined {
  const row = db.prepare('SELECT * FROM postings WHERE id = ?').get(id)
  return row ? plain<Posting>(row) : undefined
}

export function postingsByStage(db: Db, stage: Stage, limit?: number): Posting[] {
  // NYC and onsite first: scoring effort goes to the roles he most wants.
  const order = `
    CASE
      WHEN location LIKE '%New York%' OR location LIKE '%NYC%' OR location LIKE '%Brooklyn%' OR location LIKE '%Manhattan%'
        THEN CASE WHEN remote_policy = 'onsite' THEN 0 WHEN remote_policy = 'hybrid' THEN 1 ELSE 2 END
      WHEN remote_policy = 'remote' THEN 3
      ELSE 4
    END, id`
  const sql = `SELECT * FROM postings WHERE stage = ? AND closed_at IS NULL ORDER BY ${order}${limit ? ' LIMIT ?' : ''}`
  const rows = limit ? db.prepare(sql).all(stage, limit) : db.prepare(sql).all(stage)
  return plainAll<Posting>(rows)
}

export function setStage(db: Db, id: number, stage: Stage, reason?: string | null): void {
  db.prepare('UPDATE postings SET stage = ?, stage_reason = ? WHERE id = ?').run(stage, reason ?? null, id)
}

export function stageCounts(db: Db): Record<string, number> {
  const rows = plainAll<{ stage: string; n: number }>(
    db.prepare('SELECT stage, count(*) AS n FROM postings WHERE closed_at IS NULL GROUP BY stage').all(),
  )
  return Object.fromEntries(rows.map((r) => [r.stage, r.n]))
}
