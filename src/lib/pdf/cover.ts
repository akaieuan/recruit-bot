import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { PATHS } from '../paths.ts'
import { readConfig } from '../facts.ts'
import {
  BASELINE_FLOOR, BODY, CONTACT, CONTENT_WIDTH, MARGIN_X, NAME, PAGE,
  contactLine, measure, wrapParagraph,
} from './layout.ts'
import type { ContactVariant } from '../types.ts'

export interface CoverLetterInput {
  company: string
  role: string
  body: string
  contactVariant?: ContactVariant
}

export interface RenderResult {
  path: string
  lineCount: number
  paragraphCount: number
  overflow: boolean
  overflowBy: number
}

/** "Ieuan King - Credal - Founding Design Engineer.pdf" */
export function coverFileName(company: string, role: string, name = 'Ieuan King'): string {
  const clean = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
  return `${clean(name)} - ${clean(company)} - ${clean(role)}.pdf`
}

export async function renderCoverLetter(input: CoverLetterInput, outPath?: string): Promise<RenderResult> {
  const config = readConfig()
  const variant = input.contactVariant ?? 'design'
  const links = config.links[variant] ?? config.links.design

  const doc = await PDFDocument.create()
  doc.setTitle(`${config.name} cover letter ${input.company}`)
  doc.setAuthor(config.name)
  doc.setCreator('recruit-bot')

  const page = doc.addPage([PAGE.width, PAGE.height])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  page.drawText(config.name, {
    x: MARGIN_X,
    y: NAME.baselineY,
    size: NAME.size,
    font: bold,
    color: rgb(NAME.gray, NAME.gray, NAME.gray),
  })

  page.drawText(contactLine(links, config.email, config.location), {
    x: MARGIN_X,
    y: CONTACT.baselineY,
    size: CONTACT.size,
    font: regular,
    color: rgb(CONTACT.gray, CONTACT.gray, CONTACT.gray),
  })

  // measure() is what the draft validator uses to decide whether a letter fits
  // on one page, so drawing from its output means the check and the render can
  // never disagree.
  const m = measure(input.body, regular)
  for (const line of m.lines) {
    page.drawText(line.text, {
      x: MARGIN_X,
      y: line.baselineY,
      size: BODY.size,
      font: regular,
      color: rgb(BODY.gray, BODY.gray, BODY.gray),
    })
  }

  // The shared cover folder is uploadable by the browser; data/out is not.
  const outDir = config.uploads?.covers_dir && existsSync(config.uploads.covers_dir)
    ? config.uploads.covers_dir
    : PATHS.outCovers
  const path = outPath ?? join(outDir, coverFileName(input.company, input.role, config.name))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, await doc.save())

  return {
    path,
    lineCount: m.lineCount,
    paragraphCount: m.paragraphCount,
    overflow: m.overflow,
    overflowBy: m.overflowBy,
  }
}

export { BASELINE_FLOOR, CONTENT_WIDTH, wrapParagraph }
