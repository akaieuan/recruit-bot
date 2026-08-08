import Link from 'next/link'
import { openDb } from '@/lib/db'
import { prepRows, needsPrep } from '@/lib/prep'
import { PrepBoard } from './_components/prep-board'

export const dynamic = 'force-dynamic'

/**
 * Interview prep, one sheet per conversation.
 *
 * "Where you lack" sits level with "why you fit" on purpose. Walking in
 * knowing the three things they will push on is what makes the rest usable.
 */
export default function PrepPage() {
  const db = openDb()
  const sheets = prepRows(db)
  const pending = needsPrep(db)

  return (
    <main>
      {sheets.length > 0 && <PrepBoard sheets={sheets} />}

      {sheets.length === 0 && (
        <div className="mt-6 rounded-[8px] border border-line bg-panel px-4 py-10 text-center">
          <p className="text-[13px] text-dim">No conversations to prep for yet.</p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[12px] leading-[1.6] text-dim2">
            A posting gets a prep sheet once its application is interviewing or in progress.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <section className={sheets.length > 0 ? 'mt-12 max-w-[1112px]' : 'mt-5'}>
          <div className="rounded-[8px] border border-viewed/30 bg-viewed/[0.05] px-4 py-3">
            <p className="eyebrow text-viewed">Live, and still without a sheet</p>
            <ul className="mt-2.5 space-y-1.5">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                  <Link href={`/posting/${p.id}`} className="text-fg hover:underline">
                    {p.company}
                  </Link>
                  <span className="text-dim">{p.role_title}</span>
                  <code className="font-mono text-[11px] text-dim2">/prep {p.id}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}
