/**
 * Assertions live apart from the runner because the runner top-level-awaits
 * the test modules; a test importing from it would deadlock the module graph.
 */
export const state = { passed: 0, failures: [] as string[], suite: '' }

export function describe(name: string, fn: () => void): void {
  state.suite = name
  fn()
  state.suite = ''
}

export function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    state.passed++
  } else {
    state.failures.push(`${state.suite ? `${state.suite}: ` : ''}${name}${detail ? `\n    ${detail}` : ''}`)
  }
}

export function eq<T>(name: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(name, a === e, a === e ? undefined : `expected ${e}\n    actual   ${a}`)
}

export function throws(name: string, fn: () => unknown, matching?: RegExp): void {
  try {
    fn()
    check(name, false, 'expected a throw, got none')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    check(name, !matching || matching.test(msg), matching && !matching.test(msg) ? `message was: ${msg}` : undefined)
  }
}
