'use client'

import { useActionState } from 'react'
import { markFollowedUp, setApplicationStatus, type ActionState } from '@/app/actions'
import { APP_STATUS_STYLE, cn, formatDate, relativeDays } from '@/lib/ui'
import { APPLICATION_STATUSES, type Application } from '@/lib/types'

/** The one thing in the notes worth its own column. */
function signal(notes: string | null): { text: string; tone: string } | null {
  const n = notes ?? ''
  if (/resume downloaded/i.test(n)) return { text: 'Resume downloaded', tone: 'text-interview border-interview/35 bg-interview/10' }
  if (/application viewed/i.test(n)) return { text: 'Viewed', tone: 'text-viewed border-viewed/35 bg-viewed/10' }
  if (/posting closed/i.test(n)) return { text: 'Posting closed', tone: 'text-dim2 border-line bg-panel2' }
  if (/submitted/i.test(n)) return { text: 'Submitted', tone: 'text-applied border-applied/35 bg-applied/10' }
  return null
}

export function TrackerRow({ app }: { app: Application }) {
  const [, setStatus] = useActionState<ActionState | null, FormData>(setApplicationStatus, null)
  const [, followUp] = useActionState<ActionState | null, FormData>(markFollowedUp, null)

  const today = new Date().toISOString().slice(0, 10)
  const overdue = Boolean(app.follow_up_at && app.follow_up_at <= today && !app.followed_up_at)
  const sig = signal(app.notes)

  return (
    <tr className="border-b border-line last:border-0 transition-colors hover:bg-panel">
      <td className="px-3 py-2 align-top">
        {app.url ? (
          <a href={app.url} target="_blank" rel="noreferrer" className="text-fg hover:underline">
            {app.company}
          </a>
        ) : (
          <span className="text-fg">{app.company}</span>
        )}
      </td>

      <td className="max-w-[300px] px-3 py-2 align-top text-[12px] text-dim">
        <span className={cn(app.role.startsWith('(') && 'text-dim2 italic')}>{app.role}</span>
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
              'cursor-pointer rounded-[6px] border border-line bg-panel2 px-1.5 py-0.5 text-[11.5px] transition-colors hover:border-line2 focus:border-line2 focus:outline-none',
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

      <td className="tabular whitespace-nowrap px-3 py-2 align-top text-[12px] text-dim">
        {formatDate(app.applied_at, app.applied_at_precision)}
        {app.applied_at && app.applied_at_precision === 'day' && (
          <span className="ml-1.5 text-dim2">{relativeDays(app.applied_at)}</span>
        )}
      </td>

      <td className="whitespace-nowrap px-3 py-2 align-top text-[12px]">
        {app.follow_up_at && !app.followed_up_at ? (
          <form action={followUp} className="flex items-center gap-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <span className={cn('tabular', overdue ? 'text-viewed' : 'text-dim2')}>{app.follow_up_at}</span>
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

      <td className="px-3 py-2 align-top">
        {sig ? (
          <span className={cn('inline-block whitespace-nowrap rounded-[6px] border px-1.5 py-0.5 text-[11px]', sig.tone)}>
            {sig.text}
          </span>
        ) : (
          <span className="text-[11px] text-dim2">—</span>
        )}
      </td>
    </tr>
  )
}
