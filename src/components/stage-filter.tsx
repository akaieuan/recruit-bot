import { cn, STAGE_STYLE } from '@/lib/ui'
import { Dot } from '@/components/ui/badge'
import { Chip, ChipRow } from '@/components/ui/chip'
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
    <ChipRow className="mt-5">
      {SHOWN.map((stage) => {
        const isActive = stage === 'active'
        const count = isActive ? activeTotal : (counts[stage] ?? 0)
        if (!count && !isActive) return null
        const style = isActive ? null : STAGE_STYLE[stage as Stage]
        return (
          <Chip
            key={stage}
            href={stage === 'active' ? '/' : `/?stage=${stage}`}
            selected={current === stage}
            count={count}
            leading={<Dot className={cn('size-[6px]', style?.dot ?? 'bg-fg')} />}
          >
            {isActive ? 'Active' : style?.label}
          </Chip>
        )
      })}
    </ChipRow>
  )
}
