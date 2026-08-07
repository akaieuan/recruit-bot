/**
 * RFC4180 parser and writer. Written by hand rather than pulled in as a
 * dependency because the tracker CSV has quoted fields containing both commas
 * and newlines, which is exactly what a line-splitting shortcut gets wrong.
 */

export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  // Strip a UTF-8 BOM: it would otherwise become part of the first header.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input

  while (i < text.length) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }

    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }

  // A file not ending in a newline still has a final field to flush.
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/** Parses to objects keyed by the header row. */
export function parseCsvRecords(input: string): Record<string, string>[] {
  const rows = parseCsv(input)
  const header = rows[0]
  if (!header) return []
  return rows.slice(1).map((row) => {
    const rec: Record<string, string> = {}
    header.forEach((key, i) => {
      rec[key.trim()] = (row[i] ?? '').trim()
    })
    return rec
  })
}

export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(row.map((c) => csvEscape(c === null || c === undefined ? '' : String(c))).join(','))
  }
  return `${lines.join('\n')}\n`
}
