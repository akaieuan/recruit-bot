import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, nowIso, openDb, plain, today, tx, type Db } from '../../lib/db.ts'
import { readConfig } from '../../lib/facts.ts'
import { PATHS } from '../../lib/paths.ts'
import { coverFileName } from '../../lib/pdf/cover.ts'
import { getPosting, setStage } from '../../lib/postings.ts'
import { FOLLOW_UP_DAYS } from '../../lib/tracker.ts'
import { APPLICATION_STATUSES, type Application, type ApplicationStatus, type Posting } from '../../lib/types.ts'
import { args, fail, table } from '../util.ts'

/**
 * The one step after he has pressed submit: the tracker row, the follow-up
 * date and the posting's stage, all written together.
 *
 * It records what he did. It does not do it: running this before the form is
 * actually sent puts a date in the tracker that never happened.
 */
export function run(argv: string[]): void {
  const { values, positionals } = args(argv, {
    posting: { type: 'string' },
    status: { type: 'string' },
    note: { type: 'string' },
  })

  const id = Number(values.posting ?? positionals[0])
  if (!Number.isFinite(id)) fail('usage: pnpm cli record <postingId> [--status applied] [--note <text>]')

  const status = (values.status as ApplicationStatus | undefined) ?? 'applied'
  if (!APPLICATION_STATUSES.includes(status)) fail(`status must be one of: ${APPLICATION_STATUSES.join(', ')}`)

  const db = openDb()
  const posting = getPosting(db, id)
  if (!posting) fail(`no posting with id ${id}`)

  const day = today()
  const now = nowIso()

  // Matched on the posting first, then on company and role, because the row
  // may already exist from the CSV or from LinkedIn under a different case.
  const existingRow = db
    .prepare(
      `SELECT * FROM applications
       WHERE posting_id = ? OR (lower(company) = lower(?) AND lower(role) = lower(?))
       ORDER BY (posting_id = ?) DESC LIMIT 1`,
    )
    .get(id, posting.company, posting.role_title, id)
  const existing = existingRow ? plain<Application>(existingRow) : undefined

  // Only files that are actually on disk get claimed as sent.
  const materials = ['Resume']
  if (renderedCover(posting)) materials.push('Cover letter')

  const entry = [`Submitted ${day} via ${posting.ats}.`, values.note?.trim()].filter(Boolean).join(' ')
  const notes = existing?.notes ? `${existing.notes} | ${entry}` : entry

  const appId = tx(db, () => {
    const sent = materials.join(', ')
    const rowId = existing
      ? update(db, existing.id, posting, status, sent, notes, day, now)
      : insert(db, posting, status, sent, notes, day, now)
    setStage(db, id, 'applied', `submitted ${day}`)
    return rowId
  })

  const row = plain<Application>(db.prepare('SELECT * FROM applications WHERE id = ?').get(appId))
  console.log(`tracker #${row.id} ${existing ? 'updated' : 'added'} for posting ${id}\n`)
  console.log(
    table([
      ['company', row.company],
      ['role', row.role],
      ['status', row.status],
      ['applied', row.applied_at ?? ''],
      ['follow-up', row.follow_up_at ?? ''],
      ['materials', row.materials ?? ''],
      ['url', row.url ?? ''],
      ['notes', row.notes ?? ''],
    ]),
  )
}

function update(
  db: Db, appId: number, posting: Posting, status: ApplicationStatus,
  materials: string, notes: string, day: string, now: string,
): number {
  db.prepare(
    `UPDATE applications SET
       posting_id = ?, ats = ?, url = ?, location = ?, comp_range = ?,
       status = ?, status_raw = ?, status_ambiguous = 0,
       applied_at = ?, applied_at_precision = 'day', follow_up_at = ?,
       materials = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    posting.id, posting.ats, posting.url, posting.location, compRange(posting),
    status, statusRaw(status), day, addDays(day, FOLLOW_UP_DAYS), materials, notes, now, appId,
  )
  return appId
}

function insert(
  db: Db, posting: Posting, status: ApplicationStatus,
  materials: string, notes: string, day: string, now: string,
): number {
  db.prepare(
    `INSERT INTO applications (
       posting_id, company, role, location, comp_range, ats, url, applied_at,
       applied_at_precision, materials, status, status_raw, status_ambiguous,
       notes, follow_up_at, source, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'day', ?, ?, ?, 0, ?, ?, 'pipeline', ?, ?)`,
  ).run(
    posting.id, posting.company, posting.role_title, posting.location, compRange(posting),
    posting.ats, posting.url, day, materials, status, statusRaw(status), notes, addDays(day, FOLLOW_UP_DAYS), now, now,
  )
  return Number((db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id)
}

/** status_raw records what this command was told, in the words it was told. */
function statusRaw(status: ApplicationStatus): string {
  const words = status.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Only what the employer published. A missing figure stays missing. */
function compRange(posting: Posting): string | null {
  const k = (n: number) => `$${Math.round(n / 1000)}k`
  const { comp_min: min, comp_max: max } = posting
  if (min && max) return `${k(min)}-${Math.round(max / 1000)}k`
  if (min) return k(min)
  if (max) return k(max)
  return null
}

/**
 * The cover PDF is named for the company and role, and lands in the shared
 * upload folder when there is one, so either location counts as rendered.
 */
function renderedCover(posting: Posting): boolean {
  const config = readConfig()
  const name = coverFileName(posting.company, posting.role_title, config.name)
  return [config.uploads?.covers_dir, PATHS.outCovers]
    .filter((dir): dir is string => Boolean(dir))
    .some((dir) => existsSync(join(dir, name)))
}
