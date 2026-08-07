import { openDb } from '../../lib/db.ts'
import { listBoards } from '../../lib/boards.ts'
import { fetchAshbyBoard, fetchAshbyPosting } from '../../lib/ashby.ts'
import { fetchGreenhouseBoard } from '../../lib/greenhouse.ts'
import { closeMissing, upsertPostings } from '../../lib/postings.ts'
import { args, fail, plural } from '../util.ts'

const PAUSE_MS = 400

export async function run(argv: string[]): Promise<void> {
  const { values } = args(argv, {
    board: { type: 'string' },
    url: { type: 'string', multiple: true },
    quiet: { type: 'boolean' },
  })
  const db = openDb()

  // A single posting by URL. Ashby unlisted reqs never appear on a board, so
  // this is the only way to pull one in.
  if (values.url?.length) {
    let n = 0
    for (const url of values.url) {
      const posting = await fetchAshbyPosting(url)
      if (!posting) {
        console.warn(`  could not read ${url} (unlisted and no embedded payload; add it by hand)`)
        continue
      }
      const r = upsertPostings(db, [posting])
      n += r.inserted + r.updated
      console.log(`  ${posting.company} / ${posting.role_title}`)
    }
    console.log(`${plural(n, 'posting')} from URLs`)
    return
  }

  let boards = listBoards(db)
  if (values.board) {
    const [ats, token] = values.board.split(':')
    if (!ats || !token) fail('usage: --board <ashby|greenhouse>:<token>')
    boards = boards.filter((b) => b.ats === ats && b.board_token === token)
    if (!boards.length) fail(`board ${values.board} is not in the boards table (add it: pnpm cli boards add ${ats} ${token})`)
  }
  if (!boards.length) fail('no active boards. run: pnpm cli boards seed')

  let inserted = 0
  let updated = 0
  let changed = 0
  let closed = 0
  const failures: string[] = []

  for (const board of boards) {
    try {
      const postings =
        board.ats === 'ashby'
          ? await fetchAshbyBoard(board.board_token)
          : await fetchGreenhouseBoard(board.board_token)

      const r = upsertPostings(db, postings)
      // Only a clean fetch may close postings; a failed one tells us nothing.
      const c = closeMissing(db, board.ats, board.board_token, postings.map((p) => p.job_id ?? ''))

      inserted += r.inserted
      updated += r.updated
      changed += r.changed
      closed += c

      if (!values.quiet) {
        console.log(
          `${board.ats}:${board.board_token}`.padEnd(28) +
            `${String(postings.length).padStart(3)} live  +${r.inserted} new  ~${r.changed} changed  -${c} closed`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failures.push(`${board.ats}:${board.board_token} ${msg}`)
      console.warn(`${board.ats}:${board.board_token}`.padEnd(28) + `failed: ${msg}`)
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  console.log(
    `\n${plural(inserted, 'new posting')}, ${updated} refreshed, ${changed} changed, ${closed} closed` +
      (failures.length ? `, ${plural(failures.length, 'board')} failed` : ''),
  )
  if (inserted || changed) console.log('next: pnpm cli filter')
}
