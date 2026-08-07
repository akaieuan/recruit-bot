import { check, describe, eq } from './harness.ts'
import { setFactsForTesting } from '../facts.ts'
import { validateDraft } from '../validate.ts'

setFactsForTesting({
  generated_at: '2026-01-01',
  source: 'test',
  facts: [
    { id: 'ubik.commits', text: '1,038 commits over three years', tags: ['ubik'] },
    { id: 'oss.hitl-kit', text: 'HITL Kit: 19 React primitives', tags: ['oss'] },
  ],
  gaps: [
    { id: 'gap.sql', text: 'No real SQL. Rate Beginner.', patterns: ['SQL'] },
    { id: 'gap.rn', text: 'No React Native shipped.', patterns: ['React Native'] },
    { id: 'gap.manage', text: 'Never managed a design team', patterns: ['managed a design team'] },
  ],
})

const GOOD = `I am applying for the Design Engineer role at Acme.

I co-founded Ubik and wrote 1,038 commits over three years. I was the only designer and the primary front-end builder, which meant the design system and the shipped interface were the same decision.

The failure is never the agent being wrong. It is the agent being wrong in a way that looked right and got approved. Our first review interface handed people a finished conclusion, and they approved nearly all of it.

I build the error, empty, loading and partial states first and the success state last. The success state is the easy one, and building it first is how you run out of time.

Brooklyn, four days onsite is fine. Work is at akabuild.dev.

Ieuan King`

const err = (r: Awaited<ReturnType<typeof validateDraft>>, rule: string) => r.errors.filter((e) => e.rule === rule)

await describe('validate: a clean draft passes', async () => {
  const r = await validateDraft({ body: GOOD, factsUsed: ['ubik.commits'] })
  check('no errors', r.ok, r.errors.map((e) => e.message).join('; '))
})

await describe('validate: every claim must trace to a fact id', async () => {
  const unknown = await validateDraft({ body: GOOD, factsUsed: ['ubik.commits', 'ubik.invented'] })
  check('an unknown id is fatal', !unknown.ok)
  eq('and is named', err(unknown, 'unknown_fact').length, 1)
  check('with a usable message', err(unknown, 'unknown_fact')[0]?.message.includes('ubik.invented') ?? false)

  const none = await validateDraft({ body: GOOD, factsUsed: [] })
  check('an empty facts_used is fatal', !none.ok)
  eq('and says so', err(none, 'facts_used').length, 1)
})

await describe('validate: no em dashes', async () => {
  const r = await validateDraft({ body: GOOD.replace('It is the agent', 'It is — the agent'), factsUsed: ['ubik.commits'] })
  check('an em dash is fatal', !r.ok)
  eq('and is counted', err(r, 'em_dash').length, 1)
  check('and quotes the line', Boolean(err(r, 'em_dash')[0]?.excerpt))

  // En dashes in date ranges are fine; only the em dash is banned.
  const en = await validateDraft({ body: `${GOOD}\n\nUbik ran 2023–2026.`, factsUsed: ['ubik.commits'] })
  check('an en dash is not an em dash', en.ok)
})

await describe('validate: never claim a gap', async () => {
  for (const [claim, pattern] of [
    ['I write SQL against our warehouse daily.', 'SQL'],
    ['I have shipped React Native apps.', 'React Native'],
    ['I managed a design team of four.', 'managed a design team'],
  ] as const) {
    const r = await validateDraft({ body: `${GOOD}\n\n${claim}`, factsUsed: ['ubik.commits'] })
    check(`"${pattern}" is fatal`, !r.ok)
    check(`and names the gap`, err(r, 'claimed_gap').some((e) => e.message.includes(pattern)))
  }

  // A bare substring search reads "CRE" inside "screen" and "SQL" inside
  // "SQLite". Refusing a clean draft for a claim it never made teaches people
  // to override the validator, which is worse than not having one.
  setFactsForTesting({
    generated_at: '2026-01-01',
    source: 'test',
    facts: [{ id: 'ubik.commits', text: '1,038 commits', tags: [] }],
    gaps: [
      { id: 'gap.cre', text: 'No CRE domain experience', patterns: ['CRE'] },
      { id: 'gap.ml', text: 'No ML research background', patterns: ['ML research'] },
      { id: 'gap.ab', text: 'No A/B program ownership', patterns: ['A/B'] },
    ],
  })
  for (const innocent of [
    'agreeing was the cheapest action on the screen',
    'the increase came from a clearer layout',
    'I write HTML by hand when it matters',
    'credentials are handled by the host',
  ]) {
    const r = await validateDraft({ body: `${GOOD}\n\n${innocent}`, factsUsed: ['ubik.commits'] })
    check(`"${innocent.slice(0, 34)}..." is not a claimed gap`, r.ok, r.errors.map((e) => e.message).join('; '))
  }

  // Patterns whose own edges are not word characters still match.
  const ab = await validateDraft({ body: `${GOOD}\n\nI ran an A/B program.`, factsUsed: ['ubik.commits'] })
  check('"A/B" still matches', !ab.ok)

  setFactsForTesting({
    generated_at: '2026-01-01',
    source: 'test',
    facts: [
      { id: 'ubik.commits', text: '1,038 commits over three years', tags: ['ubik'] },
      { id: 'oss.hitl-kit', text: 'HITL Kit: 19 React primitives', tags: ['oss'] },
    ],
    gaps: [
      { id: 'gap.sql', text: 'No real SQL. Rate Beginner.', patterns: ['SQL'] },
      { id: 'gap.rn', text: 'No React Native shipped.', patterns: ['React Native'] },
      { id: 'gap.manage', text: 'Never managed a design team', patterns: ['managed a design team'] },
    ],
  })

  // An honest negation is the one legitimate reason to name a gap.
  const honest = await validateDraft({
    body: `${GOOD}\n\nI have not shipped React Native.`,
    factsUsed: ['ubik.commits'],
    allowGaps: ['gap.rn'],
  })
  check('an explicitly allowed gap passes', honest.ok, honest.errors.map((e) => e.message).join('; '))
})

await describe('validate: one page', async () => {
  const long = Array.from({ length: 24 }, () =>
    'This paragraph exists only to consume vertical space on the page and push the letter past a single sheet of US Letter paper, which is the condition under test.',
  ).join('\n\n')
  const r = await validateDraft({ body: long, factsUsed: ['ubik.commits'] })
  check('overflow is fatal', !r.ok)
  check('and reports the overrun', err(r, 'page_fit')[0]?.message.includes('past one page') ?? false)

  // Answers to application questions have no page to overflow.
  const answer = await validateDraft({ body: long, factsUsed: ['ubik.commits'], checkPageFit: false })
  check('an answer is not page-checked', answer.ok)
})

await describe('validate: house style warns without blocking', async () => {
  const r = await validateDraft({
    body: `${GOOD}\n\nI am passionate about design and thrive in a fast-paced environment.`,
    factsUsed: ['ubik.commits'],
  })
  check('still submittable', r.ok)
  check('but flagged', r.warnings.filter((w) => w.rule === 'house_style').length >= 2)

  const gap = await validateDraft({ body: `${GOOD}\n\nWhere I do not match the posting: I am four years in.`, factsUsed: ['ubik.commits'] })
  check('the retired gap paragraph is flagged', gap.warnings.some((w) => w.rule === 'gap_paragraph'))
  check('and does not block', gap.ok)
})
