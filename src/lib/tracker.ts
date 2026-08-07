import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, nowIso, openDb, plainAll, today, tx, type Db } from './db.ts'
import { parseCsvRecords, toCsv } from './csv.ts'
import { PATHS } from './paths.ts'
import type { Application, ApplicationStatus } from './types.ts'

export const FOLLOW_UP_DAYS = 7

/**
 * The CSV records status as free text written by hand over months. Mapping is
 * conservative: anything not clearly recognised becomes 'unknown' and is
 * flagged, so a guess never hardens into a fact the tracker reports as true.
 */
export function normalizeStatus(raw: string): { status: ApplicationStatus; ambiguous: boolean } {
  const s = raw.trim().toLowerCase()
  if (!s) return { status: 'unknown', ambiguous: false }

  if (s === 'do not apply') return { status: 'do_not_apply', ambiguous: false }
  if (s.startsWith('unknown')) return { status: 'unknown', ambiguous: false }
  if (s.includes('reject') || s.includes('declin')) return { status: 'rejected', ambiguous: false }
  if (s.includes('offer')) return { status: 'offer', ambiguous: false }
  if (s.includes('withdrew') || s.includes('withdrawn')) return { status: 'withdrawn', ambiguous: false }
  if (s.includes('interview') || s.includes('phone screen') || s.includes('onsite')) {
    return { status: 'interviewing', ambiguous: false }
  }
  if (s.includes('no response') || s.includes('no reply') || s.includes('ghosted')) {
    return { status: 'no_response', ambiguous: false }
  }
  // "Applied - in progress" means the conversation is live.
  if (s.includes('applied') && s.includes('progress')) return { status: 'interviewing', ambiguous: false }
  if (s.includes('applied')) return { status: 'applied', ambiguous: false }
  // "In progress" on its own could mean the application is mid-flight or the
  // draft is. Flagged for one-time confirmation rather than guessed at.
  if (s.includes('progress')) return { status: 'in_progress', ambiguous: true }

  return { status: 'unknown', ambiguous: true }
}

/**
 * The CSV holds two date shapes: an ISO day, and a "before <date>" sentinel
 * covering everything applied to before the tracker existed. The sentinel is
 * preserved as a precision rather than flattened into a day that never happened.
 */
export function parseAppliedDate(raw: string): { date: string | null; precision: 'day' | 'before' | null } {
  const s = raw.trim()
  if (!s) return { date: null, precision: null }

  const before = /^before\s+(\d{4}-\d{2}-\d{2})$/i.exec(s)
  if (before?.[1]) return { date: before[1], precision: 'before' }

  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(s)
  if (iso?.[1]) return { date: iso[1], precision: 'day' }

  return { date: null, precision: null }
}

/** Only a dated application with no reply yet earns a follow-up date. */
export function followUpDate(
  status: ApplicationStatus,
  appliedAt: string | null,
  precision: 'day' | 'before' | null,
): string | null {
  if (!appliedAt || precision !== 'day') return null
  if (status !== 'applied') return null
  return addDays(appliedAt, FOLLOW_UP_DAYS)
}

export interface ImportSummary {
  rows: number
  inserted: number
  updated: number
  ambiguous: number
  unknownRole: number
  skipped: number
  byStatus: Record<string, number>
}

/**
 * Historical rows recovered from cover-letter filenames carry a company but no
 * role, because the older filename convention did not record one. The role is
 * marked unknown rather than guessed, and never left blank, so it reads as a
 * gap to fill instead of an empty cell.
 */
export const UNKNOWN_ROLE = '(role unknown)'

export function importCsv(db: Db, csvText: string): ImportSummary {
  const records = parseCsvRecords(csvText)
  const summary: ImportSummary = {
    rows: records.length, inserted: 0, updated: 0, ambiguous: 0,
    unknownRole: 0, skipped: 0, byStatus: {},
  }

  const find = db.prepare('SELECT id FROM applications WHERE company = ? AND role = ? AND ifnull(url, ?) = ifnull(?, ?)')
  const insert = db.prepare(`
    INSERT INTO applications (
      company, role, location, comp_range, ats, url, applied_at, applied_at_precision,
      materials, status, status_raw, status_ambiguous, notes, follow_up_at, source,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv_import', ?, ?)
  `)
  const update = db.prepare(`
    UPDATE applications SET
      location = ?, comp_range = ?, ats = ?, url = ?, applied_at = ?, applied_at_precision = ?,
      materials = ?, status = ?, status_raw = ?, status_ambiguous = ?, notes = ?,
      follow_up_at = ?, updated_at = ?
    WHERE id = ?
  `)

  const now = nowIso()

  tx(db, () => {
    for (const r of records) {
      const company = (r.Company ?? '').trim()
      const rawRole = (r.Role ?? '').trim()
      // A row with no company is unusable. A row with no role is history worth
      // keeping: dropping it would lose a real application silently.
      if (!company) {
        summary.skipped++
        continue
      }
      const role = rawRole || UNKNOWN_ROLE
      if (!rawRole) summary.unknownRole++

      const url = (r['Job URL'] ?? '').trim() || null
      const { status, ambiguous } = normalizeStatus(r.Status ?? '')
      const { date, precision } = parseAppliedDate(r.Date ?? '')
      const followUp = followUpDate(status, date, precision)

      summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1
      if (ambiguous) summary.ambiguous++

      const existing = find.get(company, role, '', url, '') as { id: number } | undefined
      const fields = [
        (r.Location ?? '').trim() || null,
        (r['Comp Range'] ?? '').trim() || null,
        (r['ATS / Source'] ?? '').trim() || null,
        url,
        date,
        precision,
        (r['Materials Produced'] ?? '').trim() || null,
        status,
        (r.Status ?? '').trim() || null,
        ambiguous ? 1 : 0,
        (r.Notes ?? '').trim() || null,
        followUp,
      ] as const

      if (existing) {
        update.run(...fields, now, existing.id)
        summary.updated++
      } else {
        insert.run(company, role, ...fields, now, now)
        summary.inserted++
      }
    }
  })

  return summary
}

export function importCsvCommand(path?: string): void {
  const file = path ?? join(PATHS.source, 'ieuan_job_applications.csv')
  if (!existsSync(file)) {
    throw new Error(`no CSV at ${file} (run: pnpm cli import source)`)
  }
  const db = openDb()
  const summary = importCsv(db, readFileSync(file, 'utf8'))

  console.log(`${summary.rows} rows: ${summary.inserted} inserted, ${summary.updated} updated`)
  if (summary.skipped) console.log(`${summary.skipped} skipped (no company name)`)
  console.log(`\nby status:`)
  for (const [status, n] of Object.entries(summary.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(14)} ${n}`)
  }
  if (summary.unknownRole) {
    console.log(`\n${summary.unknownRole} rows have no role recorded (recovered from cover letter filenames).`)
  }
  if (summary.ambiguous) {
    console.log(`\n${summary.ambiguous} rows have a status that could not be read confidently.`)
    console.log('They are flagged for one-time confirmation: pnpm cli tracker list --ambiguous')
  }
}

export const CSV_HEADER = [
  'Company', 'Role', 'Location', 'Comp Range', 'ATS / Source', 'Job URL',
  'Date', 'Materials Produced', 'Status', 'Notes',
]

/** Writes the tracker back out in the source CSV's own shape. */
export function exportCsv(db: Db, path?: string): { path: string; rows: number } {
  const apps = plainAll<Application>(db.prepare('SELECT * FROM applications ORDER BY company, role').all())
  const rows = apps.map((a) => [
    a.company,
    a.role,
    a.location,
    a.comp_range,
    a.ats,
    a.url,
    // Round-trips the sentinel rather than emitting a day that never happened.
    a.applied_at ? (a.applied_at_precision === 'before' ? `before ${a.applied_at}` : a.applied_at) : '',
    a.materials,
    a.status_raw ?? a.status,
    a.notes,
  ])
  const out = path ?? join(PATHS.data, 'tracker-export.csv')
  writeFileSync(out, toCsv(CSV_HEADER, rows))
  return { path: out, rows: rows.length }
}

export function dueFollowUps(db: Db): Application[] {
  return plainAll<Application>(
    db
      .prepare(
        `SELECT * FROM applications
         WHERE follow_up_at IS NOT NULL AND follow_up_at <= ? AND followed_up_at IS NULL
           AND status = 'applied'
         ORDER BY follow_up_at`,
      )
      .all(today()),
  )
}

/** Records an application made through the pipeline. */
export function recordApplication(
  db: Db,
  opts: {
    postingId: number
    company: string
    role: string
    location?: string | null
    compRange?: string | null
    ats?: string | null
    url?: string | null
    materials?: string | null
    notes?: string | null
  },
): number {
  const now = nowIso()
  const day = today()
  const existing = db
    .prepare('SELECT id FROM applications WHERE posting_id = ? OR (company = ? AND role = ?)')
    .get(opts.postingId, opts.company, opts.role) as { id: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE applications SET posting_id = ?, status = 'applied', applied_at = ?,
       applied_at_precision = 'day', follow_up_at = ?, materials = ?, updated_at = ? WHERE id = ?`,
    ).run(opts.postingId, day, addDays(day, FOLLOW_UP_DAYS), opts.materials ?? null, now, existing.id)
    return existing.id
  }

  db.prepare(
    `INSERT INTO applications (
       posting_id, company, role, location, comp_range, ats, url, applied_at,
       applied_at_precision, materials, status, status_raw, notes, follow_up_at,
       source, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'day', ?, 'applied', 'Applied', ?, ?, 'pipeline', ?, ?)`,
  ).run(
    opts.postingId, opts.company, opts.role, opts.location ?? null, opts.compRange ?? null,
    opts.ats ?? null, opts.url ?? null, day, opts.materials ?? null, opts.notes ?? null,
    addDays(day, FOLLOW_UP_DAYS), now, now,
  )
  return Number((db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id)
}
