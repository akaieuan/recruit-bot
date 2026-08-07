import { nowIso, plainAll, type Db } from './db.ts'
import { parseAshbyUrl } from './ashby.ts'
import { parseGreenhouseUrl } from './greenhouse.ts'

export interface Board {
  id: number
  ats: 'ashby' | 'greenhouse'
  board_token: string
  company: string | null
  active: number
  added_at: string
  notes: string | null
}

/**
 * Boards confirmed to answer the public API. Everything else gets discovered
 * from job URLs in the tracker CSV or added by hand as it turns up.
 *
 * Ashby's board response carries no company name, only the token, so a display
 * name is recorded here. Without one the pipeline shows "appliedlabs" where it
 * means "Applied Labs".
 */
export const SEED_BOARDS: { ats: 'ashby' | 'greenhouse'; token: string; company: string }[] = [
  { ats: 'ashby', token: 'credal', company: 'Credal' },
  { ats: 'ashby', token: 'sapien', company: 'Sapien' },
  { ats: 'ashby', token: 'tenexlabs', company: 'Tenex Labs' },
  { ats: 'ashby', token: 'grow-therapy', company: 'Grow Therapy' },
  { ats: 'ashby', token: 'probook', company: 'Probook' },
  { ats: 'ashby', token: 'moment', company: 'Moment' },
  // The handoff records this as "applied-labs"; the live token has no hyphen.
  { ats: 'ashby', token: 'appliedlabs', company: 'Applied Labs' },
  { ats: 'ashby', token: 'revin', company: 'Revin' },
  { ats: 'ashby', token: 'krea', company: 'Krea' },
  { ats: 'greenhouse', token: 'vts', company: 'VTS' },
]

/**
 * Last resort when no display name is known: "grow-therapy" reads better as
 * "Grow Therapy" than as itself, even though a single lowercase word cannot be
 * split back into words.
 */
export function prettifyToken(token: string): string {
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function companyForBoard(db: Db, ats: string, token: string): string {
  const row = db.prepare('SELECT company FROM boards WHERE ats = ? AND board_token = ?').get(ats, token) as
    | { company: string | null }
    | undefined
  return row?.company?.trim() || prettifyToken(token)
}

export function addBoard(db: Db, ats: 'ashby' | 'greenhouse', token: string, company?: string): boolean {
  const existing = db.prepare('SELECT id FROM boards WHERE ats = ? AND board_token = ?').get(ats, token)
  if (existing) return false
  db.prepare('INSERT INTO boards (ats, board_token, company, added_at) VALUES (?, ?, ?, ?)').run(
    ats, token, company ?? null, nowIso(),
  )
  return true
}

export function listBoards(db: Db, onlyActive = true): Board[] {
  const sql = `SELECT * FROM boards${onlyActive ? ' WHERE active = 1' : ''} ORDER BY ats, board_token`
  return plainAll<Board>(db.prepare(sql).all())
}

export function setBoardActive(db: Db, ats: string, token: string, active: boolean): void {
  db.prepare('UPDATE boards SET active = ? WHERE ats = ? AND board_token = ?').run(active ? 1 : 0, ats, token)
}

/** Recognises a board token in any Ashby or Greenhouse URL. */
export function boardFromUrl(url: string): { ats: 'ashby' | 'greenhouse'; token: string } | null {
  const a = parseAshbyUrl(url)
  if (a) return { ats: 'ashby', token: a.token }
  const g = parseGreenhouseUrl(url)
  if (g) return { ats: 'greenhouse', token: g.token }
  return null
}

/** Harvests board tokens out of URLs already recorded in the tracker. */
export function discoverBoardsFromApplications(db: Db): number {
  const rows = plainAll<{ url: string | null; company: string | null }>(
    // Single quotes: SQLite reads a double-quoted token as an identifier.
    db.prepare("SELECT url, company FROM applications WHERE url IS NOT NULL AND url != ''").all(),
  )
  let added = 0
  for (const row of rows) {
    if (!row.url) continue
    const board = boardFromUrl(row.url)
    if (board && addBoard(db, board.ats, board.token, row.company ?? undefined)) added++
  }
  return added
}
