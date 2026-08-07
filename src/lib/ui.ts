import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Stage } from './types.ts'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * One accent per pipeline state, reusing the vocabulary from his existing
 * tracker page: blue for in flight, green for a live conversation, amber for
 * waiting on him, red for done, grey for dormant.
 */
export const STAGE_STYLE: Record<Stage, { label: string; dot: string; text: string }> = {
  new: { label: 'New', dot: 'bg-dim2', text: 'text-dim' },
  auto_rejected: { label: 'Auto-rejected', dot: 'bg-closed', text: 'text-closed' },
  needs_score: { label: 'To score', dot: 'bg-lead', text: 'text-dim' },
  scored: { label: 'Held', dot: 'bg-lead', text: 'text-dim' },
  needs_research: { label: 'To research', dot: 'bg-applied', text: 'text-applied' },
  researched: { label: 'Researched', dot: 'bg-applied', text: 'text-applied' },
  needs_draft: { label: 'To draft', dot: 'bg-applied', text: 'text-applied' },
  in_review: { label: 'Your review', dot: 'bg-viewed', text: 'text-viewed' },
  approved: { label: 'Approved', dot: 'bg-interview', text: 'text-interview' },
  applied: { label: 'Applied', dot: 'bg-interview', text: 'text-interview' },
  skipped: { label: 'Skipped', dot: 'bg-dim2', text: 'text-dim2' },
}

export const TIER_STYLE: Record<string, string> = {
  strong: 'text-interview border-interview/30 bg-interview/10',
  possible: 'text-applied border-applied/30 bg-applied/10',
  long_shot: 'text-viewed border-viewed/30 bg-viewed/10',
  reject: 'text-closed border-closed/30 bg-closed/10',
}

export const APP_STATUS_STYLE: Record<string, string> = {
  unknown: 'text-dim2',
  applied: 'text-applied',
  no_response: 'text-dim',
  in_progress: 'text-viewed',
  interviewing: 'text-interview',
  rejected: 'text-closed',
  offer: 'text-interview',
  withdrawn: 'text-dim2',
  do_not_apply: 'text-closed',
}

/** "$150-250k", or a dash when the employer did not publish a range. */
export function formatComp(min: number | null, max: number | null): string {
  if (min === null && max === null) return '—'
  const k = (n: number) => `${Math.round(n / 1000)}k`
  if (min !== null && max !== null && min !== max) return `$${k(min)}–${k(max)}`
  return `$${k((min ?? max) as number)}`
}

export function formatDate(iso: string | null, precision?: string | null): string {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  return precision === 'before' ? `≤ ${day}` : day
}

export function relativeDays(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime()
  const days = Math.round((Date.now() - then) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 0) return `in ${-days}d`
  return `${days}d ago`
}
