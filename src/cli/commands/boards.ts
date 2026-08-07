import { openDb } from '../../lib/db.ts'
import { addBoard, discoverBoardsFromApplications, listBoards, SEED_BOARDS, setBoardActive } from '../../lib/boards.ts'
import { args, fail, plural, table } from '../util.ts'

export function run(argv: string[]): void {
  const { positionals } = args(argv, {})
  const sub = positionals[0]
  const db = openDb()

  if (sub === 'seed') {
    let added = 0
    for (const b of SEED_BOARDS) if (addBoard(db, b.ats, b.token)) added++
    const discovered = discoverBoardsFromApplications(db)
    console.log(`seeded ${plural(added, 'board')}, discovered ${plural(discovered, 'board')} from tracker URLs`)
    console.log(`${plural(listBoards(db).length, 'active board')} total`)
    return
  }

  if (sub === 'add') {
    const ats = positionals[1]
    const token = positionals[2]
    if (ats !== 'ashby' && ats !== 'greenhouse') fail('usage: pnpm cli boards add <ashby|greenhouse> <token>')
    if (!token) fail('usage: pnpm cli boards add <ashby|greenhouse> <token>')
    console.log(addBoard(db, ats, token, positionals[3]) ? `added ${ats}:${token}` : `${ats}:${token} already present`)
    return
  }

  if (sub === 'disable' || sub === 'enable') {
    const ats = positionals[1]
    const token = positionals[2]
    if (!ats || !token) fail(`usage: pnpm cli boards ${sub} <ats> <token>`)
    setBoardActive(db, ats, token, sub === 'enable')
    console.log(`${sub}d ${ats}:${token}`)
    return
  }

  if (sub === 'list' || sub === undefined) {
    const boards = listBoards(db, false)
    if (!boards.length) {
      console.log('no boards yet. run: pnpm cli boards seed')
      return
    }
    console.log(table([
      ['ATS', 'TOKEN', 'COMPANY', 'ACTIVE'],
      ...boards.map((b) => [b.ats, b.board_token, b.company ?? '', b.active ? 'yes' : 'no']),
    ]))
    return
  }

  fail('usage: pnpm cli boards <seed|add|list|enable|disable>')
}
