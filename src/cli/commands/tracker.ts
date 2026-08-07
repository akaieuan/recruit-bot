import { nowIso, openDb, plainAll, today } from '../../lib/db.ts'
import { dueFollowUps, followUpDate } from '../../lib/tracker.ts'
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '../../lib/types.ts'
import { args, fail, plural, table } from '../util.ts'

export function run(argv: string[]): void {
  const { values, positionals } = args(argv, {
    ambiguous: { type: 'boolean' },
    status: { type: 'string' },
    id: { type: 'string' },
    date: { type: 'string' },
    note: { type: 'string' },
    limit: { type: 'string' },
  })
  const sub = positionals[0] ?? 'list'
  const db = openDb()

  if (sub === 'followups') {
    const due = dueFollowUps(db)
    if (!due.length) {
      console.log('no follow-ups due')
      return
    }
    console.log(`${plural(due.length, 'follow-up')} due as of ${today()}:\n`)
    console.log(table([
      ['ID', 'COMPANY', 'ROLE', 'APPLIED', 'DUE'],
      ...due.map((a) => [a.id, a.company, a.role.slice(0, 34), a.applied_at ?? '', a.follow_up_at ?? '']),
    ]))
    console.log('\nmark one done: pnpm cli tracker set --id <id> --note "followed up"')
    return
  }

  if (sub === 'set') {
    const id = Number(values.id)
    if (!Number.isFinite(id)) fail('usage: pnpm cli tracker set --id <id> [--status <status>] [--date <YYYY-MM-DD>] [--note <text>]')
    const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application | undefined
    if (!row) fail(`no application with id ${id}`)

    const status = (values.status as ApplicationStatus | undefined) ?? row.status
    if (values.status && !APPLICATION_STATUSES.includes(status)) {
      fail(`status must be one of: ${APPLICATION_STATUSES.join(', ')}`)
    }
    const appliedAt = values.date ?? row.applied_at
    const precision = values.date ? 'day' : row.applied_at_precision

    db.prepare(
      `UPDATE applications SET status = ?, applied_at = ?, applied_at_precision = ?,
       follow_up_at = ?, followed_up_at = ?, status_ambiguous = 0, updated_at = ? WHERE id = ?`,
    ).run(
      status,
      appliedAt,
      precision,
      followUpDate(status, appliedAt, precision),
      values.note ? nowIso() : row.followed_up_at,
      nowIso(),
      id,
    )
    console.log(`${row.company} / ${row.role}: ${row.status} -> ${status}`)
    return
  }

  if (sub === 'list') {
    const where: string[] = []
    const params: (string | number)[] = []
    if (values.ambiguous) where.push('status_ambiguous = 1')
    if (values.status) {
      where.push('status = ?')
      params.push(values.status)
    }
    const limit = Number(values.limit ?? 40)
    const rows = plainAll<Application>(
      db
        .prepare(
          `SELECT * FROM applications ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY (applied_at IS NULL), applied_at DESC, company LIMIT ?`,
        )
        .all(...params, limit),
    )

    const total = (db.prepare('SELECT count(*) AS n FROM applications').get() as { n: number }).n
    if (!rows.length) {
      console.log(`no matching applications (${total} total)`)
      return
    }

    console.log(table([
      ['ID', 'COMPANY', 'ROLE', 'STATUS', 'APPLIED', 'FOLLOW-UP'],
      ...rows.map((a) => [
        a.id,
        a.company.slice(0, 20),
        a.role.slice(0, 32),
        a.status + (a.status_ambiguous ? ' (?)' : ''),
        a.applied_at ? (a.applied_at_precision === 'before' ? `<= ${a.applied_at}` : a.applied_at) : '',
        a.follow_up_at ?? '',
      ]),
    ]))
    console.log(`\nshowing ${rows.length} of ${total}`)
    return
  }

  fail('usage: pnpm cli tracker <list|followups|set>')
}
