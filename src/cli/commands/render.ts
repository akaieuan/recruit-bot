import { readFileSync } from 'node:fs'
import { openDb } from '../../lib/db.ts'
import { getDraft, setDraftPdfPath } from '../../lib/drafts.ts'
import { getPosting } from '../../lib/postings.ts'
import { renderCoverLetter } from '../../lib/pdf/cover.ts'
import { args, fail } from '../util.ts'
import type { ContactVariant } from '../../lib/types.ts'

export async function run(argv: string[]): Promise<void> {
  const { values, positionals } = args(argv, {
    draft: { type: 'string' },
    file: { type: 'string' },
    company: { type: 'string' },
    role: { type: 'string' },
    variant: { type: 'string' },
    out: { type: 'string' },
  })
  if (positionals[0] !== 'pdf') fail('usage: pnpm cli render pdf --draft <id>')

  if (values.draft) {
    const db = openDb()
    const draft = getDraft(db, Number(values.draft))
    if (!draft) fail(`no draft with id ${values.draft}`)
    if (draft.kind !== 'cover_letter') fail(`draft ${draft.id} is an application answer, not a cover letter`)
    const posting = getPosting(db, draft.posting_id)
    if (!posting) fail(`draft ${draft.id} points at a posting that no longer exists`)

    const result = await renderCoverLetter(
      {
        company: posting.company,
        role: posting.role_title,
        body: draft.body,
        contactVariant: draft.contact_variant,
      },
      values.out,
    )
    setDraftPdfPath(db, draft.id, result.path)
    report(result)
    return
  }

  // Ad hoc render, for checking the format without going through the pipeline.
  if (values.file) {
    if (!values.company || !values.role) fail('--file also needs --company and --role')
    const result = await renderCoverLetter(
      {
        company: values.company,
        role: values.role,
        body: readFileSync(values.file, 'utf8'),
        contactVariant: (values.variant as ContactVariant | undefined) ?? 'design',
      },
      values.out,
    )
    report(result)
    return
  }

  fail('usage: pnpm cli render pdf --draft <id>   |   render pdf --file <txt> --company <c> --role <r>')
}

function report(r: Awaited<ReturnType<typeof renderCoverLetter>>): void {
  console.log(r.path)
  console.log(`${r.lineCount} lines across ${r.paragraphCount} paragraphs`)
  if (r.overflow) {
    console.log(`WARNING: runs ${r.overflowBy.toFixed(1)}pt past one page. Cut it before sending.`)
  }
}
