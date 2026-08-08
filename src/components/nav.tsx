'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/ui'

/**
 * The two main views answer different questions, and not saying so is what
 * made them confusing. Pipeline is work in progress toward an application;
 * Tracker is everything already sent.
 *
 * Each view gets a real page title rather than a caption under a tab bar. A
 * table hanging directly off the chrome never says what it is a table of.
 */
const VIEWS = [
  {
    href: '/',
    label: 'Pipeline',
    kicker: 'Work in progress',
    blurb: 'Roles being worked toward an application, in the order they need you.',
  },
  {
    href: '/tracker',
    label: 'Tracker',
    kicker: 'Already sent',
    blurb: 'Everything that has gone out, and what came back.',
  },
  {
    href: '/prep',
    label: 'Prep',
    kicker: 'Interview sheets',
    blurb: 'The angle, the vocabulary, and where he is weakest.',
  },
  {
    href: '/facts',
    label: 'Facts',
    kicker: 'The library',
    blurb: 'What may be claimed, and what never can.',
  },
]

export function Nav() {
  const pathname = usePathname()
  const active = VIEWS.find((v) => (v.href === '/' ? pathname === '/' : pathname.startsWith(v.href))) ?? VIEWS[0]!

  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="text-[15px] font-medium tracking-[-0.02em] text-fg">
            recruit<span className="text-dim2">-</span>bot
          </Link>
          <span className="hidden font-mono text-[10.5px] text-dim2 md:inline">
            nothing is sent without you
          </span>
        </div>

        <nav aria-label="Views" className="flex gap-0.5 rounded-chip border border-line bg-panel p-0.5">
          {VIEWS.map((v) => {
            const isActive = v.href === active.href
            return (
              <Link
                key={v.href}
                href={v.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 text-[12px] transition-colors',
                  isActive ? 'bg-panel3 text-fg' : 'text-dim hover:text-fg',
                )}
              >
                {v.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="mt-8 border-b border-line pb-6">
        <p className="eyebrow text-dim2">{active.kicker}</p>
        <h1 className="mt-2.5 text-[26px] font-light leading-none tracking-[-0.03em] text-fg">
          {active.label}
        </h1>
        <p className="mt-2.5 max-w-[64ch] text-[13px] text-dim">{active.blurb}</p>
      </div>
    </header>
  )
}
