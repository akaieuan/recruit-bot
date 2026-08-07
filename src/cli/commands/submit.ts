import { openDb } from '../../lib/db.ts'
import { archive, listResults, readResult } from '../../lib/queue.ts'
import { submitResult, SubmitError } from '../../lib/submit.ts'
import { WORK_STEPS, type WorkStep } from '../../lib/paths.ts'
import { args, fail, plural } from '../util.ts'

export async function run(argv: string[]): Promise<void> {
  const { values, positionals } = args(argv, { dir: { type: 'boolean' } })
  const step = positionals[0] as WorkStep | undefined

  if (!step || !WORK_STEPS.includes(step)) {
    fail(`usage: pnpm cli submit <${WORK_STEPS.join('|')}> <file> | --dir`)
  }

  const files = values.dir
    ? listResults(step)
    : positionals.slice(1).map((p) => ({ path: p, id: p.split('/').pop()?.replace(/\.json$/, '') ?? p }))

  if (!files.length) {
    console.log(values.dir ? `no result files in data/work/${step}/results/` : 'no files given')
    return
  }

  const db = openDb()
  let ok = 0
  const failures: string[] = []

  for (const file of files) {
    try {
      const outcome = await submitResult(db, step, readResult(file.path))
      archive(step, file.id)
      ok++
      console.log(`  ok    ${file.id}  ${outcome.message}`)
      if (outcome.warnings) console.log(outcome.warnings)
    } catch (err) {
      const message = err instanceof SubmitError || err instanceof Error ? err.message : String(err)
      // The result file stays put so it can be corrected and resubmitted.
      failures.push(`  FAIL  ${file.id}\n${indent(message)}`)
    }
  }

  if (failures.length) {
    console.log('')
    for (const f of failures) console.log(f)
  }

  console.log(`\n${plural(ok, 'result')} applied, ${failures.length} rejected`)
  if (failures.length) {
    console.log('Rejected files were left in place. Fix them and run submit again.')
    process.exitCode = 1
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `        ${l}`)
    .join('\n')
}
