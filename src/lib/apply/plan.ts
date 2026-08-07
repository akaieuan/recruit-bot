import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { openDb, type Db } from '../db.ts'
import { PATHS } from '../paths.ts'
import { getPosting } from '../postings.ts'
import { latestDrafts } from '../drafts.ts'
import { draftableQuestions } from '../greenhouse.ts'
import { renderCoverLetter } from '../pdf/cover.ts'
import { readProfile, profileGaps, type Profile } from './profile.ts'
import { resolveField, summarize, type DetectedField, type Resolution } from './fields.ts'
import type { ApplicationQuestion, Posting } from '../types.ts'

/**
 * Everything needed to complete one application, assembled before a browser
 * is opened. Building the plan first means the gaps are known while there is
 * still time to fix them, rather than discovered halfway through a form.
 */
export interface ApplicationPlan {
  posting: Posting
  applyUrl: string
  profile: Profile
  files: { resume?: string; cover?: string; portfolio?: string }
  answers: Record<string, string>
  knownFields: DetectedField[]
  resolutions: Resolution[]
  gaps: string[]
  /** True when every required field has a value and nothing is invented. */
  ready: boolean
}

function abs(p: string): string {
  return p.startsWith('/') ? p : join(PATHS.repoRoot, p)
}

export async function buildPlan(
  postingId: number,
  opts: { db?: Db; renderCover?: boolean } = {},
): Promise<ApplicationPlan> {
  const db = opts.db ?? openDb()
  const posting = getPosting(db, postingId)
  if (!posting) throw new Error(`no posting with id ${postingId}`)

  const profile = readProfile()
  // Filled in once the form's fields are known, below.
  const gaps: string[] = []

  // Only approved drafts are used. A draft still in review has not been read
  // by him, and an application is not the place to find that out.
  const drafts = latestDrafts(db, postingId)
  const approved = drafts.filter((d) => d.status === 'approved')

  const answers: Record<string, string> = {}
  for (const d of approved) {
    if (d.kind === 'answer' && d.question_key) answers[d.question_key] = d.body
  }

  const coverDraft = approved.find((d) => d.kind === 'cover_letter')
  const files: ApplicationPlan['files'] = {}

  const resume = abs(profile.resume_path)
  if (existsSync(resume)) files.resume = resume
  else gaps.push(`resume not found at ${profile.resume_path}`)

  if (profile.portfolio_path && existsSync(abs(profile.portfolio_path))) {
    files.portfolio = abs(profile.portfolio_path)
  }

  if (coverDraft) {
    if (coverDraft.pdf_path && existsSync(coverDraft.pdf_path)) {
      files.cover = coverDraft.pdf_path
    } else if (opts.renderCover !== false) {
      const rendered = await renderCoverLetter({
        company: posting.company,
        role: posting.role_title,
        body: coverDraft.body,
        contactVariant: coverDraft.contact_variant,
      })
      files.cover = rendered.path
      if (rendered.overflow) gaps.push(`cover letter runs ${rendered.overflowBy.toFixed(1)}pt onto a second page`)
    }
  } else {
    gaps.push('no approved cover letter. Run /draft and approve it before applying.')
  }

  // Greenhouse publishes its form schema, so those fields are known up front.
  // Ashby does not, and its fields get read from the live page at apply time.
  const knownFields: DetectedField[] = []
  const schemaRow = db.prepare('SELECT questions FROM question_schemas WHERE posting_id = ?').get(postingId) as
    | { questions: string }
    | undefined
  if (schemaRow) {
    const questions = JSON.parse(schemaRow.questions) as ApplicationQuestion[]
    for (const q of questions) {
      knownFields.push({ name: q.key, label: q.label, type: q.type, required: q.required, ...(q.options ? { options: q.options } : {}) })
    }
    for (const q of draftableQuestions(questions)) {
      if (!answers[q.key]) gaps.push(`no approved answer for "${q.label.slice(0, 70)}"`)
    }
  }

  // Gaps are judged against what this form actually asks for. Ashby does not
  // publish its schema, so when nothing is known every profile gap counts.
  const askedFor = knownFields.length
    ? new Set(
        knownFields.flatMap((f) => {
          const hay = `${f.label} ${f.name}`.toLowerCase()
          const keys: string[] = []
          if (/phone|mobile|telephone/.test(hay)) keys.push('phone')
          if (/e ?mail/.test(hay)) keys.push('email')
          if (/github/.test(hay)) keys.push('github')
          return keys
        }),
      )
    : undefined
  gaps.unshift(...profileGaps(profile, askedFor))

  const resolutions = knownFields.map((field) => resolveField({ field, profile, answers, files }))
  const unresolvedRequired = resolutions.filter((r) => r.action === 'unresolved' && r.field.required !== false)

  return {
    posting,
    applyUrl: posting.ats === 'ashby' ? `${posting.url.split('?')[0]}/application` : posting.url,
    profile,
    files,
    answers,
    knownFields,
    resolutions,
    gaps,
    ready: gaps.length === 0 && unresolvedRequired.length === 0,
  }
}

export function formatPlan(plan: ApplicationPlan): string {
  const out: string[] = []
  const { posting } = plan

  out.push(`${posting.company} / ${posting.role_title}`)
  out.push(`  ${plan.applyUrl}`)
  out.push('')

  out.push('files to upload:')
  for (const [kind, path] of Object.entries(plan.files)) out.push(`  ${kind.padEnd(10)} ${path}`)
  if (!Object.keys(plan.files).length) out.push('  (none)')
  out.push('')

  if (plan.knownFields.length) {
    const s = summarize(plan.resolutions)
    out.push(`form fields known ahead of time (${plan.knownFields.length}):`)
    for (const r of s.fill) {
      const v = typeof r.value === 'string' ? r.value.slice(0, 58) : String(r.value)
      out.push(`  fill       ${r.field.label.slice(0, 40).padEnd(42)} ${v}`)
    }
    for (const r of s.upload) out.push(`  upload     ${r.field.label.slice(0, 40).padEnd(42)} ${r.paths[0]?.split('/').pop()}`)
    for (const r of s.skip) out.push(`  leave      ${r.field.label.slice(0, 40).padEnd(42)} ${r.reason}`)
    for (const r of s.unresolved) out.push(`  NEEDS YOU  ${r.field.label.slice(0, 40).padEnd(42)} ${r.reason}`)
  } else {
    out.push('form fields: not published by this ATS, they get read from the page at apply time')
  }

  if (plan.gaps.length) {
    out.push('')
    out.push('blocking:')
    for (const g of plan.gaps) out.push(`  - ${g}`)
  }

  out.push('')
  out.push(plan.ready ? 'ready to fill' : 'not ready: resolve the items above first')
  return out.join('\n')
}
