import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { PATHS } from './paths.ts'

/**
 * The one place that opens the database. Everything else takes a Db.
 *
 * node:sqlite rather than better-sqlite3: better-sqlite3 has no prebuilt binary
 * for Node 26's ABI and its gyp fallback does not compile here. The builtin is
 * stable as of Node 22.5 and covers everything this tool needs.
 */
export type Db = DatabaseSync

const SCHEMA_VERSION = 1

let cached: Db | undefined

export function openDb(path: string = PATHS.db): Db {
  if (cached && path === PATHS.db) return cached

  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  migrate(db)

  if (path === PATHS.db) cached = db
  return db
}

function migrate(db: Db): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined
  const current = row?.user_version ?? 0

  // The schema is written with IF NOT EXISTS throughout, so replaying it is
  // always safe. Future migrations go in a switch below, keyed on `current`.
  db.exec(readFileSync(PATHS.schema, 'utf8'))

  if (current < SCHEMA_VERSION) {
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  }
}

/** Runs fn inside a transaction, rolling back on any throw. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** node:sqlite returns null-prototype rows; this makes them ordinary objects. */
export function plain<T>(row: unknown): T {
  return { ...(row as object) } as T
}

export function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((r) => plain<T>(r))
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
