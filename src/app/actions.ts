'use server'

import { revalidatePath } from 'next/cache'
import { openDb } from '@/lib/db'
import { getDraft, setDraftPdfPath, setDraftStatus, updateDraftBody } from '@/lib/drafts'
import { getPosting, setStage } from '@/lib/postings'
import { renderCoverLetter } from '@/lib/pdf/cover'
import { recordApplication } from '@/lib/tracker'
import { validateDraft, formatIssues } from '@/lib/validate'
import { parseJsonArray } from '@/lib/drafts'
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/types'
import { nowIso, today } from '@/lib/db'
import { followUpDate } from '@/lib/tracker'

/**
 * Every write the UI performs. Nothing here generates text: drafting happens
 * in a Claude Code session, and this file only records what a human decided.
 */

export interface ActionState {
  ok: boolean
  message: string
}

/**
 * Human edits pass the same validator a generated draft does. An em dash or a
 * claimed gap is no more acceptable for being typed by hand, and the page
 * would otherwise be the one route around the rules.
 */
export async function saveDraftBody(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('draftId'))
  const body = String(form.get('body') ?? '')
  const db = openDb()
  const draft = getDraft(db, id)
  if (!draft) return { ok: false, message: `draft ${id} not found` }

  const result = await validateDraft({
    body,
    factsUsed: parseJsonArray(draft.facts_used),
    checkPageFit: draft.kind === 'cover_letter',
  })
  if (!result.ok) return { ok: false, message: formatIssues(result) }

  updateDraftBody(db, id, body)
  revalidatePath(`/posting/${draft.posting_id}`)
  return {
    ok: true,
    message: result.warnings.length ? `Saved.\n${formatIssues({ ...result, errors: [] })}` : 'Saved.',
  }
}

export async function approveDraft(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('draftId'))
  const db = openDb()
  const draft = getDraft(db, id)
  if (!draft) return { ok: false, message: `draft ${id} not found` }
  const posting = getPosting(db, draft.posting_id)
  if (!posting) return { ok: false, message: 'posting not found' }

  setDraftStatus(db, id, 'approved')

  let message = 'Approved.'
  if (draft.kind === 'cover_letter') {
    const rendered = await renderCoverLetter({
      company: posting.company,
      role: posting.role_title,
      body: draft.body,
      contactVariant: draft.contact_variant,
    })
    setDraftPdfPath(db, id, rendered.path)
    message = `Approved. PDF written to ${rendered.path}`
    if (rendered.overflow) message += ` (WARNING: runs ${rendered.overflowBy.toFixed(1)}pt onto a second page)`
  }

  setStage(db, posting.id, 'approved', 'approved in review')
  revalidatePath(`/posting/${posting.id}`)
  revalidatePath('/')
  return { ok: true, message }
}

/** Sends a draft back for another pass, carrying the note that says why. */
export async function requestChanges(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('draftId'))
  const note = String(form.get('note') ?? '').trim()
  if (!note) return { ok: false, message: 'Say what needs to change, so the next pass has something to work from.' }

  const db = openDb()
  const draft = getDraft(db, id)
  if (!draft) return { ok: false, message: `draft ${id} not found` }

  setDraftStatus(db, id, 'needs_edit', note)
  setStage(db, draft.posting_id, 'needs_draft', 'changes requested in review')
  revalidatePath(`/posting/${draft.posting_id}`)
  revalidatePath('/')
  return { ok: true, message: 'Sent back. Run /draft to pick it up with your note.' }
}

export async function skipPosting(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('postingId'))
  const db = openDb()
  setStage(db, id, 'skipped', String(form.get('reason') ?? 'skipped in review'))
  revalidatePath('/')
  revalidatePath(`/posting/${id}`)
  return { ok: true, message: 'Skipped.' }
}

export async function reopenPosting(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('postingId'))
  setStage(openDb(), id, 'needs_score', 'reopened')
  revalidatePath('/')
  revalidatePath(`/posting/${id}`)
  return { ok: true, message: 'Back in the queue.' }
}

/**
 * Records that he sent it. The tool never submits anything: this is him
 * telling the tracker what he did.
 */
export async function markApplied(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const postingId = Number(form.get('postingId'))
  const db = openDb()
  const posting = getPosting(db, postingId)
  if (!posting) return { ok: false, message: 'posting not found' }

  const materials = String(form.get('materials') ?? '').trim() || null
  recordApplication(db, {
    postingId,
    company: posting.company,
    role: posting.role_title,
    location: posting.location,
    compRange:
      posting.comp_min || posting.comp_max ? `${posting.comp_min ?? ''}-${posting.comp_max ?? ''}` : null,
    ats: posting.ats,
    url: posting.url,
    materials,
  })
  setStage(db, postingId, 'applied', `applied ${today()}`)
  revalidatePath('/')
  revalidatePath('/tracker')
  revalidatePath(`/posting/${postingId}`)
  return { ok: true, message: 'Recorded. Follow-up flagged for seven days from today.' }
}

export async function setApplicationStatus(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('applicationId'))
  const status = String(form.get('status') ?? '') as ApplicationStatus
  if (!APPLICATION_STATUSES.includes(status)) return { ok: false, message: `unknown status "${status}"` }

  const db = openDb()
  const row = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as
    | { applied_at: string | null; applied_at_precision: 'day' | 'before' | null }
    | undefined
  if (!row) return { ok: false, message: `application ${id} not found` }

  db.prepare(
    `UPDATE applications SET status = ?, status_ambiguous = 0, follow_up_at = ?, updated_at = ? WHERE id = ?`,
  ).run(status, followUpDate(status, row.applied_at, row.applied_at_precision), nowIso(), id)

  revalidatePath('/tracker')
  return { ok: true, message: 'Updated.' }
}

export async function markFollowedUp(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const id = Number(form.get('applicationId'))
  openDb().prepare('UPDATE applications SET followed_up_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id)
  revalidatePath('/tracker')
  return { ok: true, message: 'Marked as followed up.' }
}
