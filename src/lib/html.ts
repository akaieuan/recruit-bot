const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', bull: '•', middot: '·', trade: '™', reg: '®',
  copy: '©', deg: '°', euro: '€', pound: '£', eacute: 'é',
}

/** Greenhouse double-encodes: the content field is HTML inside HTML entities. */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return NAMED[body.toLowerCase()] ?? whole
  })
}

/**
 * HTML to readable plain text. Block elements become line breaks and list
 * items keep a bullet, because the scoring and drafting steps read this text
 * and JD structure carries meaning ("Requirements:" followed by a list).
 */
export function htmlToText(html: string): string {
  let s = html
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|div|h[1-6]|tr|section|article)>/gi, '\n\n')
  // The opening <li> supplies the line break, so closing it must not add a
  // second one or every list renders double-spaced.
  s = s.replace(/<li[^>]*>/gi, '\n- ')
  s = s.replace(/<\/li>/gi, '')
  s = s.replace(/<\/(ul|ol)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  s = s.replace(/ /g, ' ')
  s = s.replace(/[ \t]+/g, ' ')
  s = s.replace(/ *\n */g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}
