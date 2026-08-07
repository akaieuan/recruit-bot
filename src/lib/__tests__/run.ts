/**
 * Tiny assertion runner. `pnpm test`.
 *
 * These cover the rules that decide whether a posting is seen at all and
 * whether a draft is allowed out: the places where a silent regression would
 * be expensive and invisible.
 */
import { state } from './harness.ts'

const modules = ['./normalize.test.ts', './filter.test.ts', './csv.test.ts', './validate.test.ts', './layout.test.ts']

for (const m of modules) {
  await import(m)
}

console.log(`\n${state.passed} passed, ${state.failures.length} failed`)
if (state.failures.length) {
  console.log('')
  for (const f of state.failures) console.log(`  FAIL  ${f}`)
  process.exit(1)
}
