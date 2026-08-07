import { nowIso, plain, plainAll, type Db } from './db.ts'
import type { ContactVariant, Draft, DraftKind, DraftStatus } from './types.ts'

export interface NewDraft {
  postingId: number
  kind: DraftKind
  questionKey?: string | null
  body: string
  contactVariant?: ContactVariant
  factsUsed: string[]
  jdLines?: string[]
}

/**
 * Drafts are versioned rather than overwritten. A revision loop that discards
 * the previous body makes it impossible to see what the review changed, and
 * the review is the part of this pipeline that matters.
 */
export function insertDraft(db: Db, d: NewDraft): number {
  const now = nowIso()
  const prev = db
    .prepare(
      `SELECT max(version) AS v FROM drafts
       WHERE posting_id = ? AND kind = ? AND ifnull(question_key, '') = ifnull(?, '')`,
    )
    .get(d.postingId, d.kind, d.questionKey ?? null) as { v: number | null } | undefined
  const version = (prev?.v ?? 0) + 1

  db.prepare(
    `INSERT INTO drafts (
       posting_id, kind, question_key, version, body, contact_variant,
       facts_used, jd_lines, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
  ).run(
    d.postingId,
    d.kind,
    d.questionKey ?? null,
    version,
    d.body,
    d.contactVariant ?? 'design',
    JSON.stringify(d.factsUsed),
    JSON.stringify(d.jdLines ?? []),
    now,
    now,
  )
  return Number((db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id)
}

export function getDraft(db: Db, id: number): Draft | undefined {
  const row = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id)
  return row ? plain<Draft>(row) : undefined
}

/** The live drafts for a posting: newest version of each kind and question. */
export function latestDrafts(db: Db, postingId: number): Draft[] {
  return plainAll<Draft>(
    db
      .prepare(
        `SELECT d.* FROM drafts d
         JOIN (
           SELECT kind, ifnull(question_key, '') AS qk, max(version) AS v
           FROM drafts WHERE posting_id = ? GROUP BY kind, qk
         ) latest
           ON d.kind = latest.kind
          AND ifnull(d.question_key, '') = latest.qk
          AND d.version = latest.v
         WHERE d.posting_id = ?
         ORDER BY d.kind DESC, d.id`,
      )
      .all(postingId, postingId),
  )
}

export function updateDraftBody(db: Db, id: number, body: string): void {
  db.prepare('UPDATE drafts SET body = ?, updated_at = ? WHERE id = ?').run(body, nowIso(), id)
}

export function setDraftStatus(db: Db, id: number, status: DraftStatus, reviewNote?: string | null): void {
  db.prepare('UPDATE drafts SET status = ?, review_note = ?, updated_at = ? WHERE id = ?').run(
    status,
    reviewNote ?? null,
    nowIso(),
    id,
  )
}

export function setDraftCritique(db: Db, id: number, critique: unknown): void {
  db.prepare('UPDATE drafts SET critique = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(critique),
    nowIso(),
    id,
  )
}

export function setDraftPdfPath(db: Db, id: number, path: string): void {
  db.prepare('UPDATE drafts SET pdf_path = ?, updated_at = ? WHERE id = ?').run(path, nowIso(), id)
}

export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}
