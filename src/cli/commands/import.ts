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

  fail('usage: pnpm cli import <source|csv> [path]')
}
