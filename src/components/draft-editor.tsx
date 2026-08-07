'use client'

import { useActionState, useState } from 'react'
import { approveDraft, requestChanges, saveDraftBody, type ActionState } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/card'
import { cn } from '@/lib/ui'
import type { Critique } from '@/lib/types'

interface Props {
  draftId: number
  kind: string
  questionLabel: string | null
  body: string
  status: string
  contactVariant: string
  pdfPath: string | null
  reviewNote: string | null
  critique: Critique | null
  facts: { id: string; text: string | null }[]
  jdLines: string[]
}

export function DraftEditor(props: Props) {
  const [body, setBody] = useState(props.body)
  const [saveState, save, saving] = useActionState<ActionState | null, FormData>(saveDraftBody, null)
  const [approveState, approve, approving] = useActionState<ActionState | null, FormData>(approveDraft, null)
  const [changeState, change, changing] = useActionState<ActionState | null, FormData>(requestChanges, null)
  const [showNote, setShowNote] = useState(false)

  const dirty = body !== props.body
  const message = saveState ?? approveState ?? changeState

  return (
    <div className="rounded-[8px] border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Eyebrow className="text-dim2">
            {props.kind === 'cover_letter' ? 'Cover letter' : 'Answer'}
          </Eyebrow>
          {props.questionLabel && <span className="text-[12px] text-dim">{props.questionLabel}</span>}
          <span
            className={cn(
              'rounded-[6px] border px-1.5 py-0.5 text-[11px]',
              props.status === 'approved'
                ? 'border-interview/40 bg-interview/10 text-interview'
                : props.status === 'needs_edit'
                  ? 'border-viewed/40 bg-viewed/10 text-viewed'
                  : 'border-line bg-panel2 text-dim',
            )}
          >
            {props.status.replace('_', ' ')}
          </span>
          {props.kind === 'cover_letter' && (
            <span className="text-[11px] text-dim2">{props.contactVariant} links</span>
          )}
        </div>
        <span className="tabular text-[11px] text-dim2">
          {body.split(/\s+/).filter(Boolean).length} words
        </span>
      </div>

      {/* Weakest first: he reads this before the draft, by design. */}
      {props.critique && (
        <div className="border-b border-line bg-panel2/60 px-4 py-3">
          <Eyebrow className="text-viewed">Weakest part</Eyebrow>
          <p className="mt-1.5 text-[13px] text-fg">{props.critique.weakest}</p>

          {props.critique.stretches.length > 0 && (
            <div className="mt-3">
              <Eyebrow className="text-closed">Claims that outrun the facts</Eyebrow>
              <ul className="mt-1.5 space-y-1">
                {props.critique.stretches.map((s) => (
                  <li key={s} className="text-[12.5px] text-dim">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {props.critique.needs_verification.length > 0 && (
            <div className="mt-3">
              <Eyebrow className="text-dim2">Verify before sending</Eyebrow>
              <ul className="mt-1.5 space-y-1">
                {props.critique.needs_verification.map((s) => (
                  <li key={s} className="text-[12.5px] text-dim">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {props.reviewNote && (
        <div className="border-b border-line px-4 py-2.5">
          <Eyebrow className="text-dim2">Your note</Eyebrow>
          <p className="mt-1 text-[12.5px] text-dim">{props.reviewNote}</p>
        </div>
      )}

      <div className="px-4 py-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck
          className="min-h-[420px] w-full resize-y rounded-[7px] border border-line bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-[1.65] text-fg focus:border-line2 focus:outline-none"
        />

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <form action={save}>
            <input type="hidden" name="draftId" value={props.draftId} />
            <input type="hidden" name="body" value={body} />
            <Button type="submit" variant="quiet" size="sm" disabled={!dirty || saving}>
              {saving ? 'Checking...' : dirty ? 'Save edits' : 'Saved'}
            </Button>
          </form>

          <form action={approve}>
            <input type="hidden" name="draftId" value={props.draftId} />
            <Button type="submit" variant="approve" size="sm" disabled={approving || dirty}>
              {approving ? 'Rendering...' : props.kind === 'cover_letter' ? 'Approve and render PDF' : 'Approve'}
            </Button>
          </form>

          <Button type="button" variant="quiet" size="sm" onClick={() => setShowNote((v) => !v)}>
            Request changes
          </Button>

          {dirty && <span className="text-[11.5px] text-viewed">Save before approving.</span>}
        </div>

        {showNote && (
          <form action={change} className="mt-2 flex gap-1.5">
            <input type="hidden" name="draftId" value={props.draftId} />
            <input
              name="note"
              placeholder="What needs to change? The next pass reads this."
              className="flex-1 rounded-[7px] border border-line bg-panel2 px-3 py-1.5 text-[12px] text-fg placeholder:text-dim2 focus:border-line2 focus:outline-none"
            />
            <Button type="submit" variant="quiet" size="sm" disabled={changing}>
              Send back
            </Button>
          </form>
        )}

        {message && (
          <pre
            className={cn(
              'mt-2 whitespace-pre-wrap rounded-[7px] border px-3 py-2 font-mono text-[11.5px]',
              message.ok ? 'border-interview/30 bg-interview/5 text-interview' : 'border-closed/30 bg-closed/5 text-closed',
            )}
          >
            {message.message}
          </pre>
        )}

        {props.pdfPath && (
          <p className="mt-2 font-mono text-[11px] text-dim2">{props.pdfPath}</p>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <Eyebrow className="text-dim2">Facts this draft rests on</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.facts.map((f) => (
              <span
                key={f.id}
                title={f.text ?? 'NOT IN THE FACT LIBRARY'}
                className={cn(
                  'rounded-[6px] border px-1.5 py-0.5 font-mono text-[11px]',
                  f.text ? 'border-line bg-panel2 text-dim' : 'border-closed/40 bg-closed/10 text-closed',
                )}
              >
                {f.id}
              </span>
            ))}
          </div>
          {props.jdLines.length > 0 && (
            <div className="mt-3">
              <Eyebrow className="text-dim2">Job description lines answered</Eyebrow>
              <ul className="mt-1.5 space-y-1">
                {props.jdLines.map((l) => (
                  <li key={l} className="text-[12px] text-dim">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
