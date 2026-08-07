import { check, describe, eq } from './harness.ts'
import { BODY, loadFonts, measure, toParagraphs, wrapParagraph } from '../pdf/layout.ts'

const { regular } = await loadFonts()

/**
 * The reference letter, as one paragraph of source text per block, and the
 * exact lines it broke into. Both were read out of the PDF's own content
 * stream, so if the wrapper reproduces these breaks it is laying text out the
 * same way the letters already sent were laid out.
 */
const REFERENCE_PARAGRAPH =
  'Dispatch is the hardest version of a problem I have spent four years on. A dispatcher cannot be slowed down and also cannot rubber-stamp, and almost every AI assistance pattern I have seen designs for one of those and quietly breaks the other. Make the system suggest and the person confirms without reading. Make the person verify and you have added seconds to a call where seconds are the unit of harm. The design question is not how good the model is. It is what a person can absorb in the two seconds they actually have, and whether what they absorbed was enough to catch the case where the system was wrong.'

const REFERENCE_LINES = [
  'Dispatch is the hardest version of a problem I have spent four years on. A dispatcher cannot be slowed',
  'down and also cannot rubber-stamp, and almost every AI assistance pattern I have seen designs for one',
  'of those and quietly breaks the other. Make the system suggest and the person confirms without reading.',
  'Make the person verify and you have added seconds to a call where seconds are the unit of harm. The',
  'design question is not how good the model is. It is what a person can absorb in the two seconds they',
  'actually have, and whether what they absorbed was enough to catch the case where the system was',
  'wrong.',
]

const SECOND_PARAGRAPH =
  'On ownership: I co-founded Ubik and owned product design plus the entire front end, a Next.js web app and an Electron desktop client, 1,038 commits. There was no product manager and no engineer to hand off to. I ran the user research myself, decided what was worth building, built the component system everything else sat on, shipped it, and then sat in the sessions where my decisions turned out to be wrong. Our users were people whose work has consequences when it is wrong, so the requirement was never a better model. It was a record they could defend later, under scrutiny, without remembering the session.'

const SECOND_LINES = [
  'On ownership: I co-founded Ubik and owned product design plus the entire front end, a Next.js web app',
  'and an Electron desktop client, 1,038 commits. There was no product manager and no engineer to hand',
  'off to. I ran the user research myself, decided what was worth building, built the component system',
  'everything else sat on, shipped it, and then sat in the sessions where my decisions turned out to be wrong.',
  'Our users were people whose work has consequences when it is wrong, so the requirement was never a',
  'better model. It was a record they could defend later, under scrutiny, without remembering the session.',
]

await describe('wrapping matches the reference letter', () => {
  eq('paragraph one breaks identically', wrapParagraph(REFERENCE_PARAGRAPH, regular, BODY.size), REFERENCE_LINES)
  eq('paragraph two breaks identically', wrapParagraph(SECOND_PARAGRAPH, regular, BODY.size), SECOND_LINES)
})

await describe('measurement', () => {
  const m = measure(`${REFERENCE_PARAGRAPH}\n\n${SECOND_PARAGRAPH}`, regular)
  eq('counts paragraphs', m.paragraphCount, 2)
  eq('counts lines', m.lineCount, REFERENCE_LINES.length + SECOND_LINES.length)

  // Against the reference: first body baseline 687.04, and the paragraph after
  // a seven-line block starts 20.1856 lower than that block's last line.
  eq('first baseline', m.lines[0]?.baselineY, 687.04)
  const firstParaLast = m.lines[REFERENCE_LINES.length - 1]?.baselineY ?? 0
  const secondParaFirst = m.lines[REFERENCE_LINES.length]?.baselineY ?? 0
  eq('paragraph step is leading plus gap', Math.round((firstParaLast - secondParaFirst) * 1000) / 1000, 20.186)

  check('two paragraphs do not overflow', !m.overflow)
})

await describe('overflow detection', () => {
  const long = Array.from({ length: 12 }, () => REFERENCE_PARAGRAPH).join('\n\n')
  const m = measure(long, regular)
  check('a very long letter overflows', m.overflow)
  check('and reports how far past the page it runs', m.overflowBy > 0)

  const short = measure('One short line.', regular)
  check('a short letter does not overflow', !short.overflow)
})

await describe('paragraph splitting', () => {
  eq('blank line separates', toParagraphs('a\n\nb'), ['a', 'b'])
  eq('single newline joins', toParagraphs('a\nb'), ['a b'])
  eq('trailing whitespace dropped', toParagraphs('a\n\n\n  \n\nb  '), ['a', 'b'])
  eq('crlf handled', toParagraphs('a\r\n\r\nb'), ['a', 'b'])
})

await describe('long word handling', () => {
  // A URL wider than the column is left long rather than hyphenated.
  const lines = wrapParagraph(`See ${'x'.repeat(200)} here`, regular, BODY.size)
  check('an over-wide word gets its own line', lines.length >= 2)
  check('and is not broken', lines.some((l) => l.includes('x'.repeat(200))))
})
