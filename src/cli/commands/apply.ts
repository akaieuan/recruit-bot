import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { openDb } from '../../lib/db.ts'
import { buildPlan, formatPlan, type ApplicationPlan } from '../../lib/apply/plan.ts'
import { PATHS } from '../../lib/paths.ts'
import { args, fail, plural } from '../util.ts'

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
    payload: { type: 'boolean' },
    out: { type: 'string' },
    force: { type: 'boolean' },
  })

  const id = Number(values.posting ?? positionals[0])
  if (!Number.isFinite(id)) fail('usage: pnpm cli apply <postingId> [--payload [--out <path>]]')

  const plan = await buildPlan(id, { db: openDb() })

  if (values.payload) {
    await writePayload(plan, values.out, values.force === true)
    return
  }

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

/**
 * Writes the script that fills the live form, for the session to run in the
 * tab. Only a ready plan earns one: a payload built over a gap would put a
 * blank or a guess into a real field. --force exists for a gap he has already
 * seen and decided to fill by hand.
 *
 * The script fills and uploads. It never submits.
 */
async function writePayload(plan: ApplicationPlan, out: string | undefined, force: boolean): Promise<void> {
  if (!plan.ready && !force) {
    console.error('not ready to fill:')
    for (const gap of plan.gaps) console.error(`  - ${gap}`)
    if (!plan.gaps.length) console.error('  - a required form field has no resolved value')
    console.error(`\nresolve those (pnpm cli apply ${plan.posting.id}), or pass --force to build it anyway.`)
    process.exit(1)
  }

  const { buildAshbyPayload, buildGreenhousePayload } = await import('../../lib/apply/payload.ts')
  const build =
    plan.posting.ats === 'ashby' ? buildAshbyPayload : plan.posting.ats === 'greenhouse' ? buildGreenhousePayload : null
  if (!build) fail(`no payload builder for ats "${plan.posting.ats}". Fill this one by hand.`)

  // Files are never attached by script. Fetching one into a form is the part
  // that reads as automation to an ATS, and the account it would cost is his.
  const built = build(plan, {})

  const path = out ?? join(PATHS.work, 'apply', `${plan.posting.id}.js`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, built.js)

  console.log(`${plan.posting.company} / ${plan.posting.role_title}`)
  console.log(`${plural(built.fills, 'field')} to fill`)
  for (const warning of built.warnings) console.log(`  ${warning}`)
  if (plan.files.cover) console.log(`\ncover letter ready to upload: ${plan.files.cover}`)
  console.log(`resume ready to upload: ${plan.profile.resume_path}`)
  console.log(`\n${path}`)
  console.log(plan.applyUrl)
}
