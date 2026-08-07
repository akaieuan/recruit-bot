import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'

/**
 * Cover letter geometry.
 *
 * Every number here was measured out of the reference letter's own content
 * stream rather than derived from a description of it, so output lands on the
 * same baselines as the letters already sent. pdf-lib places text by baseline
 * from the bottom-left, which is the coordinate space these values are in.
 */
export const PAGE = { width: 612, height: 792 } as const
export const MARGIN_X = 70.8
export const CONTENT_WIDTH = PAGE.width - MARGIN_X * 2 // 470.4

export const NAME = { size: 13.5, baselineY: 723.54, gray: 0.066667 } as const
export const CONTACT = { size: 8.6, baselineY: 712.44, gray: 0.333333 } as const
export const BODY = {
  size: 10,
  firstBaselineY: 687.04,
  leading: 13.28,
  /** Extra space between paragraphs, on top of the leading. */
  paragraphGap: 6.9056,
  gray: 0.101961,
} as const

/**
 * Lowest baseline that still sits on the page. The reference letter's closing
 * line sits at 87.3, so this leaves a little room without being generous
 * enough to let a letter creep onto a second page.
 */
export const BASELINE_FLOOR = 84

/** The letter is meant to read as one page of considered writing, not a wall. */
export const TARGET_LINES = { min: 30, max: 44 } as const

let cached: { regular: PDFFont; bold: PDFFont } | undefined

/**
 * Helvetica is a standard PDF font, so nothing is embedded and the metrics are
 * the same ones the reference letter was measured with.
 */
export async function loadFonts(): Promise<{ regular: PDFFont; bold: PDFFont }> {
  if (cached) return cached
  const doc = await PDFDocument.create()
  cached = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  }
  return cached
}

export interface LaidOutLine {
  text: string
  baselineY: number
  paragraph: number
}

export interface Measurement {
  lines: LaidOutLine[]
  lineCount: number
  paragraphCount: number
  lastBaselineY: number
  /** True when the text runs past the bottom of the page. */
  overflow: boolean
  overflowBy: number
}

/** Splits body text into paragraphs on blank lines. */
export function toParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

/**
 * How far a line may exceed the column and still be kept.
 *
 * The reference letter was typeset by ReportLab, which absorbs a slight
 * overrun by tightening word spacing rather than pushing the word to the next
 * line. Without a matching tolerance the wrap diverges from letters already
 * sent. At this size the overrun is under a point, against a 70.8pt margin, so
 * the line is drawn as-is instead of squeezed.
 */
export const FIT_TOLERANCE = 1

/**
 * Greedy wrap, the same algorithm the renderer uses. A single word wider than
 * the column is left long rather than broken, because hyphenating a URL is
 * worse than one line running wide.
 */
export function wrapParagraph(text: string, font: PDFFont, size: number, width = CONTENT_WIDTH): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width + FIT_TOLERANCE || !line) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Where every line lands. The renderer and the draft validator both call this,
 * so "does it fit on one page" is answered by the same code that draws it.
 */
export function measure(body: string, font: PDFFont): Measurement {
  const paragraphs = toParagraphs(body)
  const lines: LaidOutLine[] = []
  let y = BODY.firstBaselineY

  paragraphs.forEach((para, index) => {
    if (index > 0) y -= BODY.paragraphGap
    for (const text of wrapParagraph(para, font, BODY.size)) {
      lines.push({ text, baselineY: y, paragraph: index })
      y -= BODY.leading
    }
  })

  const lastBaselineY = lines.length ? (lines[lines.length - 1]?.baselineY ?? BODY.firstBaselineY) : BODY.firstBaselineY

  return {
    lines,
    lineCount: lines.length,
    paragraphCount: paragraphs.length,
    lastBaselineY,
    overflow: lastBaselineY < BASELINE_FLOOR,
    overflowBy: lastBaselineY < BASELINE_FLOOR ? BASELINE_FLOOR - lastBaselineY : 0,
  }
}

/** Contact line as it appears under the name. */
export function contactLine(links: string[], email: string, location = 'Brooklyn, NY'): string {
  return [location, email, ...links].join(' · ')
}
