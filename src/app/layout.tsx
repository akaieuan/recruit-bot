import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'recruit-bot',
  description: 'Application pipeline',
}

const NAV = [
  { href: '/', label: 'Pipeline' },
  { href: '/tracker', label: 'Tracker' },
  { href: '/facts', label: 'Facts' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-[1280px] px-5 pb-24 pt-7">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
            <div>
              <h1 className="text-[18px] font-semibold tracking-[-0.01em]">recruit-bot</h1>
              <p className="mt-1 max-w-[86ch] text-[12px] text-dim">
                Discovery, triage and first drafts. Everything here is a draft until you send it.
              </p>
            </div>
            <nav className="flex gap-1.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[7px] border border-line bg-panel px-3 py-1.5 text-[12px] text-dim transition-colors hover:border-line2 hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
