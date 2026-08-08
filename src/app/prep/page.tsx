import Link from 'next/link'
import { openDb } from '@/lib/db'
import { prepRows, needsPrep } from '@/lib/prep'
import { formatComp } from '@/lib/ui'

export const dynamic = 'force-dynamic'

/**
 * Interview prep, one page per conversation.
 *
 * "Where you lack" sits as high as "why you fit" on purpose. Walking in
 * knowing the three things they will push on is what makes the rest usable.
 */
export default async function PrepPage() {
  const db = openDb()
  const sheets = prepRows(db)
  const pending = needsPrep(db)

  return (
    <main>
      {sheets.length === 0 && pending.length === 0 && (
        <div className="mt-6 rounded-[8px] border border-line bg-panel px-4 py-8 text-center">
          <p className="text-[13px] text-dim">No conversations to prep for yet.</p>
          <p className="mt-2 text-[12px] text-dim2">
            A posting gets a prep sheet once its application is interviewing or in progress.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-5 rounded-[8px] border border-viewed/35 bg-viewed/[0.06] px-4 py-3">
          <p className="eyebrow text-viewed">Needs a prep sheet</p>
          <ul className="mt-2 space-y-1">
            {pending.map((p) => (
              <li key={p.id} className="text-[12.5px] text-dim">
                <Link href={`/posting/${p.id}`} className="text-fg hover:underline">
                  {p.company}
                </Link>{' '}
                {p.role_title}
                <span className="ml-2 font-mono text-[11px] text-dim2">/prep {p.id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheets.map((s) => (
        <article key={s.id} className="mt-6 overflow-hidden rounded-[10px] border border-line bg-panel">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[19px] font-semibold tracking-[-0.015em] text-fg">{s.posting.company}</h2>
            <p className="mt-0.5 text-[13px] text-dim">{s.posting.role_title}</p>
            <p className="eyebrow mt-2 text-dim2">
              {[
                s.posting.location,
                s.posting.remote_policy !== 'unknown' ? s.posting.remote_policy : null,
                formatComp(s.posting.comp_min, s.posting.comp_max),
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
            {s.headline && <p className="mt-3 text-[13.5px] leading-relaxed text-fg">{s.headline}</p>}
          </header>

          <div className="space-y-5 px-5 py-5">
            {s.product && <Section title="What the product actually is" body={s.product} />}

            {s.vocab.length > 0 && (
              <section>
                <h3 className="eyebrow text-dim2">Vocabulary, because getting this wrong is expensive</h3>
                <dl className="mt-2 overflow-hidden rounded-[7px] border border-line">
                  {s.vocab.map((v, i) => (
                    <div
                      key={v.term}
                      className={`grid grid-cols-[minmax(110px,150px)_1fr] gap-3 px-3 py-2 ${i % 2 ? 'bg-panel2/40' : ''}`}
                    >
                      <dt className="font-mono text-[11.5px] text-viewed">{v.term}</dt>
                      <dd className="text-[12.5px] leading-relaxed text-dim">{v.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {s.the_angle && <Section title="The angle" body={s.the_angle} />}

            <div className="grid gap-5 md:grid-cols-2">
              {s.fit.length > 0 && <Bullets title="Why you fit" items={s.fit} tone="text-interview" />}
              {s.lack.length > 0 && <Bullets title="Where you lack" items={s.lack} tone="text-closed" />}
            </div>

            {s.scoped && <Section title="The one thing to have scoped" body={s.scoped} boxed />}
            {s.asks.length > 0 && <Bullets title="What to ask" items={s.asks} columns />}
            {s.week.length > 0 && <Bullets title="Before the call" items={s.week} />}

            {s.sourceList.length > 0 && (
              <p className="border-t border-line pt-3 text-[11px] text-dim2">
                {s.sourceList.length} source{s.sourceList.length === 1 ? '' : 's'}:{' '}
                {s.sourceList.slice(0, 6).map((u, i) => (
                  <span key={u}>
                    {i > 0 && ', '}
                    <a href={u} target="_blank" rel="noreferrer" className="hover:text-dim hover:underline">
                      {new URL(u).hostname.replace('www.', '')}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </div>
        </article>
      ))}
    </main>
  )
}

function Section({ title, body, boxed }: { title: string; body: string; boxed?: boolean }) {
  return (
    <section>
      <h3 className="eyebrow text-dim2">{title}</h3>
      <div
        className={
          boxed
            ? 'mt-2 rounded-[7px] border border-line bg-panel2/50 px-3.5 py-3 text-[13px] leading-relaxed text-dim'
            : 'mt-2 text-[13px] leading-relaxed text-dim'
        }
      >
        {body.split('\n\n').map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-2.5' : ''}>
            {p}
          </p>
        ))}
      </div>
    </section>
  )
}

function Bullets({
  title,
  items,
  tone,
  columns,
}: {
  title: string
  items: string[]
  tone?: string
  columns?: boolean
}) {
  return (
    <section>
      <h3 className={`eyebrow ${tone ?? 'text-dim2'}`}>{title}</h3>
      <ul className={`mt-2 space-y-1.5 ${columns ? 'md:columns-2 md:gap-6 md:space-y-0' : ''}`}>
        {items.map((t, i) => (
          <li key={i} className={`text-[12.5px] leading-relaxed text-dim ${columns ? 'md:mb-1.5 md:break-inside-avoid' : ''}`}>
            <span className="mr-1.5 text-dim2">·</span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  )
}
