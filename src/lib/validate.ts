import { readFacts, resolveFacts } from './facts.ts'
import { loadFonts, measure, TARGET_LINES } from './pdf/layout.ts'

/**
 * Where the handoff's two non-negotiables stop being instructions a drafter
 * has to remember and become conditions a submission has to satisfy.
 *
 *   Never invent a fact. Every claim traces to an id in the fact library, and
 *   an id that does not exist is a hard failure rather than a warning.
 *
 *   Never claim a gap. The "honest gaps" list is scanned for directly, so a
 *   sentence that quietly acquires SQL or React Native cannot be submitted.
 *
 * Errors block a submission. Warnings are printed and let it through, because
 * house-style lapses are worth flagging but not worth refusing work over.
 */

export interface ValidationIssue {
  rule: string
  message: string
  excerpt?: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export const EM_DASH = '—'

/** LinkedIn vocabulary: flagged, never fatal. */
const HOUSE_STYLE = [
  'passionate about', 'results-driven', 'results driven', 'proven track record',
  'excited to leverage', 'fast-paced environment', 'fast paced environment',
  'think outside the box', 'wear many hats', 'rockstar', 'ninja', 'guru',
  'synergy', 'best-in-class', 'world-class', 'cutting-edge', 'game-changer',
  'deep dive', 'circle back', 'move the needle', 'low-hanging fruit',
]

/** The metaphor shape he named and disliked: "X is a Y wearing Z's clothes." */
const METAPHOR_SHAPE = /\bis\s+(?:a|an)\s+\w+(?:\s+\w+)?\s+(?:wearing|dressed\s+in|in)\s+\w+(?:'s)?\s+(?:clothes|clothing|skin|disguise)/i

/** A window around the match, so a long paragraph does not bury the problem. */
function excerptAround(body: string, at: number, length: number, pad = 55): string {
  const start = Math.max(0, at - pad)
  const end = Math.min(body.length, at + length + pad)
  return `${start > 0 ? '...' : ''}${body.slice(start, end).replace(/\s+/g, ' ').trim()}${end < body.length ? '...' : ''}`
}

function findLine(body: string, needle: string): string | undefined {
  const at = body.toLowerCase().indexOf(needle.toLowerCase())
  if (at === -1) return undefined
  return excerptAround(body, at, needle.length)
}

/**
 * Gap vocabulary matched on word boundaries.
 *
 * A bare substring search reads "CRE" inside "screen" and "ML" inside "HTML",
 * so a clean draft gets refused for a claim it never made. A validator that
 * cries wolf is one people learn to override, which is worse than not having
 * it. Boundaries are only added where the pattern's own edges are word
 * characters, so "A/B" and "Builder.io" still match.
 */
function gapMatch(body: string, pattern: string): { index: number; length: number } | null {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const leading = /^\w/.test(pattern) ? '\\b' : ''
  const trailing = /\w$/.test(pattern) ? '\\b' : ''
  const m = new RegExp(`${leading}${escaped}${trailing}`, 'i').exec(body)
  return m ? { index: m.index, length: m[0].length } : null
}

export interface ValidateDraftOptions {
  body: string
  factsUsed: string[]
  /** Gap ids the draft is allowed to mention, for honest negations. */
  allowGaps?: string[]
  /** Cover letters must fit one page; free-text answers have no page. */
  checkPageFit?: boolean
}

export async function validateDraft(opts: ValidateDraftOptions): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const body = opts.body ?? ''

  if (!body.trim()) {
    errors.push({ rule: 'empty', message: 'draft body is empty' })
    return { ok: false, errors, warnings }
  }

  // 1. Every claim traces to the fact library.
  if (!opts.factsUsed?.length) {
    errors.push({
      rule: 'facts_used',
      message: 'facts_used is empty. List the fact ids this draft draws on so the claims can be checked.',
    })
  } else {
    const { unknown } = resolveFacts(opts.factsUsed)
    for (const id of unknown) {
      errors.push({
        rule: 'unknown_fact',
        message: `"${id}" is not in the fact library. Use an existing id, or ask before asserting something new.`,
      })
    }
  }

  // 2. No em dashes in anything he sends.
  if (body.includes(EM_DASH)) {
    const count = (body.match(new RegExp(EM_DASH, 'g')) ?? []).length
    errors.push({
      rule: 'em_dash',
      message: `${count} em dash${count === 1 ? '' : 'es'}. Use a comma, colon, period or parentheses.`,
      excerpt: findLine(body, EM_DASH),
    })
  }

  // 3. Never claim a gap.
  const allowed = new Set(opts.allowGaps ?? [])
  const lower = body.toLowerCase()
  for (const gap of readFacts().gaps) {
    if (allowed.has(gap.id)) continue
    for (const pattern of gap.patterns) {
      const hit = gapMatch(body, pattern)
      if (!hit) continue
      errors.push({
        rule: 'claimed_gap',
        message: `mentions "${pattern}", which is on the never-claim list: ${gap.text}`,
        excerpt: excerptAround(body, hit.index, hit.length),
      })
      break
    }
  }

  // 4. One page, using the renderer's own measurement.
  if (opts.checkPageFit !== false) {
    const { regular } = await loadFonts()
    const m = measure(body, regular)
    if (m.overflow) {
      errors.push({
        rule: 'page_fit',
        message:
          `runs past one page by ${m.overflowBy.toFixed(1)}pt (${m.lineCount} lines). ` +
          `Cut to about ${TARGET_LINES.max} lines.`,
      })
    } else if (m.lineCount > TARGET_LINES.max) {
      warnings.push({ rule: 'length', message: `${m.lineCount} lines is long; ${TARGET_LINES.max} is the usual ceiling.` })
    } else if (m.lineCount < TARGET_LINES.min) {
      warnings.push({ rule: 'length', message: `${m.lineCount} lines is short for a cover letter.` })
    }
  }

  // 5. House style.
  for (const phrase of HOUSE_STYLE) {
    if (lower.includes(phrase)) {
      warnings.push({ rule: 'house_style', message: `"${phrase}" is LinkedIn vocabulary.`, excerpt: findLine(body, phrase) })
    }
  }
  if (METAPHOR_SHAPE.test(body)) {
    warnings.push({ rule: 'house_style', message: 'reads as "X is a Y wearing Z\'s clothes". Say the plain thing.' })
  }
  // The gap paragraph he retired: close forward instead.
  if (/where I (do not|don't) match|I (do not|don't) match the posting|my gaps?\b/i.test(body)) {
    warnings.push({
      rule: 'gap_paragraph',
      message: 'looks like a "where I do not match the posting" paragraph. That is handled in the interview, not in writing.',
    })
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function formatIssues(result: ValidationResult): string {
  const out: string[] = []
  for (const e of result.errors) {
    out.push(`  error  [${e.rule}] ${e.message}`)
    if (e.excerpt) out.push(`         ...${e.excerpt}`)
  }
  for (const w of result.warnings) {
    out.push(`  warn   [${w.rule}] ${w.message}`)
    if (w.excerpt) out.push(`         ...${w.excerpt}`)
  }
  return out.join('\n')
}
