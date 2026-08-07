import { openDb } from '../../lib/db.ts'
import { buildQueue } from '../../lib/queue.ts'
import { WORK_STEPS, type WorkStep } from '../../lib/paths.ts'
import { args, fail, plural } from '../util.ts'

export function run(argv: string[]): void {
  const { values, positionals } = args(argv, { limit: { type: 'string' } })
  const step = positionals[0] as WorkStep | undefined

  if (!step || !WORK_STEPS.includes(step)) {
    fail(`usage: pnpm cli queue <${WORK_STEPS.join('|')}> [--limit N]`)
  }

  const result = buildQueue(openDb(), step, Number(values.limit ?? 10))

  if (!result.written) {
    console.log(`nothing waiting for ${step}`)
    return
  }

  console.log(`${plural(result.written, 'packet')} written to ${result.dir}`)
  if (result.cleared) console.log(`(cleared ${plural(result.cleared, 'stale packet')} first)`)
  console.log(`\nread each one, then write your result next to it:`)
  console.log(`  data/work/${step}/results/<id>.json`)
  console.log(`\nthen: pnpm cli submit ${step} --dir`)
}
