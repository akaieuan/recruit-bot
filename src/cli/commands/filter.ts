import { openDb, plainAll, tx } from '../../lib/db.ts'
import { evaluate } from '../../lib/filter.ts'
import { args, plural, table } from '../util.ts'
import type { Posting } from '../../lib/types.ts'

export function run(argv: string[]): void {
  const { values } = args(argv, {
    all: { type: 'boolean' },
    dry: { type: 'boolean' },
  })
  const db = openDb()

  // Default to postings not yet triaged. --all re-runs the rules over
  // everything still open, which is what you want after editing filter.ts.
  const sql = values.all
    ? "SELECT * FROM postings WHERE closed_at IS NULL AND stage IN ('new', 'auto_rejected', 'needs_score')"
    : "SELECT * FROM postings WHERE closed_at IS NULL AND stage = 'new'"
  const postings = plainAll<Posting>(db.prepare(sql).all())

  if (!postings.length) {
    console.log('nothing to filter. run: pnpm cli poll')
    return
  }

  const update = db.prepare('UPDATE postings SET stage = ?, stage_reason = ?, comp_flag = ?, years_flag = ? WHERE id = ?')
  const reasons = new Map<string, number>()
  const survivors: Posting[] = []
  let rejected = 0
  let flaggedComp = 0

  tx(db, () => {
    for (const p of postings) {
      const v = evaluate(p)
      if (v.decision === 'reject') {
        rejected++
        reasons.set(v.reason ?? 'unknown', (reasons.get(v.reason ?? 'unknown') ?? 0) + 1)
      } else {
        survivors.push(p)
      }
      if (v.compFlag) flaggedComp++
      if (!values.dry) {
        update.run(
          v.decision === 'reject' ? 'auto_rejected' : 'needs_score',
          v.reason,
          v.compFlag ? 1 : 0,
          v.yearsFlag,
          p.id,
        )
      }
    }
  })

  console.log(`${plural(postings.length, 'posting')} filtered${values.dry ? ' (dry run, nothing written)' : ''}`)
  console.log(`  ${rejected} auto-rejected, ${survivors.length} to score, ${flaggedComp} flagged under the comp floor\n`)

  if (reasons.size) {
    console.log('rejected because of:')
    console.log(table([...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => [`  ${r}`, n])))
    console.log('')
  }

  if (survivors.length) {
    console.log('surviving postings:')
    console.log(
      table(
        survivors.map((p) => {
          const v = evaluate(p)
          const comp = p.comp_min ? `$${Math.round(p.comp_min / 1000)}-${Math.round((p.comp_max ?? p.comp_min) / 1000)}k` : '-'
          return [
            `  ${p.id}`,
            p.company.slice(0, 16),
            p.role_title.slice(0, 40),
            comp,
            p.remote_policy ?? '',
            (p.location ?? '').slice(0, 18),
            v.keywordHits.length ? `${v.keywordHits.length} kw` : '',
            v.compFlag ? 'LOW COMP' : '',
            p.years_flag ?? '',
          ]
        }),
      ),
    )
    console.log(`\nnext: pnpm cli queue score`)
  }
}
