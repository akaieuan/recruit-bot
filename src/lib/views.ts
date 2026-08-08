import 'server-only'
import { openDb, plain, plainAll } from './db.ts'
import { evaluate } from './filter.ts'
import { latestDrafts, parseJsonArray } from './drafts.ts'
import { readFacts } from './facts.ts'
import { draftableQuestions } from './greenhouse.ts'
import { dueFollowUps } from './tracker.ts'
import { stageCounts } from './postings.ts'
import type {
  Application, ApplicationQuestion, Critique, Draft, Fact, JdLineMapping,
  Posting, Research, Score, Stage,
} from './types.ts'

/** Read models for the UI. Server components call these directly. */

export interface QueueRow {
  posting: Posting
  score: Score | null
  draftCount: number
  critiqueVerdict: string | null
  keywordHits: string[]
}

/**
 * NYC and in person first, always. He will relocate for the right role, but
 * the right role in New York beats the same role somewhere he would have to
 * move to, and a ranking that buries the local ones is a ranking that argues
 * against what he actually wants.
 */
const LOCATION_ORDER = `
  CASE
    WHEN p.location LIKE '%New York%' OR p.location LIKE '%NYC%' OR p.location LIKE '%Brooklyn%' OR p.location LIKE '%Manhattan%'
      THEN CASE WHEN p.remote_policy = 'onsite' THEN 0 WHEN p.remote_policy = 'hybrid' THEN 1 ELSE 2 END
    WHEN p.remote_policy = 'remote' THEN 3
    ELSE 4
  END
`

const REVIEW_ORDER = `
  CASE p.stage
    WHEN 'in_review' THEN 0
    WHEN 'needs_draft' THEN 1
    WHEN 'researched' THEN 2
    WHEN 'needs_research' THEN 3
    WHEN 'approved' THEN 4
    WHEN 'needs_score' THEN 5
    WHEN 'scored' THEN 6
    ELSE 7
  END
`

export function queueRows(stage?: Stage | 'active'): QueueRow[] {
  const db = openDb()
  const where =
    stage && stage !== 'active'
      ? 'p.stage = ?'
      : "p.stage IN ('needs_score','scored','needs_research','researched','needs_draft','in_review','approved')"
  const params = stage && stage !== 'active' ? [stage] : []

  const postings = plainAll<Posting>(
    db
      .prepare(`SELECT p.* FROM postings p WHERE p.closed_at IS NULL AND ${where} ORDER BY ${REVIEW_ORDER}, ${LOCATION_ORDER}, p.id DESC LIMIT 200`)
      .all(...params),
  )

  return postings.map((posting) => {
    const scoreRow = db.prepare('SELECT * FROM scores WHERE posting_id = ? ORDER BY id DESC LIMIT 1').get(posting.id)
    const drafts = latestDrafts(db, posting.id)
    const critiqued = drafts.find((d) => d.critique)
    let verdict: string | null = null
    if (critiqued?.critique) {
      try {
        verdict = (JSON.parse(critiqued.critique) as Critique).verdict
      } catch {
        verdict = null
      }
    }
    return {
      posting,
      score: scoreRow ? plain<Score>(scoreRow) : null,
      draftCount: drafts.length,
      critiqueVerdict: verdict,
      keywordHits: evaluate(posting).keywordHits,
    }
  })
}

export interface PostingDetail {
  posting: Posting
  score: Score | null
  research: (Research & { jdLines: JdLineMapping[]; sourceList: string[] }) | null
  drafts: (Draft & { critiqueParsed: Critique | null; factsResolved: { id: string; text: string | null }[] })[]
  questions: ApplicationQuestion[]
  application: Application | null
}

export function postingDetail(id: number): PostingDetail | null {
  const db = openDb()
  const row = db.prepare('SELECT * FROM postings WHERE id = ?').get(id)
  if (!row) return null
  const posting = plain<Posting>(row)

  const scoreRow = db.prepare('SELECT * FROM scores WHERE posting_id = ? ORDER BY id DESC LIMIT 1').get(id)
  const researchRow = db.prepare('SELECT * FROM research WHERE posting_id = ? ORDER BY id DESC LIMIT 1').get(id)
  const questionRow = db.prepare('SELECT questions FROM question_schemas WHERE posting_id = ?').get(id) as
    | { questions: string }
    | undefined
  const appRow = db
    .prepare('SELECT * FROM applications WHERE posting_id = ? OR (company = ? AND role = ?) LIMIT 1')
    .get(id, posting.company, posting.role_title)

  const facts = readFacts().facts
  const byId = new Map<string, Fact>(facts.map((f) => [f.id, f]))

  const drafts = latestDrafts(db, id).map((d) => {
    let critiqueParsed: Critique | null = null
    if (d.critique) {
      try {
        critiqueParsed = JSON.parse(d.critique) as Critique
      } catch {
        critiqueParsed = null
      }
    }
    return {
      ...d,
      critiqueParsed,
      factsResolved: parseJsonArray(d.facts_used).map((fid) => ({ id: fid, text: byId.get(fid)?.text ?? null })),
    }
  })

  let research: PostingDetail['research'] = null
  if (researchRow) {
    const r = plain<Research>(researchRow)
    let jdLines: JdLineMapping[] = []
    try {
      jdLines = r.jd_lines ? (JSON.parse(r.jd_lines) as JdLineMapping[]) : []
    } catch {
      jdLines = []
    }
    research = { ...r, jdLines, sourceList: parseJsonArray(r.sources) }
  }

  return {
    posting,
    score: scoreRow ? plain<Score>(scoreRow) : null,
    research,
    drafts,
    questions: questionRow ? draftableQuestions(JSON.parse(questionRow.questions) as ApplicationQuestion[]) : [],
    application: appRow ? plain<Application>(appRow) : null,
  }
}

export function pipelineSummary() {
  const db = openDb()
  const counts = stageCounts(db)
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n

  // "Movement" is the only number here that implies an action. An employer who
  // opened the application or downloaded the resume has done something; every
  // other row is silence.
  return {
    counts,
    apps: one('SELECT count(*) AS n FROM applications'),
    awaiting: one("SELECT count(*) AS n FROM applications WHERE status = 'applied'"),
    unknown: one("SELECT count(*) AS n FROM applications WHERE status = 'unknown'"),
    interviewing: one("SELECT count(*) AS n FROM applications WHERE status IN ('interviewing', 'in_progress')"),
    movement: one("SELECT count(*) AS n FROM applications WHERE notes LIKE '%viewed%' OR notes LIKE '%downloaded%'"),
    rejected: one("SELECT count(*) AS n FROM applications WHERE status = 'rejected'"),
    active: (['needs_score', 'scored', 'needs_research', 'researched', 'needs_draft', 'in_review', 'approved'] as Stage[])
      .reduce((sum, st) => sum + (counts[st] ?? 0), 0),
    toReview: counts.in_review ?? 0,
    followUps: dueFollowUps(db).length,
  }
}

/** Applications where the employer has actually done something. */
export function movementRows(): Application[] {
  return plainAll<Application>(
    openDb()
      .prepare(
        `SELECT * FROM applications
         WHERE notes LIKE '%viewed%' OR notes LIKE '%downloaded%'
         ORDER BY (applied_at IS NULL), applied_at DESC LIMIT 40`,
      )
      .all(),
  )
}

export function trackerRows(filter?: string): Application[] {
  const db = openDb()
  if (filter === 'followups') return dueFollowUps(db)
  const where =
    filter === 'ambiguous' ? 'WHERE status_ambiguous = 1' : filter && filter !== 'all' ? 'WHERE status = ?' : ''
  const params = filter && filter !== 'all' && filter !== 'ambiguous' ? [filter] : []
  return plainAll<Application>(
    db
      .prepare(
        `SELECT * FROM applications ${where}
         ORDER BY (applied_at IS NULL), applied_at DESC, company LIMIT 400`,
      )
      .all(...params),
  )
}

export function factLibrary(): Fact[] {
  return readFacts().facts
}
