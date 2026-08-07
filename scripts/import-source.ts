/**
 * One-time (idempotent) copy step: pulls the handoff doc, the tracker CSV, the
 * cover-letter corpus and archive out of their working folder and into data/.
 *
 * It also derives two files the rest of the pipeline treats as authoritative:
 *   data/facts.json  the fact library, plus the never-claim gap list
 *   data/voice.md    the voice rules and cover letter format
 *
 * Both are derived, not authored: rerunning regenerates them from the handoff.
 * Fact ids are slugs of the fact text, so they stay stable across reruns as
 * long as the wording does. Ids are the contract used by every draft, so once
 * a fact exists its wording should only be extended, never rewritten.
 *
 * Usage: pnpm cli import source [--handoff <path>] [--emplyob <dir>]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PATHS } from '../src/lib/paths.ts'
import type { Fact } from '../src/lib/types.ts'

const DEFAULT_EMPLYOB = '/Users/ieuanking/Desktop/akaIQ/emplyob'

/**
 * Technology and discipline vocabulary the gap scanner knows how to spot.
 * Generic lint vocabulary: which of these are actually off-limits comes from
 * the handoff's own gap list, never from this file.
 */
const TECH_VOCAB = [
  'React Native', 'Angular', 'Vue', 'Svelte', 'SQL', 'Webflow', 'Builder.io',
  'Framer', 'LM Studio', 'Ollama', 'fine-tuning', 'fine-tune', 'A/B',
  'Kubernetes', 'Terraform', 'Rust', 'Go', 'Java', 'Swift', 'Kotlin',
  'Flutter', 'Salesforce', 'SAP', 'Snowflake', 'dbt', 'Looker', 'Tableau',
]

const DISCIPLINE_VOCAB = [
  'managed a design team', 'design manager', 'critique group', 'people management',
  'ML research', 'machine learning research', 'quantitative research',
  'incident response', 'on-call', 'commerce', 'adtech', 'fintech', 'healthcare',
  'CRE', 'backend',
]

interface Section {
  title: string
  slug: string
  body: string
}

function slugify(input: string, maxWords = 4): string {
  const stop = new Set([
    'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or', 'with',
    'over', 'across', 'per', 'as', 'by', 'from', 'that', 'is', 'was', 'were',
    'his', 'he', 'it', 'its', 'not', 'no', 'never',
  ])
  const words = input
    .toLowerCase()
    // Keep grouped numbers whole: "1,038 commits" slugs as "1038-commits".
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w))
  const picked = words.slice(0, maxWords)
  return picked.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'fact'
}

/** Splits a markdown doc into its `## N. Title` sections. */
function splitSections(md: string): Section[] {
  const lines = md.split('\n')
  const out: Section[] = []
  let current: Section | null = null
  for (const line of lines) {
    const m = /^##\s+(?:(\d+)\.\s*)?(.+)$/.exec(line)
    if (m && !line.startsWith('###')) {
      if (current) out.push(current)
      const title = (m[2] ?? '').trim()
      current = { title, slug: slugify(title, 3), body: '' }
    } else if (current) {
      current.body += `${line}\n`
    }
  }
  if (current) out.push(current)
  return out
}

/** Splits a section body into its `### Title` subsections (plus a lead-in). */
function splitSubsections(body: string): { title: string; body: string }[] {
  const lines = body.split('\n')
  const out: { title: string; body: string }[] = []
  let current = { title: '', body: '' }
  for (const line of lines) {
    const m = /^###\s+(.+)$/.exec(line)
    if (m) {
      if (current.body.trim() || current.title) out.push(current)
      current = { title: (m[1] ?? '').trim(), body: '' }
    } else {
      current.body += `${line}\n`
    }
  }
  if (current.body.trim() || current.title) out.push(current)
  return out
}

/**
 * Markdown to the plain sentence a cover letter would actually use.
 *
 * Em dashes are removed here rather than left for the validator to catch: the
 * handoff says facts may be quoted verbatim, and a letter quoting one would
 * otherwise trip the no-em-dash rule on text it was told was safe. The first
 * em dash separates a label from its description, so it becomes a colon; any
 * later one is a parenthetical break and becomes a comma.
 */
function stripMd(s: string): string {
  let seen = 0
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)')
    .replace(/\s*—\s*/g, () => (seen++ === 0 ? ': ' : ', '))
    .trim()
}

/** Top-level bullets only; continuation lines fold into the bullet above. */
function bullets(body: string): string[] {
  const out: string[] = []
  for (const raw of body.split('\n')) {
    const m = /^[-*]\s+(.*)$/.exec(raw)
    if (m) {
      out.push((m[1] ?? '').trim())
    } else if (out.length && /^\s{2,}\S/.test(raw)) {
      out[out.length - 1] += ` ${raw.trim()}`
    }
  }
  return out
}

function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p && !p.startsWith('#') && !/^[-*]\s/.test(p) && p !== '---')
}

const SECTION_PREFIX: Record<string, string> = {
  ubik: 'ubik',
  'open-source-akaoss': 'oss',
  research: 'research',
  'pre-software': 'pre',
  stack: 'stack',
}

function factsFrom(handoff: string): { facts: Fact[]; gaps: { id: string; text: string; patterns: string[] }[] } {
  const sections = splitSections(handoff)
  const facts: Fact[] = []
  const gaps: { id: string; text: string; patterns: string[] }[] = []
  const seen = new Map<string, number>()

  const push = (prefix: string, text: string, tags: string[]) => {
    const clean = stripMd(text)
    if (!clean) return
    // Prefer a leading bold label ("**HITL Kit** — ...") for a readable id.
    const labelMatch = /^\*\*(.+?)\*\*/.exec(text)
    const base = labelMatch?.[1] ? slugify(labelMatch[1], 3) : slugify(clean)
    let id = `${prefix}.${base}`
    const n = seen.get(id) ?? 0
    seen.set(id, n + 1)
    if (n > 0) id = `${id}-${n + 1}`
    facts.push({ id, text: clean, tags })
  }

  const bio = sections.find((s) => /who he is/i.test(s.title))
  if (bio) {
    for (const b of bullets(bio.body)) push('bio', b, ['bio'])
    for (const p of paragraphs(bio.body)) {
      if (/thesis he actually argues/i.test(p)) push('bio', p.replace(/^Thesis he actually argues:\s*/i, ''), ['bio', 'thesis'])
      else if (/design engineer, brooklyn/i.test(p)) push('bio', p, ['bio', 'positioning'])
    }
  }

  const lib = sections.find((s) => /fact library/i.test(s.title))
  if (!lib) throw new Error('handoff has no "Fact library" section')

  for (const sub of splitSubsections(lib.body)) {
    if (!sub.title) continue
    const subSlug = slugify(sub.title, 3)
    const isGaps = /honest gaps/i.test(sub.title)
    const prefix = SECTION_PREFIX[subSlug] ?? subSlug
    const items = bullets(sub.body)
    const bodyItems = items.length ? items : paragraphs(sub.body)

    for (const item of bodyItems) {
      if (isGaps) {
        const text = stripMd(item)
        if (!text) continue
        gaps.push({ id: `gap.${slugify(text)}`, text, patterns: gapPatterns(text) })
      } else {
        push(prefix, item, [prefix])
      }
    }
  }

  return { facts, gaps }
}

/**
 * Detection keywords for a gap line: the vocabulary terms it mentions. These
 * become the banned-claim patterns the draft validator scans for.
 */
function gapPatterns(text: string): string[] {
  const hay = text.toLowerCase()
  const hits = [...TECH_VOCAB, ...DISCIPLINE_VOCAB].filter((term) => hay.includes(term.toLowerCase()))
  return [...new Set(hits)]
}

function voiceFrom(handoff: string): string {
  const sections = splitSections(handoff)
  const voice = sections.find((s) => /^voice$/i.test(s.title))
  if (!voice) throw new Error('handoff has no "Voice" section')
  return `# Voice\n\nDerived from the handoff. Regenerated by \`pnpm cli import source\`.\n${voice.body.replace(/\n*---\n*$/, '\n')}`
}

function copyDir(from: string, to: string, filter: (name: string) => boolean): number {
  if (!existsSync(from)) return 0
  mkdirSync(to, { recursive: true })
  let n = 0
  for (const name of readdirSync(from)) {
    const src = join(from, name)
    if (!statSync(src).isFile() || !filter(name)) continue
    copyFileSync(src, join(to, name))
    n++
  }
  return n
}

export function importSource(opts: { emplyob?: string; handoff?: string } = {}): void {
  const emplyob = opts.emplyob ?? DEFAULT_EMPLYOB
  const handoffPath = opts.handoff ?? join(emplyob, 'JOB_FUNNEL_HANDOFF.md')

  if (!existsSync(handoffPath)) {
    throw new Error(`handoff not found at ${handoffPath} (pass --handoff <path>)`)
  }

  for (const dir of [PATHS.data, PATHS.source, PATHS.corpus, PATHS.coversArchive, PATHS.reference, PATHS.outCovers]) {
    mkdirSync(dir, { recursive: true })
  }

  const handoff = readFileSync(handoffPath, 'utf8')
  copyFileSync(handoffPath, PATHS.handoff)

  const { facts, gaps } = factsFrom(handoff)
  writeFileSync(
    PATHS.facts,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        source: basename(handoffPath),
        note: 'Derived from the handoff fact library. Ids are the contract used by drafts: extend wording, never rewrite it. Nothing outside `facts` may be asserted about Ieuan.',
        facts,
        gaps,
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(PATHS.voice, voiceFrom(handoff))

  // Tracker CSV
  const csvSrc = join(emplyob, 'ieuan_job_applications.csv')
  if (existsSync(csvSrc)) copyFileSync(csvSrc, join(PATHS.source, 'ieuan_job_applications.csv'))

  // Voice corpus: prior letters and answers in plaintext.
  const coverDir = join(emplyob, 'cover')
  const corpusN = copyDir(coverDir, PATHS.corpus, (n) => n.endsWith('.txt'))
  const archiveN = copyDir(coverDir, PATHS.coversArchive, (n) => n.endsWith('.pdf') || n.endsWith('.docx'))

  // Layout reference for the PDF generator.
  const axon = 'Ieuan King - Axon - Staff Product Designer 911.pdf'
  for (const dir of [coverDir, join(PATHS.data, 'covers-archive-root')]) {
    const p = join(dir, axon)
    if (existsSync(p)) {
      copyFileSync(p, join(PATHS.reference, axon))
      break
    }
  }

  if (!existsSync(PATHS.config)) {
    writeFileSync(
      PATHS.config,
      `${JSON.stringify(
        {
          name: 'Ieuan King',
          location: 'Brooklyn, NY',
          email: 'Ieuan@yionvisual.com',
          links: {
            design: ['akabuild.dev', 'akaoss.dev', 'linkedin.com/in/ieuan-king'],
            // NEEDS CONFIRMATION: taken from the git remote, not from the fact
            // library. Check this before the first engineering-variant letter.
            engineering: ['akabuild.dev', 'akaoss.dev', 'github.com/akaieuan'],
          },
          confirm: ['links.engineering'],
        },
        null,
        2,
      )}\n`,
    )
  }

  console.log(`facts:    ${facts.length} facts, ${gaps.length} gaps -> ${PATHS.facts}`)
  console.log(`voice:    ${PATHS.voice}`)
  console.log(`corpus:   ${corpusN} text files -> ${PATHS.corpus}`)
  console.log(`archive:  ${archiveN} letters -> ${PATHS.coversArchive}`)
  console.log(`handoff:  ${PATHS.handoff}`)
  console.log(`config:   ${PATHS.config}`)
}
