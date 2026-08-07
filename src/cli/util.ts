import { parseArgs, type ParseArgsConfig } from 'node:util'

/**
 * These live apart from index.ts on purpose: index.ts has a top-level await,
 * so a command module importing from it would deadlock the module graph.
 */
export function args<T extends ParseArgsConfig['options']>(argv: string[], options: T) {
  return parseArgs({ args: argv, options, allowPositionals: true, strict: true })
}

export function fail(message: string): never {
  console.error(`error: ${message}`)
  process.exit(1)
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Fixed-width table for CLI output; no dependency, no cleverness. */
export function table(rows: (string | number | null | undefined)[][]): string {
  if (!rows.length) return ''
  const cells = rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))))
  const widths: number[] = []
  for (const row of cells) {
    row.forEach((c, i) => {
      widths[i] = Math.max(widths[i] ?? 0, c.length)
    })
  }
  return cells
    .map((row) => row.map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i] ?? 0))).join('  ').trimEnd())
    .join('\n')
}
