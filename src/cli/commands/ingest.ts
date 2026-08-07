import { readFileSync } from 'node:fs'
import { openDb } from '../../lib/db.ts'
import { upsertPostings } from '../../lib/postings.ts'
import { boardFromUrl, addBoard } from '../../lib/boards.ts'
import { args, fail, plural, table } from '../util.ts'
import type { NormalizedPosting } from '../../lib/types.ts'

/**
 * Brings in postings found somewhere other than a polled board: his LinkedIn
 * saved list, a link someone sent him, a company with no public board.
 *
 * These arrive with a title, a company and a URL and nothing else. They enter
 * as 'manual' with no description, so the deterministic filter can judge the
 * title and location but keyword scoring has nothing to read until the real
 * posting is resolved. That is stated rather than papered over: an empty
 * description must not look like a posting that mentions nothing.
 *
 * Usage: pnpm cli ingest <file.json>
 *   [{ "title": "...", "company": "...", "location": "...", "url": "..." }]
 */
export function run(argv: string[]): void {
  const { values, positionals } = args(argv, { source: { type: 'string' }, dry: { type: 'boolean' } })
  const file = positionals[0]
  if (!file) fail('usage: pnpm cli ingest <file.json> [--source linkedin-saved]')

  let items: { title?: string; company?: string; location?: string; url?: string }[]
  try {
    items = JSON.parse(readFileSync(file, 'utf8')) as typeof items
  } catch (err) {
    return fail(`could not read ${file}: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!Array.isArray(items)) fail('the file must contain a JSON array')

  const db = openDb()
  const source = values.source ?? 'manual'
  const postings: NormalizedPosting[] = []
  const skipped: string[] = []

  for (const item of items) {
    if (!item.title || !item.company || !item.url) {
      skipped.push(JSON.stringify(item).slice(0, 60))
      continue
    }

    // If the URL points at a board we can actually poll, register it so the
    // real posting gets picked up with its description on the next run.
    const board = boardFromUrl(item.url)
    if (board) addBoard(db, board.ats, board.token, item.company)

    postings.push({
      ats: 'manual',
      board_token: source,
      job_id: item.url.match(/(\d{6,})/)?.[1] ?? item.url.slice(-24),
      url: item.url,
      company: item.company.trim(),
      role_title: item.title.trim(),
      location: item.location?.trim() ?? null,
      remote_policy: /remote/i.test(item.location ?? '') ? 'remote' : /hybrid/i.test(item.location ?? '') ? 'hybrid' : 'unknown',
      comp_min: null,
      comp_max: null,
      years_min: null,
      years_max: null,
      description_html: null,
      // Deliberately empty. Nothing is invented to fill it.
      description_text: '',
    })
  }

  if (values.dry) {
    console.log(table([['COMPANY', 'ROLE', 'LOCATION'], ...postings.map((p) => [p.company, p.role_title, p.location ?? ''])]))
    console.log(`\n${plural(postings.length, 'posting')} would be ingested`)
    return
  }

  const result = upsertPostings(db, postings)
  console.log(`${plural(result.inserted, 'new posting')}, ${result.updated} already known`)
  if (skipped.length) console.log(`${plural(skipped.length, 'row')} skipped for missing title, company or url`)
  console.log('\nthese have no description yet, so scoring can only judge the title.')
  console.log('next: pnpm cli filter')
}
