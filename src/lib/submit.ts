import { nowIso, type Db } from './db.ts'
import { getPosting } from './postings.ts'
import { getDraft, insertDraft, setDraftCritique, setDraftStatus } from './drafts.ts'
import { validateDraft, formatIssues } from './validate.ts'
import { advance, STEP_INPUT_STAGE } from './queue.ts'
import type { WorkStep } from './paths.ts'
import type { Recommendation, Stage } from './types.ts'

/**
 * Validation for session results.
 *
 * Messages name the field and the allowed values, because the session reads
 * the failure and fixes the file. A message like "invalid input" would make a
 * bad submission a dead end instead of a retry.
 */

export class SubmitError extends Error {}

function fail(message: string): never {
  throw new SubmitError(message)
}

function obj(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${what} must be a JSON object`)
  return value as Record<string, unknown>
}

function str(v: Record<string, unknown>, key: string, opts: { required?: boolean } = {}): string | null {
  const value = v[key]
  if (value === undefined || value === null || value === '') {
    if (opts.required) fail(`"${key}" is required`)
    return null
  }
  if (typeof value !== 'string') fail(`"${key}" must be a string`)
  return value
}

function num(v: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = v[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`"${key}" must be a number between ${min} and ${max}`)
  if (value < min || value > max) fail(`"${key}" must be between ${min} and ${max} (got ${value})`)
  return value
}

function oneOf<T extends string>(v: Record<string, unknown>, key: string, allowed: readonly T[], required = true): T | null {
  const value = v[key]
  if (value === undefined || value === null || value === '') {
    if (required) fail(`"${key}" is required and must be one of: ${allowed.join(', ')}`)
    return null
  }
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`"${key}" must be one of: ${allowed.join(', ')} (got ${JSON.stringify(value)})`)
  }
  return value as T
}

function strArray(v: Record<string, unknown>, key: string, required = false): string[] {
  const value = v[key]
  if (value === undefined || value === null) {
    if (required) fail(`"${key}" is required and must be an array of strings`)
    return []
  }
  if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) {
    fail(`"${key}" must be an array of strings`)
  }
  return value as string[]
}

/** The posting must be at the stage this step consumes. */
function expectStage(db: Db, postingId: number, step: WorkStep): void {
  const posting = getPosting(db, postingId)
  if (!posting) fail(`posting ${postingId} does not exist`)
  const want = STEP_INPUT_STAGE[step]
  if (posting.stage !== want) {
    fail(`posting ${postingId} is at stage "${posting.stage}", but ${step} consumes "${want}". Re-run: pnpm cli queue ${step}`)
  }
}

export interface SubmitOutcome {
  postingId?: number
  draftId?: number
  message: string
  warnings?: string
}

export async function submitResult(db: Db, step: WorkStep, raw: unknown): Promise<SubmitOutcome> {
  switch (step) {
    case 'score':
      return submitScore(db, raw)
    case 'research':
      return submitResearch(db, raw)
    case 'draft':
      return submitDraft(db, raw)
    case 'critique':
      return submitCritique(db, raw)
  }
}

function submitScore(db: Db, raw: unknown): SubmitOutcome {
  const v = obj(raw, 'score result')
  const postingId = num(v, 'posting_id', 1, Number.MAX_SAFE_INTEGER)
  expectStage(db, postingId, 'score')

  const score = num(v, 'score', 0, 100)
  const tier = oneOf(v, 'tier', ['strong', 'possible', 'long_shot', 'reject'] as const)!
  const recommendation = oneOf(v, 'recommendation', ['advance', 'hold', 'skip'] as const)! as Recommendation
  const titleMatch = oneOf(v, 'title_match', ['ideal', 'adjacent', 'off'] as const, false)
  const nyc = oneOf(v, 'nyc', ['in_person', 'hybrid', 'remote_ok', 'not_nyc', 'unknown'] as const, false)
  const rationale = str(v, 'rationale', { required: true })!

  if (rationale.trim().length < 20) fail('"rationale" should explain the call in a sentence or two')

  db.prepare(
    `INSERT INTO scores (posting_id, scored_at, score, tier, title_match, keyword_hits,
       company_size_estimate, stage_estimate, nyc, rationale, recommendation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    postingId, nowIso(), score, tier, titleMatch,
    JSON.stringify(strArray(v, 'keyword_hits')),
    str(v, 'company_size_estimate'), str(v, 'stage_estimate'), nyc, rationale, recommendation,
  )

  const next: Record<Recommendation, Stage> = { advance: 'needs_research', hold: 'scored', skip: 'skipped' }
  advance(db, postingId, next[recommendation], `score ${score} (${tier})`)

  return { postingId, message: `scored ${score} ${tier}, ${recommendation} -> ${next[recommendation]}` }
}

function submitResearch(db: Db, raw: unknown): SubmitOutcome {
  const v = obj(raw, 'research result')
  const postingId = num(v, 'posting_id', 1, Number.MAX_SAFE_INTEGER)
  expectStage(db, postingId, 'research')

  const hardProblem = str(v, 'hard_problem', { required: true })!

  // jd_lines is what makes a letter specific rather than generic: each entry
  // pairs a line from the posting with the facts that answer it.
  const jdLinesRaw = v.jd_lines
  if (!Array.isArray(jdLinesRaw) || jdLinesRaw.length === 0) {
    fail('"jd_lines" must be a non-empty array of { jd_line, fact_ids } objects')
  }
  const jdLines = jdLinesRaw.map((entry, i) => {
    const e = obj(entry, `jd_lines[${i}]`)
    return {
      jd_line: str(e, 'jd_line', { required: true })!,
      fact_ids: strArray(e, 'fact_ids', true),
    }
  })

  db.prepare(
    `INSERT INTO research (posting_id, researched_at, company_summary, funding, headcount,
       hard_problem, jd_lines, sources, raw_md)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    postingId, nowIso(), str(v, 'company_summary'), str(v, 'funding'), str(v, 'headcount'),
    hardProblem, JSON.stringify(jdLines), JSON.stringify(strArray(v, 'sources')), str(v, 'raw_md'),
  )

  advance(db, postingId, 'needs_draft', 'researched')
  return { postingId, message: `research stored, ${jdLines.length} JD lines mapped -> needs_draft` }
}

async function submitDraft(db: Db, raw: unknown): Promise<SubmitOutcome> {
  const v = obj(raw, 'draft result')
  const postingId = num(v, 'posting_id', 1, Number.MAX_SAFE_INTEGER)
  expectStage(db, postingId, 'draft')

  // One file may carry the cover letter plus an answer per question.
  const items = Array.isArray(v.drafts) ? v.drafts : [v]
  if (!items.length) fail('no drafts in the result')

  const ids: number[] = []
  const warnings: string[] = []

  for (const [i, item] of items.entries()) {
    const d = obj(item, `drafts[${i}]`)
    const kind = oneOf(d, 'kind', ['cover_letter', 'answer'] as const)!
    const body = str(d, 'body', { required: true })!
    const factsUsed = strArray(d, 'facts_used', true)
    const questionKey = str(d, 'question_key')

    if (kind === 'answer' && !questionKey) fail(`drafts[${i}]: an answer needs "question_key"`)

    const result = await validateDraft({
      body,
      factsUsed,
      allowGaps: strArray(d, 'allow_gaps'),
      checkPageFit: kind === 'cover_letter',
    })
    if (!result.ok) {
      fail(`drafts[${i}] (${kind}${questionKey ? ` ${questionKey}` : ''}) did not pass:\n${formatIssues(result)}`)
    }
    if (result.warnings.length) warnings.push(formatIssues({ ...result, errors: [] }))

    ids.push(
      insertDraft(db, {
        postingId,
        kind,
        questionKey,
        body,
        contactVariant: (oneOf(d, 'contact_variant', ['design', 'engineering'] as const, false) ?? 'design'),
        factsUsed,
        jdLines: strArray(d, 'jd_lines'),
      }),
    )
  }

  advance(db, postingId, 'in_review', `${ids.length} draft(s) written`)
  return {
    postingId,
    message: `${ids.length} draft(s) stored (ids ${ids.join(', ')}) -> in_review`,
    ...(warnings.length ? { warnings: warnings.join('\n') } : {}),
  }
}

function submitCritique(db: Db, raw: unknown): SubmitOutcome {
  const v = obj(raw, 'critique result')
  const draftId = num(v, 'draft_id', 1, Number.MAX_SAFE_INTEGER)
  const draft = getDraft(db, draftId)
  if (!draft) fail(`draft ${draftId} does not exist`)

  const weakest = str(v, 'weakest', { required: true })!
  const verdict = oneOf(v, 'verdict', ['ship', 'revise'] as const)!

  setDraftCritique(db, draftId, {
    weakest,
    stretches: strArray(v, 'stretches'),
    needs_verification: strArray(v, 'needs_verification'),
    verdict,
  })

  // A critique never rejects on its own. It tells the human where to look, and
  // the human decides, because that judgment is the whole point of the review.
  if (verdict === 'revise') setDraftStatus(db, draftId, 'draft', draft.review_note)

  return { draftId, message: `critique stored on draft ${draftId}: ${verdict}` }
}
