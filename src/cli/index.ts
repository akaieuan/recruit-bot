#!/usr/bin/env node
/**
 * recruit-bot CLI. Every write to the database goes through here, so the
 * invariants live in one place and a Claude Code session never has to compose
 * SQL. Run `pnpm cli` with no arguments for the command list.
 */
type Handler = (argv: string[]) => Promise<void> | void

const COMMANDS: Record<string, { summary: string; run: Handler }> = {
  boards: {
    summary: 'seed | add <ats> <token> | list      manage the job boards that get polled',
    run: async (a) => (await import('./commands/boards.ts')).run(a),
  },
  poll: {
    summary: '[--board ats:token] [--url <url>]   fetch live postings into the database',
    run: async (a) => (await import('./commands/poll.ts')).run(a),
  },
  filter: {
    summary: '[--all]                             deterministic auto-reject pass, no model involved',
    run: async (a) => (await import('./commands/filter.ts')).run(a),
  },
  questions: {
    summary: '[--limit N]                         fetch Greenhouse application form schemas',
    run: async (a) => (await import('./commands/questions.ts')).run(a),
  },
  import: {
    summary: 'source | csv [<path>]               bring source data into data/',
    run: async (a) => (await import('./commands/import.ts')).run(a),
  },
  queue: {
    summary: '<score|research|draft|critique>     write pending work packets for a Claude Code session',
    run: async (a) => (await import('./commands/queue.ts')).run(a),
  },
  submit: {
    summary: '<step> <file|--dir>                 validate and record a session result',
    run: async (a) => (await import('./commands/submit.ts')).run(a),
  },
  render: {
    summary: 'pdf --draft <id>                    render an approved cover letter to PDF',
    run: async (a) => (await import('./commands/render.ts')).run(a),
  },
  tracker: {
    summary: 'list | followups | set              the application tracker',
    run: async (a) => (await import('./commands/tracker.ts')).run(a),
  },
  export: {
    summary: 'csv [<path>]                        write the tracker back out as CSV',
    run: async (a) => (await import('./commands/export.ts')).run(a),
  },
  status: {
    summary: '                                    what is in the pipeline and what to run next',
    run: async () => (await import('./commands/status.ts')).run(),
  },
}

export {}

function usage(): void {
  console.log('recruit-bot\n')
  console.log('Usage: pnpm cli <command> [options]\n')
  for (const [name, { summary }] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(10)} ${summary}`)
  }
  console.log('\nA generated application is a draft, never a submission.')
}

const [command, ...rest] = process.argv.slice(2)

if (!command || command === 'help' || command === '--help' || command === '-h') {
  usage()
  process.exit(0)
}

const entry = COMMANDS[command]
if (!entry) {
  console.error(`error: unknown command "${command}"\n`)
  usage()
  process.exit(1)
}

try {
  await entry.run(rest)
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
  if (process.env.DEBUG) console.error(err)
  process.exit(1)
}
