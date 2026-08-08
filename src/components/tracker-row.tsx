'use client'

import { useActionState } from 'react'
import { ChevronDown } from 'lucide-react'
import { markFollowedUp, setApplicationStatus, type ActionState } from '@/app/actions'
import { Badge } from '@/components/ui/badge'
import { TD, TR } from '@/components/ui/table'
import { APP_STATUS_STYLE, cn, formatDate, relativeDays } from '@/lib/ui'
import { APPLICATION_STATUSES, type Application } from '@/lib/types'

/** The one thing in the notes worth its own column. */
function signal(notes: string | null): { text: string; tone: string } | null {
  const n = notes ?? ''
  if (/resume downloaded/i.test(n))
    return { text: 'Resume downloaded', tone: 'text-interview border-interview/35 bg-interview/10' }
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
    <TR interactive>
      <TD pinned>
        {app.url ? (
          <a
            href={app.url}
            target="_blank"
            rel="noreferrer"
            title={app.company}
            className="block truncate font-medium text-fg underline-offset-2 hover:underline"
          >
            {app.company}
          </a>
        ) : (
          <span className="block truncate font-medium text-fg" title={app.company}>
            {app.company}
          </span>
        )}
      </TD>

      <TD className="text-[12.5px] text-dim">
        <div className="flex items-center gap-2">
          <span className={cn('truncate', app.role.startsWith('(') && 'text-dim2 italic')} title={app.role}>
            {app.role}
          </span>
          {app.status_ambiguous ? (
            <Badge
              className="border-viewed/35 bg-viewed/10 text-viewed"
              title={`Imported as "${app.status_raw}"`}
            >
              confirm
            </Badge>
          ) : null}
        </div>
      </TD>

      <TD>
        <form action={setStatus}>
          <input type="hidden" name="applicationId" value={app.id} />
          {/* The native chevron sits at a different inset in every engine and
              cannot be coloured, so the control draws its own. */}
          <div className="relative">
            <select
              name="status"
              defaultValue={app.status}
              aria-label={`Status for ${app.company}`}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className={cn(
                'w-full cursor-pointer appearance-none rounded-[6px] border border-line bg-panel2 py-1 pl-2 pr-6 text-[11.5px] transition-colors hover:border-line2 focus:border-line2 focus:outline-none',
                APP_STATUS_STYLE[app.status],
              )}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-panel2 text-fg">
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-dim2" />
          </div>
        </form>
      </TD>

      <TD className="tabular whitespace-nowrap font-mono text-[11.5px] text-dim">
        {formatDate(app.applied_at, app.applied_at_precision)}
        {app.applied_at && app.applied_at_precision === 'day' && (
          <span className="ml-1.5 text-dim2">{relativeDays(app.applied_at)}</span>
        )}
      </TD>

      <TD className="whitespace-nowrap text-[12px]">
        {app.follow_up_at && !app.followed_up_at ? (
          <form action={followUp} className="flex items-center gap-2">
            <input type="hidden" name="applicationId" value={app.id} />
            <span className={cn('tabular font-mono text-[11.5px]', overdue ? 'text-viewed' : 'text-dim2')}>
              {app.follow_up_at}
            </span>
            {overdue && (
              <button
                type="submit"
                className="cursor-pointer text-[11px] text-dim underline-offset-2 hover:text-fg hover:underline"
              >
                done
              </button>
            )}
          </form>
        ) : app.followed_up_at ? (
          <span className="text-[11.5px] text-dim2">followed up</span>
        ) : (
          <span className="text-dim2">—</span>
        )}
      </TD>

      <TD>
        {sig ? (
          <Badge className={cn('max-w-full', sig.tone)}>
            <span className="truncate">{sig.text}</span>
          </Badge>
        ) : (
          <span className="text-[11px] text-dim2">—</span>
        )}
      </TD>
    </TR>
  )
}
