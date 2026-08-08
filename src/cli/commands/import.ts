import { args, fail } from '../util.ts'

export async function run(argv: string[]): Promise<void> {
  const { values, positionals } = args(argv, {
    emplyob: { type: 'string' },
    handoff: { type: 'string' },
  })
  const what = positionals[0]

  if (what === 'source') {
    const { importSource } = await import('../../../scripts/import-source.ts')
    importSource({ emplyob: values.emplyob, handoff: values.handoff })
    return
  }

  if (what === 'csv') {
    const { importCsvCommand } = await import('../../lib/tracker.ts')
    importCsvCommand(positionals[1])
    return
  }

  if (what === 'linkedin') {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { openDb } = await import('../../lib/db.ts')
    const { PATHS } = await import('../../lib/paths.ts')
    const { importLinkedin, unmatchedLocalRows } = await import('../../lib/linkedin.ts')

    const file = positionals[1] ?? join(PATHS.source, 'linkedin-applied.json')
    const rows = JSON.parse(readFileSync(file, 'utf8'))
    const db = openDb()
    const s = importLinkedin(db, rows)

    console.log(`${s.rows} LinkedIn applications: ${s.inserted} new, ${s.matched} matched to existing rows`)
    console.log(`  ${s.viewed} viewed or resume downloaded, ${s.closed} against postings that have since closed`)
    if (s.rejected) console.log(`  ${s.rejected} came back as not moving forward`)

    const orphans = unmatchedLocalRows(db, rows)
    if (orphans.length) {
      console.log(`\n${orphans.length} tracker rows LinkedIn has no record of (applied direct, not through LinkedIn):`)
      console.log('  ' + orphans.map((o) => o.company).join(', '))
    }
    return
  }

  fail('usage: pnpm cli import <source|csv|linkedin> [path]')
}
