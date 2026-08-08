import { plainAll, type Db } from './db.ts'
import { normalizeCompany, normalizeRole } from './dedupe.ts'
import type { Application, Posting } from './types.ts'

/**
 * Whether he has already applied to a posting.
 *
 * The scoring queue was handing back roles that were already in the tracker,
 * including one Moment had rejected the same day. Reading a posting he cannot
 * act on costs a model pass and, worse, a second application to a company that
 * has already said no.
 *
 * Matching reuses the tracker's own normalisation, so "Senior Product Designer
 * (Founding)" and "Product Designer" at one company count as the same role
 * while genuinely different reqs stay separate.
 */

export interface PriorApplication {
  status: string
  role: string
  applied_at: string | null
}

export function priorApplications(db: Db): Map<string, PriorApplication> {
  const rows = plainAll<Application>(
    db.prepare('SELECT company, role, status, applied_at, posting_id FROM applications').all(),
  )
  const byKey = new Map<string, PriorApplication>()
  const rank = (s: string) => (s === 'rejected' ? 3 : s === 'interviewing' || s === 'offer' ? 2 : 1)

  for (const r of rows) {
    const key = `${normalizeCompany(r.company)}::${normalizeRole(r.role)}`
    const existing = byKey.get(key)
    // A rejection outranks an application: it is the fact that changes what
    // he should do next.
    if (!existing || rank(r.status) > rank(existing.status)) {
      byKey.set(key, { status: r.status, role: r.role, applied_at: r.applied_at })
    }
  }
  return byKey
}

export function priorFor(
  prior: Map<string, PriorApplication>,
  posting: Pick<Posting, 'company' | 'role_title'>,
): PriorApplication | undefined {
  return prior.get(`${normalizeCompany(posting.company)}::${normalizeRole(posting.role_title)}`)
}
