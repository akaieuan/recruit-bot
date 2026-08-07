import { openDb } from '../../lib/db.ts'
import { exportCsv } from '../../lib/tracker.ts'
import { args, fail, plural } from '../util.ts'

export function run(argv: string[]): void {
  const { positionals } = args(argv, {})
  if (positionals[0] !== 'csv') fail('usage: pnpm cli export csv [path]')

  const { path, rows } = exportCsv(openDb(), positionals[1])
  console.log(`wrote ${plural(rows, 'row')} to ${path}`)
}
