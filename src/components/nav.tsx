'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/ui'

/**
 * The two views answer different questions, and not saying so is what made
 * them confusing. Pipeline is work in progress toward an application; Tracker
 * is everything already sent. The subtitle under the active tab states it.
 */
const VIEWS = [
  { href: '/', label: 'Pipeline', blurb: 'Roles being worked toward an application' },
  { href: '/tracker', label: 'Tracker', blurb: 'Everything already sent, and what came back' },
  { href: '/prep', label: 'Prep', blurb: 'Interview sheets: the angle, the vocabulary, and where he is weakest' },
  { href: '/facts', label: 'Facts', blurb: 'What may be claimed, and what never can' },
]

export function Nav() {
  const pathname = usePathname()
  const active = VIEWS.find((v) => (v.href === '/' ? pathname === '/' : pathname.startsWith(v.href))) ?? VIEWS[0]!

  return (
    <header className="border-b border-line pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
            recruit<span className="text-dim2">-</span>bot
          </Link>
          <span className="hidden text-[11.5px] text-dim2 sm:inline">
            discovery, triage and first drafts. nothing is sent without you.
          </span>
        </div>

        <nav className="flex gap-0.5 rounded-[8px] border border-line bg-panel p-0.5">
          {VIEWS.map((v) => {
            const isActive = v.href === active.href
            return (
              <Link
                key={v.href}
                href={v.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 text-[12px] transition-colors',
                  isActive ? 'bg-panel2 text-fg' : 'text-dim hover:text-fg',
                )}
              >
                {v.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <p className="mt-2 text-[12px] text-dim">{active.blurb}</p>
    </header>
  )
}
