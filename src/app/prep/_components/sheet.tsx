'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PrepView } from '@/lib/prep'
import { formatComp, relativeDays } from '@/lib/ui'
import { Checklist } from './checklist'
import { FitGaps } from './fit-gaps'
import { Block, ExternalGlyph, SectionTitle } from './primitives'
import { Prose } from './prose'
import { Rail, type RailItem } from './rail'
import { useChecked } from './use-checked'
import { Vocabulary } from './vocabulary'

/**
 * One sheet, read twice: end to end the night before, and in fragments during
 * the call. The rail and the counts serve the second reading, which is the one
 * that fails if the page is a column of prose.
 *
 * Mounted with a key per posting, so the ticked-question state below never has
 * to survive a change of sheet.
 */
export function Sheet({ sheet }: { sheet: PrepView }) {
  const posting = sheet.posting
  const asks = useChecked(`prep:${posting.id}:asked`)
  const week = useChecked(`prep:${posting.id}:before`)

  const bodyRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  const railItems = useMemo(() => {
    const items: RailItem[] = []
    const ticked = (list: string[], checked: readonly string[]) =>
      `${list.filter((i) => checked.includes(i)).length}/${list.length}`

    if (sheet.product) items.push({ id: 'product', label: 'The product' })
    if (sheet.vocab.length > 0) items.push({ id: 'vocabulary', label: 'Vocabulary', note: String(sheet.vocab.length) })
    if (sheet.the_angle) items.push({ id: 'angle', label: 'The angle' })
    if (sheet.fit.length + sheet.lack.length > 0)
      items.push({ id: 'fit-gaps', label: 'Fit and gaps', note: `${sheet.fit.length}/${sheet.lack.length}` })
    if (sheet.scoped) items.push({ id: 'scoped', label: 'Scoped' })
    if (sheet.asks.length > 0)
      items.push({ id: 'questions', label: 'What to ask', note: ticked(sheet.asks, asks.checked) })
    if (sheet.week.length > 0)
      items.push({ id: 'before', label: 'Before the call', note: ticked(sheet.week, week.checked) })
    return items
  }, [sheet, asks.checked, week.checked])

  const idKey = railItems.map((i) => i.id).join('|')
  const [active, setActive] = useState('')

  // Which section is under the pinned strip, not which is technically topmost.
  useEffect(() => {
    const ids = idKey ? idKey.split('|') : []
    const first = ids[0]
    if (first === undefined) return

    let frame = 0
    const measure = () => {
      frame = 0
      let current = first
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 120) current = id
      }
      const bottom = document.documentElement.scrollHeight - window.innerHeight - 4
      const last = ids[ids.length - 1]
      if (last !== undefined && window.scrollY >= bottom) current = last
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [idKey])

  // The button reads the DOM rather than its own state, so it stays honest
  // after a section has been opened by hand.
  useEffect(() => {
    const node = bodyRef.current
    if (!node) return
    const sync = () => {
      const all = [...node.querySelectorAll('details')]
      setExpanded(all.length > 0 && all.every((d) => d.open))
    }
    node.addEventListener('toggle', sync, true)
    return () => node.removeEventListener('toggle', sync, true)
  }, [])

  const toggleAll = useCallback(() => {
    const node = bodyRef.current
    if (!node) return
    const all = [...node.querySelectorAll('details')]
    const next = all.some((d) => !d.open)
    for (const d of all) d.open = next
  }, [])

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }, [])

  const comp = formatComp(posting.comp_min, posting.comp_max)
  const meta = [
    posting.location,
    posting.remote_policy && posting.remote_policy !== 'unknown' ? posting.remote_policy : null,
    comp === '—' ? null : comp,
    `written ${relativeDays(sheet.written_at)}`,
  ].filter(Boolean)

  return (
    <article className="max-w-[1112px]">
      <header className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-[23px] font-semibold leading-tight tracking-[-0.02em] text-fg">{posting.company}</h1>
            <p className="mt-1 text-[13.5px] text-dim">{posting.role_title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href={`/posting/${posting.id}`}
              className="rounded-[6px] border border-line bg-panel px-2.5 py-1 text-[11.5px] text-dim transition-colors hover:border-line2 hover:text-fg"
            >
              Posting
            </Link>
            <a
              href={posting.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-panel px-2.5 py-1 text-[11.5px] text-dim transition-colors hover:border-line2 hover:text-fg"
            >
              Job ad
              <ExternalGlyph className="size-3" />
            </a>
          </div>
        </div>

        <p className="eyebrow mt-2.5 text-dim2">{meta.join('  ·  ')}</p>

        {sheet.headline && (
          <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-fg">{sheet.headline}</p>
        )}
      </header>

      <div className="lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
        <Rail items={railItems} active={active} onJump={jump} expanded={expanded} onToggleAll={toggleAll} />

        <div ref={bodyRef} className="min-w-0">
          {sheet.product && (
            <Block id="product">
              <SectionTitle>What the product actually is</SectionTitle>
              <Prose text={sheet.product} className="mt-2.5" />
            </Block>
          )}

          {sheet.vocab.length > 0 && (
            <Block id="vocabulary">
              <Vocabulary terms={sheet.vocab} />
            </Block>
          )}

          {sheet.the_angle && (
            <Block id="angle">
              <SectionTitle>The angle</SectionTitle>
              <Prose text={sheet.the_angle} className="mt-2.5" />
            </Block>
          )}

          {sheet.fit.length + sheet.lack.length > 0 && (
            <Block id="fit-gaps">
              <SectionTitle>Fit and gaps</SectionTitle>
              <div className="mt-3">
                <FitGaps fit={sheet.fit} lack={sheet.lack} />
              </div>
            </Block>
          )}

          {sheet.scoped && (
            <Block id="scoped">
              <SectionTitle>The one thing to have scoped</SectionTitle>
              <div className="mt-3 rounded-[8px] border border-line2 bg-panel px-4 py-3.5">
                <Prose text={sheet.scoped} />
              </div>
            </Block>
          )}

          {sheet.asks.length > 0 && (
            <Block id="questions">
              <Checklist
                title="What to ask"
                hint="Tick them off as you go. Kept in this browser, nothing is written back."
                items={sheet.asks}
                checked={asks.checked}
                onToggle={asks.toggle}
                onReset={asks.reset}
                accent="interview"
                twoUp
              />
            </Block>
          )}

          {sheet.week.length > 0 && (
            <Block id="before">
              <Checklist
                title="Before the call"
                items={sheet.week}
                checked={week.checked}
                onToggle={week.toggle}
                onReset={week.reset}
                accent="applied"
                twoUp
              />
            </Block>
          )}

          {sheet.sourceList.length > 0 && (
            <footer className="mt-8 border-t border-line pt-4">
              <p className="eyebrow text-dim2">
                {sheet.sourceList.length} source{sheet.sourceList.length === 1 ? '' : 's'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sheet.sourceList.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-panel px-2 py-1 text-[11px] text-dim2 transition-colors hover:border-line2 hover:text-dim"
                  >
                    {hostOf(url)}
                    <ExternalGlyph className="size-2.5" />
                  </a>
                ))}
              </div>
            </footer>
          )}
        </div>
      </div>
    </article>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
