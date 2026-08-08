import { nowIso, plainAll, tx, type Db } from './db.ts'
import type { Application } from './types.ts'

/**
 * Merges tracker rows that are the same application arriving from two sources.
 *
 * The CSV, LinkedIn and the pipeline all name roles slightly differently:
 * "Senior Product Designer (Founding)" and "Senior Product Designer" are one
 * job. Matching is on company plus a normalised title, so genuinely different
 * roles at the same company stay separate. Figma really does have three
 * Product Designer reqs open, and collapsing those would lose real history.
 */

/** Strips the decorations that differ between sources, keeps the actual role. */
export function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\|.*$/, ' ')
    .replace(/\b(founding|senior|sr\.?|staff|principal|lead|junior|jr\.?|i{1,3}|all levels)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|llc|corp|co|ltd|labs?)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

/** Later stages beat earlier ones: an interview outranks an application. */
const STATUS_RANK: Record<string, number> = {
  offer: 7, interviewing: 6, in_progress: 5, rejected: 4,
  no_response: 3, applied: 2, withdrawn: 1, do_not_apply: 1, unknown: 0,
}

export interface DedupeSummary {
  groups: number
  merged: number
  kept: number
}

export function dedupeApplications(db: Db, opts: { dry?: boolean } = {}): DedupeSummary {
  const rows = plainAll<Application>(db.prepare('SELECT * FROM applications ORDER BY id').all())
  const groups = new Map<string, Application[]>()

  for (const r of rows) {
    const key = `${normalizeCompany(r.company)}::${normalizeRole(r.role)}`
    const list = groups.get(key) ?? []
    list.push(r)
    groups.set(key, list)
  }

  const summary: DedupeSummary = { groups: 0, merged: 0, kept: 0 }
  const dupes = [...groups.values()].filter((g) => g.length > 1)
  if (!dupes.length || opts.dry) {
    summary.groups = dupes.length
    summary.merged = dupes.reduce((n, g) => n + g.length - 1, 0)
    return summary
  }

  tx(db, () => {
    for (const group of dupes) {
      summary.groups++
      // Keep the richest row: furthest along, then the one with a real date,
      // then the one already linked to a posting.
      const winner = [...group].sort((a, b) => {
        const s = (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0)
        if (s !== 0) return s
        const d = (b.applied_at_precision === 'day' ? 1 : 0) - (a.applied_at_precision === 'day' ? 1 : 0)
        if (d !== 0) return d
        return (b.posting_id ? 1 : 0) - (a.posting_id ? 1 : 0)
      })[0]!

      const losers = group.filter((g) => g.id !== winner.id)
      const notes = [winner.notes, ...losers.map((l) => l.notes)].filter(Boolean).join(' | ')
      const url = winner.url ?? losers.find((l) => l.url)?.url ?? null
      const postingId = winner.posting_id ?? losers.find((l) => l.posting_id)?.posting_id ?? null
      const materials = winner.materials ?? losers.find((l) => l.materials)?.materials ?? null

      db.prepare(
        `UPDATE applications SET notes = ?, url = ?, posting_id = ?, materials = ?, updated_at = ? WHERE id = ?`,
      ).run(notes.slice(0, 1200), url, postingId, materials, nowIso(), winner.id)

      for (const l of losers) {
        db.prepare('DELETE FROM applications WHERE id = ?').run(l.id)
        summary.merged++
      }
      summary.kept++
    }
  })

  return summary
}
