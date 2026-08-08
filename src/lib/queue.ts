import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { nowIso, plain, plainAll, type Db } from './db.ts'
import { workDir, type WorkStep } from './paths.ts'
import { evaluate } from './filter.ts'
import { draftableQuestions } from './greenhouse.ts'
import { getPosting, postingsByStage, setStage } from './postings.ts'
import { priorApplications, priorFor } from './already.ts'
import { latestDrafts, parseJsonArray } from './drafts.ts'
import { readFacts } from './facts.ts'
import type { ApplicationQuestion, Draft, Posting, Research, Score, Stage } from './types.ts'

/**
 * The handshake between the deterministic pipeline and a Claude Code session.
 *
 * `queue` writes one self-contained JSON packet per unit of work. The session
 * reads packets, does the thinking, and writes result files. `submit`
 * validates a result and applies it.
 *
 * The point of the split is that the CLI owns every SQL statement and every
 * invariant. A session never composes a query, never edits the database, and
 * cannot put a posting into a state the pipeline does not recognise. Anything
 * under data/work is disposable: `queue` regenerates it.
 */

export const STEP_INPUT_STAGE: Record<WorkStep, Stage> = {
  score: 'needs_score',
  research: 'needs_research',
  draft: 'needs_draft',
  critique: 'in_review',
}

export function ensureWorkDirs(step: WorkStep): void {
  for (const bucket of ['pending', 'results', 'done'] as const) {
    mkdirSync(workDir(step, bucket), { recursive: true })
  }
}

function latestScore(db: Db, postingId: number): Score | undefined {
  const row = db.prepare('SELECT * FROM scores WHERE posting_id = ? ORDER BY id DESC LIMIT 1').get(postingId)
  return row ? plain<Score>(row) : undefined
}

function latestResearch(db: Db, postingId: number): Research | undefined {
  const row = db.prepare('SELECT * FROM research WHERE posting_id = ? ORDER BY id DESC LIMIT 1').get(postingId)
  return row ? plain<Research>(row) : undefined
}

function questionsFor(db: Db, postingId: number): ApplicationQuestion[] {
  const row = db.prepare('SELECT questions FROM question_schemas WHERE posting_id = ?').get(postingId) as
    | { questions: string }
    | undefined
  if (!row) return []
  try {
    return draftableQuestions(JSON.parse(row.questions) as ApplicationQuestion[])
  } catch {
    return []
  }
}

/** Trimmed so a packet stays readable; the full text is in the database. */
function jdExcerpt(posting: Posting, limit = 9000): string {
  const text = posting.description_text ?? ''
  return text.length > limit ? `${text.slice(0, limit)}\n\n[truncated, ${text.length} characters total]` : text
}

export interface QueueResult {
  step: WorkStep
  written: number
  dir: string
  cleared: number
}

export function buildQueue(db: Db, step: WorkStep, limit: number): QueueResult {
  ensureWorkDirs(step)
  const pendingDir = workDir(step, 'pending')

  // Stale packets would tell the session to redo work already submitted.
  let cleared = 0
  for (const file of readdirSync(pendingDir)) {
    if (file.endsWith('.json')) {
      rmSync(join(pendingDir, file))
      cleared++
    }
  }

  const packets = step === 'critique' ? critiquePackets(db, limit) : postingPackets(db, step, limit)

  for (const packet of packets) {
    writeFileSync(join(pendingDir, `${packet.id}.json`), `${JSON.stringify(packet.body, null, 2)}\n`)
  }

  return { step, written: packets.length, dir: pendingDir, cleared }
}

function postingPackets(db: Db, step: WorkStep, limit: number): { id: string; body: unknown }[] {
  const stage = STEP_INPUT_STAGE[step]
  // Roles already in the tracker are retired rather than queued. A whole batch
  // of ten came back as applications he had already sent, one of them to a
  // company that had rejected him the same day.
  const prior = priorApplications(db)
  const postings: typeof pool = []
  const pool = postingsByStage(db, stage, limit * 4)

  for (const p of pool) {
    if (postings.length >= limit) break
    const seen = priorFor(prior, p)
    if (!seen) {
      postings.push(p)
      continue
    }
    const when = seen.applied_at ? ` on ${seen.applied_at}` : ''
    setStage(db, p.id, 'skipped', `already ${seen.status}${when}`)
  }

  return postings.map((p) => {
    const verdict = evaluate(p)
    const base = {
      posting_id: p.id,
      company: p.company,
      role_title: p.role_title,
      url: p.url,
      location: p.location,
      remote_policy: p.remote_policy,
      comp_min: p.comp_min,
      comp_max: p.comp_max,
      comp_below_floor: Boolean(p.comp_flag),
      years_min: p.years_min,
      years_max: p.years_max,
      years_flag: p.years_flag,
      keyword_hits_deterministic: verdict.keywordHits,
      description_text: jdExcerpt(p),
    }

    if (step === 'score') return { id: String(p.id), body: base }

    const score = latestScore(db, p.id)
    const scoreBlock = score
      ? {
          score: score.score,
          tier: score.tier,
          rationale: score.rationale,
          keyword_hits: parseJsonArray(score.keyword_hits),
          company_size_estimate: score.company_size_estimate,
          stage_estimate: score.stage_estimate,
        }
      : null

    if (step === 'research') return { id: String(p.id), body: { ...base, score: scoreBlock } }

    // draft
    const research = latestResearch(db, p.id)
    const drafts = latestDrafts(db, p.id)
    const needsEdit = drafts.filter((d) => d.status === 'needs_edit')

    return {
      id: String(p.id),
      body: {
        ...base,
        score: scoreBlock,
        research: research
          ? {
              company_summary: research.company_summary,
              funding: research.funding,
              headcount: research.headcount,
              hard_problem: research.hard_problem,
              jd_lines: research.jd_lines ? JSON.parse(research.jd_lines) : [],
              sources: parseJsonArray(research.sources),
            }
          : null,
        application_questions: questionsFor(db, p.id),
        // Present only on a revision pass, carrying what the review asked for.
        revising: needsEdit.length
          ? needsEdit.map((d) => ({
              draft_id: d.id,
              kind: d.kind,
              question_key: d.question_key,
              review_note: d.review_note,
              previous_body: d.body,
              previous_facts_used: parseJsonArray(d.facts_used),
            }))
          : null,
      },
    }
  })
}

/** Critique packets are per draft, not per posting. */
function critiquePackets(db: Db, limit: number): { id: string; body: unknown }[] {
  const drafts = plainAll<Draft>(
    db
      .prepare(
        `SELECT d.* FROM drafts d
         JOIN postings p ON p.id = d.posting_id
         WHERE d.status = 'draft' AND d.critique IS NULL AND p.closed_at IS NULL
         ORDER BY d.id LIMIT ?`,
      )
      .all(limit),
  )

  return drafts.map((d) => {
    const posting = getPosting(db, d.posting_id)
    const research = latestResearch(db, d.posting_id)
    const facts = readFacts()
    const used = parseJsonArray(d.facts_used)
    return {
      id: String(d.id),
      body: {
        draft_id: d.id,
        posting_id: d.posting_id,
        company: posting?.company,
        role_title: posting?.role_title,
        kind: d.kind,
        question_key: d.question_key,
        question_label: d.question_key,
        body: d.body,
        facts_used: used.map((id) => ({ id, text: facts.facts.find((f) => f.id === id)?.text ?? null })),
        jd_lines: parseJsonArray(d.jd_lines),
        hard_problem: research?.hard_problem ?? null,
        description_text: posting ? jdExcerpt(posting, 5000) : '',
      },
    }
  })
}

export interface PendingFile {
  path: string
  id: string
}

export function listResults(step: WorkStep): PendingFile[] {
  const dir = workDir(step, 'results')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ path: join(dir, f), id: basename(f, '.json') }))
}

export function readResult(path: string): unknown {
  const raw = readFileSync(path, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`${basename(path)} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** Moves a handled packet and its result out of the way. */
export function archive(step: WorkStep, id: string): void {
  ensureWorkDirs(step)
  const stamp = nowIso().replace(/[:.]/g, '-')
  for (const bucket of ['pending', 'results'] as const) {
    const from = join(workDir(step, bucket), `${id}.json`)
    if (existsSync(from)) renameSync(from, join(workDir(step, 'done'), `${id}.${bucket}.${stamp}.json`))
  }
}

export function advance(db: Db, postingId: number, stage: Stage, reason?: string): void {
  setStage(db, postingId, stage, reason ?? null)
}
