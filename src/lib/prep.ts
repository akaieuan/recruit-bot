import { nowIso, plain, plainAll, type Db } from './db.ts'
import { parseJsonArray } from './drafts.ts'
import type { Posting } from './types.ts'

/**
 * Interview prep for a posting he is actually talking to.
 *
 * The shape comes from the Probook doc, which worked: what the product really
 * is before anything else, the vocabulary that is expensive to get wrong, the
 * angle only he can take, an honest account of where he does not match, and
 * questions that show he understands the problem rather than filling a slot.
 *
 * The "where you lack" section is the point rather than a disclaimer. Walking
 * in knowing the three things they will push on is what makes the other
 * sections usable.
 */

export interface VocabTerm {
  term: string
  meaning: string
}

export interface Prep {
  id: number
  posting_id: number
  written_at: string
  headline: string | null
  product: string | null
  vocabulary: string | null
  the_angle: string | null
  why_you_fit: string | null
  where_you_lack: string | null
  scoped: string | null
  questions: string | null
  this_week: string | null
  sources: string | null
}

export interface PrepView extends Prep {
  posting: Posting
  vocab: VocabTerm[]
  fit: string[]
  lack: string[]
  asks: string[]
  week: string[]
  sourceList: string[]
}

export interface PrepInput {
  posting_id: number
  headline?: string
  product?: string
  vocabulary?: VocabTerm[]
  the_angle?: string
  why_you_fit?: string[]
  where_you_lack?: string[]
  scoped?: string
  questions?: string[]
  this_week?: string[]
  sources?: string[]
}

export function upsertPrep(db: Db, input: PrepInput): void {
  const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v))
  db.prepare(
    `INSERT INTO prep (
       posting_id, written_at, headline, product, vocabulary, the_angle,
       why_you_fit, where_you_lack, scoped, questions, this_week, sources
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (posting_id) DO UPDATE SET
       written_at = excluded.written_at, headline = excluded.headline,
       product = excluded.product, vocabulary = excluded.vocabulary,
       the_angle = excluded.the_angle, why_you_fit = excluded.why_you_fit,
       where_you_lack = excluded.where_you_lack, scoped = excluded.scoped,
       questions = excluded.questions, this_week = excluded.this_week,
       sources = excluded.sources`,
  ).run(
    input.posting_id, nowIso(), input.headline ?? null, input.product ?? null,
    json(input.vocabulary), input.the_angle ?? null, json(input.why_you_fit),
    json(input.where_you_lack), input.scoped ?? null, json(input.questions),
    json(input.this_week), json(input.sources),
  )
}

function hydrate(row: Prep, posting: Posting): PrepView {
  let vocab: VocabTerm[] = []
  try {
    vocab = row.vocabulary ? (JSON.parse(row.vocabulary) as VocabTerm[]) : []
  } catch {
    vocab = []
  }
  return {
    ...row,
    posting,
    vocab,
    fit: parseJsonArray(row.why_you_fit),
    lack: parseJsonArray(row.where_you_lack),
    asks: parseJsonArray(row.questions),
    week: parseJsonArray(row.this_week),
    sourceList: parseJsonArray(row.sources),
  }
}

/**
 * Everything worth prepping for, live conversations first. A posting he has
 * applied to but not heard from still earns a page: the prep is what makes the
 * reply useful when it comes.
 */
export function prepRows(db: Db): PrepView[] {
  const rows = plainAll<Prep & Posting & { prep_id: number }>(
    db
      .prepare(
        `SELECT pr.*, p.id AS posting_id
         FROM prep pr JOIN postings p ON p.id = pr.posting_id
         ORDER BY pr.written_at DESC`,
      )
      .all(),
  )
  return rows
    .map((r) => {
      const posting = plain<Posting>(db.prepare('SELECT * FROM postings WHERE id = ?').get(r.posting_id))
      return hydrate(r as unknown as Prep, posting)
    })
    .filter(Boolean)
}

export function prepFor(db: Db, postingId: number): PrepView | null {
  const row = db.prepare('SELECT * FROM prep WHERE posting_id = ?').get(postingId)
  if (!row) return null
  const posting = plain<Posting>(db.prepare('SELECT * FROM postings WHERE id = ?').get(postingId))
  return hydrate(plain<Prep>(row), posting)
}

/** Postings worth writing prep for: a live conversation, or a strong application. */
export function needsPrep(db: Db): Posting[] {
  return plainAll<Posting>(
    db
      .prepare(
        `SELECT p.* FROM postings p
         JOIN applications a ON a.posting_id = p.id
         WHERE a.status IN ('interviewing', 'in_progress')
           AND NOT EXISTS (SELECT 1 FROM prep WHERE posting_id = p.id)
         ORDER BY p.id`,
      )
      .all(),
  )
}
