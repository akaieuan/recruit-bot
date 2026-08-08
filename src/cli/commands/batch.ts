import { openDb, plainAll } from '../../lib/db.ts'
import { buildPlan } from '../../lib/apply/plan.ts'
import { args, plural } from '../util.ts'
import type { Posting, Stage } from '../../lib/types.ts'

/**
 * The run sheet for a session spent applying: what is fillable right now, in
 * the order he would want to work through it, and what the rest is waiting on.
 *
 * Read only. Covers are not rendered here, so listing the batch never writes a
 * PDF as a side effect of looking at it.
 */

// NYC and in person first, the same ranking the queue uses. He will relocate
// for the right role, but the right role in New York beats the same role
// somewhere he would have to move to.
const LOCATION_ORDER = `
  CASE
    WHEN p.location LIKE '%New York%' OR p.location LIKE '%NYC%' OR p.location LIKE '%Brooklyn%' OR p.location LIKE '%Manhattan%'
      THEN CASE WHEN p.remote_policy = 'onsite' THEN 0 WHEN p.remote_policy = 'hybrid' THEN 1 ELSE 2 END
    WHEN p.remote_policy = 'remote' THEN 3
    ELSE 4
  END
`

const IN_FLIGHT: readonly Stage[] = ['approved', 'in_review', 'needs_draft', 'researched']

export async function run(argv: string[]): Promise<void> {
  const { values } = args(argv, { limit: { type: 'string' } })
  const limit = Number(values.limit ?? 10)
  const db = openDb()

  const postings = plainAll<Posting>(
    db
      .prepare(
        `SELECT p.* FROM postings p
         LEFT JOIN scores s ON s.id = (SELECT id FROM scores WHERE posting_id = p.id ORDER BY id DESC LIMIT 1)
         WHERE p.closed_at IS NULL AND p.stage IN (${IN_FLIGHT.map(() => '?').join(', ')})
         ORDER BY ${LOCATION_ORDER}, s.score DESC, p.id
         LIMIT ?`,
      )
      .all(...IN_FLIGHT, limit),
  )

  if (!postings.length) {
    console.log('nothing in flight to apply to')
    return
  }

  const ready: { posting: Posting; applyUrl: string }[] = []
  const blocked: { posting: Posting; reasons: string[] }[] = []

  for (const posting of postings) {
    const plan = await buildPlan(posting.id, { db, renderCover: false })
    if (plan.ready) {
      ready.push({ posting, applyUrl: plan.applyUrl })
      continue
    }
    // A plan can be unready with no gaps listed: that is a required form field
    // nothing resolved, which is a different problem from a missing file.
    blocked.push({ posting, reasons: plan.gaps.length ? plan.gaps : ['a required form field has no resolved value'] })
  }

  if (ready.length) {
    console.log(`READY (${ready.length}):`)
    for (const { posting, applyUrl } of ready) {
      console.log(`  ${String(posting.id).padStart(4)}  ${posting.company} / ${posting.role_title}`)
      console.log(`        ${applyUrl}`)
      console.log(`        pnpm cli apply ${posting.id} --payload`)
    }
  }

  if (blocked.length) {
    if (ready.length) console.log('')
    console.log(`NEEDS ATTENTION (${blocked.length}):`)
    for (const { posting, reasons } of blocked) {
      console.log(`  ${String(posting.id).padStart(4)}  ${posting.company} / ${posting.role_title}`)
      for (const reason of reasons.slice(0, 3)) console.log(`        - ${reason}`)
    }
  }

  console.log(
    `\n${plural(postings.length, 'posting')} in the batch: ${ready.length} ready to fill, ` +
      `${blocked.length} waiting on something first`,
  )
  console.log('one confirmation per application, and the submit is his.')
}
