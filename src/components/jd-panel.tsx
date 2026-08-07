'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** The job description, collapsed by default so it does not bury the draft. */
export function JdPanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} className="px-0">
        {open ? 'Hide' : 'Show'} job description ({text.length.toLocaleString()} characters)
      </Button>
      {open && (
        <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-[7px] border border-line bg-bg px-3 py-2.5 text-[12px] leading-[1.6] text-dim">
          {text}
        </pre>
      )}
    </div>
  )
}
