'use client'

import { useActionState } from 'react'
import { markFollowedUp, setApplicationStatus, type ActionState } from '@/app/actions'
import { APP_STATUS_STYLE, cn, formatDate, relativeDays } from '@/lib/ui'
import { APPLICATION_STATUSES, type Application } from '@/lib/types'

export function TrackerRow({ app, overdue }: { app: Application; overdue: boolean }) {
  const [, setStatus] = useActionState<ActionState | null, FormData>(setApplicationStatus, null)
  const [, followUp] = useActionState<ActionState | null, FormData>(markFollowedUp, null)

  return (
    <tr className="border-b border-line last:border-0 hover:bg-panel">
      <td className="px-3 py-2 align-top text-fg">{app.company}</td>
      <td className="max-w-[280px] px-3 py-2 align-top text-[12px] text-dim">
        {app.role}
        {app.status_ambiguous ? (
          <span className="ml-2 text-[11px] text-viewed" title={`Imported as "${app.status_raw}"`}>
            confirm
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">
        <form action={setStatus}>
          <input type="hidden" name="applicationId" value={app.id} />
          <select
            name="status"
            defaultValue={app.status}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={cn(
              'rounded-[6px] border border-line bg-panel2 px-1.5 py-0.5 text-[11.5px] focus:border-line2 focus:outline-none',
              APP_STATUS_STYLE[app.status],
            )}
          >
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-panel2 text-fg">
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </form>
      </td>
      <td className="tabular px-3 py-2 align-top text-[12px] text-dim">
        {formatDate(app.applied_at, app.applied_at_precision)}
      </td>
      <td className="px-3 py-2 align-top text-[12px]">
        {app.follow_up_at && !app.followed_up_at ? (
          <form action={followUp} className="flex items-center gap-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <span className={cn('tabular', overdue ? 'text-viewed' : 'text-dim2')}>
              {app.follow_up_at} {overdue ? `(${relativeDays(app.follow_up_at)})` : ''}
            </span>
            {overdue && (
              <button type="submit" className="text-[11px] text-dim underline-offset-2 hover:text-fg hover:underline">
                done
              </button>
            )}
          </form>
        ) : app.followed_up_at ? (
          <span className="text-[11.5px] text-dim2">followed up</span>
        ) : (
          <span className="text-dim2">—</span>
        )}
      </td>
      <td className="max-w-[260px] truncate px-3 py-2 align-top text-[11.5px] text-dim2" title={app.notes ?? ''}>
        {app.notes ?? ''}
      </td>
    </tr>
  )
}
