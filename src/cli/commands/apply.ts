import { openDb } from '../../lib/db.ts'
import { buildPlan, formatPlan } from '../../lib/apply/plan.ts'
import { args, fail } from '../util.ts'

/**
 * Prepares an application: renders the approved cover letter, gathers the
 * files, and works out what goes in every field it can see ahead of time.
 *
 * It stops there. Filling the live form happens in a Claude Code session with
 * the browser, and the submit click is his. See CLAUDE.md.
 */
export async function run(argv: string[]): Promise<void> {
  const { values, positionals } = args(argv, {
    posting: { type: 'string' },
    json: { type: 'boolean' },
  })

  const id = Number(values.posting ?? positionals[0])
  if (!Number.isFinite(id)) fail('usage: pnpm cli apply <postingId>')

  const plan = await buildPlan(id, { db: openDb() })

  if (values.json) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  console.log(formatPlan(plan))

  if (plan.ready) {
    console.log('')
    console.log('next: open the form and fill it in a session, then confirm before it is sent.')
    console.log(`  ${plan.applyUrl}`)
  }
  if (!plan.ready) process.exitCode = 1
}
