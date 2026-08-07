import Link from 'next/link'
import { cn, STAGE_STYLE } from '@/lib/ui'
import { Dot } from '@/components/ui/badge'
import type { Stage } from '@/lib/types'

const SHOWN: (Stage | 'active')[] = [
  'active',
  'in_review',
  'needs_draft',
  'needs_research',
  'needs_score',
  'approved',
  'applied',
  'scored',
  'skipped',
  'auto_rejected',
]

export function StageFilter({ counts, current }: { counts: Record<string, number>; current: string }) {
  const activeTotal = (
    ['needs_score', 'scored', 'needs_research', 'researched', 'needs_draft', 'in_review', 'approved'] as Stage[]
  ).reduce((sum, s) => sum + (counts[s] ?? 0), 0)

  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {SHOWN.map((stage) => {
        const isActive = stage === 'active'
        const count = isActive ? activeTotal : (counts[stage] ?? 0)
        if (!count && !isActive) return null
        const selected = current === stage
        const style = isActive ? null : STAGE_STYLE[stage as Stage]
        return (
          <Link
            key={stage}
            href={stage === 'active' ? '/' : `/?stage=${stage}`}
            className={cn(
              'flex items-center gap-2 rounded-[7px] border px-2.5 py-1.5 text-[12px] transition-colors',
              selected
                ? 'border-line2 bg-panel2 text-fg'
                : 'border-line bg-panel text-dim hover:border-line2 hover:text-fg',
            )}
          >
            {style ? <Dot className={style.dot} /> : <Dot className="bg-fg" />}
            {isActive ? 'Active' : style?.label}
            <b className="tabular font-semibold text-fg">{count}</b>
          </Link>
        )
      })}
    </div>
  )
}
