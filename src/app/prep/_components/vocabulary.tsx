'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { VocabTerm } from '@/lib/prep'
import { SearchGlyph, SectionTitle } from './primitives'

/**
 * The glossary is the one section read mid-call, under time pressure, while
 * someone is talking. Filter first, scroll never: "/" from anywhere on the
 * page lands the cursor here.
 */
export function Vocabulary({ terms }: { terms: VocabTerm[] }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      needle
        ? terms.filter((t) => t.term.toLowerCase().includes(needle) || t.meaning.toLowerCase().includes(needle))
        : terms,
    [terms, needle],
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SectionTitle count={needle ? `${shown.length} of ${terms.length}` : `${terms.length}`}>
          Vocabulary, because getting this wrong is expensive
        </SectionTitle>

        <div className="relative w-full sm:w-[220px]">
          <SearchGlyph className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-dim2" />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
            }}
            placeholder="Filter terms"
            aria-label="Filter vocabulary"
            className="h-7 w-full rounded-[6px] border border-line bg-panel2 pl-7 pr-9 text-[12px] text-fg placeholder:text-dim2 focus:border-line2 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[4px] border border-line2 px-1 font-mono text-[10px] leading-[15px] text-dim2">
            /
          </kbd>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-3 rounded-[7px] border border-line bg-panel px-3.5 py-6 text-center text-[12px] text-dim2">
          No term matches “{query.trim()}”.
        </p>
      ) : (
        <dl className="mt-3 divide-y divide-line overflow-hidden rounded-[7px] border border-line bg-panel">
          {shown.map((v) => (
            <div
              key={v.term}
              className="grid gap-x-4 gap-y-0.5 px-3.5 py-2.5 transition-colors hover:bg-panel2/70 sm:grid-cols-[minmax(0,152px)_minmax(0,1fr)]"
            >
              <dt className="font-mono text-[11.5px] leading-[1.6] text-fg">
                <Mark text={v.term} needle={needle} />
              </dt>
              <dd className="text-[12.5px] leading-[1.6] text-dim">
                <Mark text={v.meaning} needle={needle} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Highlights the first hit only: enough to show why a row survived the filter. */
function Mark({ text, needle }: { text: string; needle: string }) {
  if (!needle) return <>{text}</>
  const at = text.toLowerCase().indexOf(needle)
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[2px] bg-applied/25 text-fg">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}
