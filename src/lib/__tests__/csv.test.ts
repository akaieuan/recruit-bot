import { check, describe, eq } from './harness.ts'
import { parseCsv, parseCsvRecords, toCsv } from '../csv.ts'
import { normalizeStatus, parseAppliedDate } from '../tracker.ts'

await describe('csv parsing', () => {
  eq('simple rows', parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']])
  eq('quoted comma', parseCsv('a,b\n"x, y",2'), [['a', 'b'], ['x, y', '2']])
  eq('escaped quote', parseCsv('a\n"say ""hi"""'), [['a'], ['say "hi"']])
  eq('embedded newline', parseCsv('a,b\n"line1\nline2",2'), [['a', 'b'], ['line1\nline2', '2']])
  eq('crlf', parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']])
  eq('no trailing newline', parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']])
  eq('empty fields kept', parseCsv('a,b,c\n1,,3'), [['a', 'b', 'c'], ['1', '', '3']])
  eq('blank lines dropped', parseCsv('a,b\n\n1,2\n'), [['a', 'b'], ['1', '2']])
  eq('bom stripped', parseCsv('﻿a,b\n1,2')[0], ['a', 'b'])

  const recs = parseCsvRecords('Company,Role\nValence,"Product Designer, Senior"')
  eq('records keyed by header', recs, [{ Company: 'Valence', Role: 'Product Designer, Senior' }])
})

await describe('csv round trip', () => {
  const header = ['Company', 'Notes']
  const rows = [['Acme', 'said "yes", eventually'], ['B, Inc', 'line1\nline2']]
  const out = toCsv(header, rows)
  const back = parseCsv(out)
  eq('survives a round trip', back, [header, ...rows])
})

await describe('status normalization', () => {
  eq('applied', normalizeStatus('Applied').status, 'applied')
  eq('no response', normalizeStatus('Applied - no response').status, 'no_response')
  // "Applied - in progress" says something is moving, not that anyone has
  // spoken to him. It must not become an interview he never had.
  eq('applied in progress is not an interview', normalizeStatus('Applied - in progress').status, 'in_progress')
  check('and is flagged to confirm', normalizeStatus('Applied - in progress').ambiguous)
  eq('rejected regardless of case', normalizeStatus('REJECTED').status, 'rejected')
  eq('do not apply', normalizeStatus('DO NOT APPLY').status, 'do_not_apply')
  eq('unknown sentinel', normalizeStatus('Unknown - confirm').status, 'unknown')

  // "In progress" without "Applied" is genuinely ambiguous: it could mean the
  // application is mid-flight or the draft is. It is flagged for one-time
  // human confirmation rather than guessed at.
  const ambiguous = normalizeStatus('In progress')
  eq('bare in progress', ambiguous.status, 'in_progress')
  check('bare in progress is flagged ambiguous', ambiguous.ambiguous)

  check('unrecognized text is flagged', normalizeStatus('mumble').ambiguous)
  eq('unrecognized text falls back to unknown', normalizeStatus('mumble').status, 'unknown')
  check('a clean status is not flagged', !normalizeStatus('Applied').ambiguous)
})

await describe('applied date parsing', () => {
  eq('iso date', parseAppliedDate('2026-08-07'), { date: '2026-08-07', precision: 'day' })
  // The CSV sentinel: the application happened at or before this date, exact
  // day unknown. Recorded as such rather than silently becoming that day.
  eq('before sentinel', parseAppliedDate('before 2026-08-07'), { date: '2026-08-07', precision: 'before' })
  eq('empty', parseAppliedDate(''), { date: null, precision: null })
  eq('junk', parseAppliedDate('sometime'), { date: null, precision: null })
})
