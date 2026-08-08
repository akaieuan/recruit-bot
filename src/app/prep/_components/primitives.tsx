import { cn } from '@/lib/ui'

/** Inline shapes rather than a dependency: four glyphs do not earn a package. */

export function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className={className}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className={className}>
      <path d="M2.5 6.2 5 8.6l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className={className}>
      <circle cx="5.2" cy="5.2" r="3.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="m7.8 7.8 2.2 2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function ExternalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden className={className}>
      <path d="M4 8 8 4M8 4H5M8 4v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * One rule between sections and one heading size across the sheet. The rail
 * jumps to these ids, so scroll-margin has to clear the pinned strip.
 */
export function Block({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={cn(
        'mt-8 scroll-mt-[64px] border-t border-line pt-8 first:mt-5 first:border-0 first:pt-0 lg:scroll-mt-6',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
      {children}
      {count !== undefined && <span className="tabular text-[11px] font-normal text-dim2">{count}</span>}
    </h2>
  )
}
