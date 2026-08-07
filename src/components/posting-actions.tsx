'use client'

import { useActionState, useState } from 'react'
import { markApplied, reopenPosting, skipPosting, type ActionState } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/ui'

export function PostingActions({
  postingId,
  stage,
  hasApproved,
}: {
  postingId: number
  stage: string
  hasApproved: boolean
}) {
  const [appliedState, applied, applying] = useActionState<ActionState | null, FormData>(markApplied, null)
  const [skipState, skip, skipping] = useActionState<ActionState | null, FormData>(skipPosting, null)
  const [reopenState, reopen, reopening] = useActionState<ActionState | null, FormData>(reopenPosting, null)
  const [confirming, setConfirming] = useState(false)

  const message = appliedState ?? skipState ?? reopenState

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {stage !== 'applied' && (
          <>
            {confirming ? (
              <form action={applied} className="flex gap-1.5">
                <input type="hidden" name="postingId" value={postingId} />
                <input
                  name="materials"
                  placeholder="Materials sent (optional)"
                  className="w-56 rounded-[7px] border border-line bg-panel2 px-2.5 py-1 text-[12px] text-fg placeholder:text-dim2 focus:border-line2 focus:outline-none"
                />
                <Button type="submit" variant="approve" size="sm" disabled={applying}>
                  {applying ? 'Recording...' : 'Confirm I sent it'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button
                type="button"
                variant={hasApproved ? 'approve' : 'quiet'}
                size="sm"
                onClick={() => setConfirming(true)}
              >
                I applied to this
              </Button>
            )}
          </>
        )}

        {stage !== 'skipped' ? (
          <form action={skip}>
            <input type="hidden" name="postingId" value={postingId} />
            <Button type="submit" variant="quiet" size="sm" disabled={skipping}>
              Skip
            </Button>
          </form>
        ) : (
          <form action={reopen}>
            <input type="hidden" name="postingId" value={postingId} />
            <Button type="submit" variant="quiet" size="sm" disabled={reopening}>
              Reopen
            </Button>
          </form>
        )}
      </div>

      {message && (
        <p className={cn('text-[11.5px]', message.ok ? 'text-interview' : 'text-closed')}>{message.message}</p>
      )}
    </div>
  )
}
