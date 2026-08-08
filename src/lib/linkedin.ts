import { addDays, nowIso, today, tx, type Db } from './db.ts'
import { FOLLOW_UP_DAYS } from './tracker.ts'
import type { ApplicationStatus } from './types.ts'

/**
 * His LinkedIn job tracker, which is a better record than the CSV ever was:
 * 319 applications with dates he did not have to remember, plus signals the
 * CSV had no way to carry ("Application viewed", "Resume downloaded").
 *
 * LinkedIn reports elapsed time rather than dates, so a date is derived and
 * marked imprecise. A row that says "2w ago" is not evidence of a specific
 * day, and recording one would be inventing a fact.
 */

export interface LinkedinRow {
  id: string
  title: string
  company: string
  location: string
  applied_ago: string
  signals?: string[]
  /** Archive only: LinkedIn showed "Not moving forward" on the card. */
  rejected?: boolean
  /** Archive only: the posting closed. Says nothing about his application. */
  closed?: boolean
}

/** "4h ago" / "2w ago" / "3mo ago" to a date, plus how precise that is. */
export function resolveAppliedDate(
  ago: string,
  from: string = today(),
): { date: string | null; precision: 'day' | 'before' } {
  const m = /^(\d+)\s*(h|hr|hour|d|day|w|week|mo|month|yr|year)/i.exec(ago.trim())
  if (!m?.[1] || !m[2]) return { date: null, precision: 'before' }

  const n = Number.parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  const days =
    unit.startsWith('h') ? 0
      : unit.startsWith('d') ? n
        : unit.startsWith('w') ? n * 7
          : unit.startsWith('mo') ? n * 30
            : unit.startsWith('m') ? n * 30
              : n * 365

  // Only "today" and a day count are precise enough to anchor a follow-up.
  // Weeks and months are rounded, so they are recorded as an upper bound.
  const precision = unit.startsWith('h') || unit.startsWith('d') ? 'day' : 'before'
  return { date: addDays(from, -days), precision }
}

/**
 * "No longer accepting applications" says the posting closed, not that he was
 * rejected, so it does not become a rejection. A viewed application or a
 * downloaded resume is real movement and is worth surfacing.
 */
export function statusFromRow(row: LinkedinRow): { status: ApplicationStatus; note: string | null } {
  // The archive is the only place an outcome is stated. "Not moving forward"
  // is a rejection he never recorded anywhere else.
  if (row.rejected) return { status: 'rejected', note: 'LinkedIn: not moving forward' }
  const base = statusFromSignals(row.signals ?? [])
  if (row.closed && !base.note) return { status: 'applied', note: 'Posting closed, no reply recorded' }
  return base
}

export function statusFromSignals(signals: string[]): { status: ApplicationStatus; note: string | null } {
  const joined = signals.join(' ').toLowerCase()
  if (/not selected|no longer under consideration/.test(joined)) {
    return { status: 'rejected', note: 'LinkedIn reported not selected' }
  }
  if (/resume downloaded/.test(joined)) return { status: 'applied', note: 'Resume downloaded' }
  if (/application viewed/.test(joined)) return { status: 'applied', note: 'Application viewed' }
  if (/no longer accepting/.test(joined)) {
    return { status: 'applied', note: 'Posting closed, no reply recorded' }
  }
  return { status: 'applied', note: null }
}

export interface LinkedinImportSummary {
  rows: number
  inserted: number
  matched: number
  viewed: number
  closed: number
  rejected: number
}

const normCompany = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(inc|llc|corp|co|ltd)$/, '')

export function importLinkedin(db: Db, rows: LinkedinRow[]): LinkedinImportSummary {
  const summary: LinkedinImportSummary = { rows: rows.length, inserted: 0, matched: 0, viewed: 0, closed: 0, rejected: 0 }
  const now = nowIso()

  const findExact = db.prepare('SELECT id, status FROM applications WHERE lower(company) = lower(?) AND lower(role) = lower(?)')
  const findCompany = db.prepare("SELECT id, status, role FROM applications WHERE lower(company) = lower(?) AND role = '(role unknown)'")

  const insert = db.prepare(`
    INSERT INTO applications (
      company, role, location, url, applied_at, applied_at_precision, status, status_raw,
      notes, follow_up_at, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'LinkedIn: applied', ?, ?, 'linkedin', ?, ?)
  `)
  const update = db.prepare(`
    UPDATE applications SET location = coalesce(nullif(location, ''), ?), url = coalesce(url, ?),
      applied_at = ?, applied_at_precision = ?, status = ?, status_ambiguous = 0,
      role = CASE WHEN role = '(role unknown)' THEN ? ELSE role END,
      notes = CASE WHEN ifnull(notes,'') = '' THEN ? ELSE notes || ' | ' || ? END,
      follow_up_at = ?, source = 'linkedin', updated_at = ?
    WHERE id = ?
  `)

  tx(db, () => {
    for (const row of rows) {
      if (!row.company || !row.title) continue

      const { date, precision } = resolveAppliedDate(row.applied_ago)
      const { status, note } = statusFromRow(row)
      if (note === 'Application viewed' || note === 'Resume downloaded') summary.viewed++
      if (row.closed || (row.signals ?? []).some((s) => /no longer accepting/i.test(s))) summary.closed++
      if (status === 'rejected') summary.rejected++

      const url = `https://www.linkedin.com/jobs/view/${row.id}`
      // A follow-up only makes sense against a date precise enough to count from.
      const followUp = status === 'applied' && date && precision === 'day' ? addDays(date, FOLLOW_UP_DAYS) : null
      const noteText = [note, `LinkedIn: applied ${row.applied_ago}`].filter(Boolean).join('. ')

      const existing =
        (findExact.get(row.company, row.title) as { id: number } | undefined) ??
        (findCompany.get(row.company) as { id: number } | undefined)

      if (existing) {
        update.run(row.location, url, date, precision, status, row.title, noteText, noteText, followUp, now, existing.id)
        if (status === 'rejected') {
          // A rejected application needs no follow-up chase.
          db.prepare('UPDATE applications SET follow_up_at = NULL WHERE id = ?').run(existing.id)
        }
        summary.matched++
      } else {
        insert.run(row.company, row.title, row.location, url, date, precision, status, noteText, followUp, now, now)
        summary.inserted++
      }
    }
  })

  return summary
}

/** Companies in the tracker that LinkedIn has never heard of. */
export function unmatchedLocalRows(db: Db, rows: LinkedinRow[]): { company: string; role: string }[] {
  const known = new Set(rows.map((r) => normCompany(r.company)))
  const local = db.prepare("SELECT company, role FROM applications WHERE source != 'linkedin'").all() as {
    company: string
    role: string
  }[]
  return local.filter((r) => !known.has(normCompany(r.company)))
}
