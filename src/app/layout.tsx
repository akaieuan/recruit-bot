import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/nav'

export const metadata: Metadata = {
  title: 'recruit-bot',
  description: 'Application pipeline',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-[1320px] px-5 pb-24 pt-6">
          <Nav />
          {children}
        </div>
      </body>
    </html>
  )
}
