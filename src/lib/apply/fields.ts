import type { Profile } from './profile.ts'

/**
 * Maps a form field to a value.
 *
 * Ashby does not publish an application form schema, so its fields are read
 * from the live DOM at apply time; Greenhouse's come from ?questions=true.
 * Either way a field arrives as a label, a type, and a name, and this decides
 * what goes in it.
 *
 * Three outcomes, and the third is the important one:
 *   fill      a value from the profile or an approved draft
 *   skip      deliberately left blank (demographics, compensation)
 *   unresolved  no honest value available, hand it back to him
 *
 * There is no fourth outcome where a plausible value is invented.
 */

export interface DetectedField {
  /** DOM name/id, or the Greenhouse field key. */
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

export type Resolution =
  | { action: 'fill'; value: string | boolean; source: string; field: DetectedField }
  | { action: 'upload'; paths: string[]; source: string; field: DetectedField }
  | { action: 'skip'; reason: string; field: DetectedField }
  | { action: 'unresolved'; reason: string; field: DetectedField }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Never answered automatically. Demographic questions are the applicant's to
 * answer or decline, and a compensation number is a negotiating position, not
 * a data-entry task.
 */
const NEVER_FILL: { re: RegExp; reason: string; demographic?: boolean; comp?: boolean }[] = [
  { re: /\b(gender|pronouns?|races?|ethnicit\w*|veterans?|disabilit\w*|hispanic|latino|lgbtq?\w*|sexual orientation|self identif\w*|demographics?)\b/, reason: 'demographic question, optional, left blank', demographic: true },
  { re: /\b(salary|compensation|pay expectation|desired pay|expected pay|rate expectation)\b/, reason: 'no published band, so no midpoint to take', comp: true },
]

interface MapArgs {
  field: DetectedField
  profile: Profile
  /** Approved answer drafts, keyed by the question key they were written for. */
  answers?: Record<string, string>
  /** Absolute paths to the resume and generated cover letter. */
  files?: { resume?: string; cover?: string; portfolio?: string }
  /** Midpoint of the band this employer published, when there is one. */
  compMidpoint?: string | null
}

/**
 * How a value has to be written into a live form.
 *
 * React keeps its own copy of an input's value on `_valueTracker`. Writing
 * through the prototype setter without clearing that first leaves React
 * believing the field never changed, so the DOM shows the text and the form
 * submits empty. This cost a day of applications that looked filled and were
 * rejected as "Missing entry for required field".
 */
export const REACT_SAFE_SET = `
  var proto = /textarea/i.test(el.tagName)
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  var setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  if (el._valueTracker) el._valueTracker.setValue('~')
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
`

export function compBandMidpoint(min: number | null, max: number | null): string | null {
  if (!min || !max || max <= min) return null

  // A very wide band usually spans several levels, so its midpoint prices him
  // against the senior end of a ladder he is four years into. Tenex posted
  // $240-500k, where the midpoint is $370k; the answer that keeps the
  // conversation open is a range just above their floor. Never below it.
  const spread = max - min
  if (spread >= 150_000) {
    const round10 = (n: number) => Math.round(n / 10_000) * 10
    return `$${round10(min + spread * 0.04)},000 - $${round10(min + spread * 0.23)},000`
  }
  return `$${Math.round((min + max) / 2 / 1000)},000`
}

/**
 * What to ask for when the employer publishes nothing.
 *
 * Derived from the bands actually published for comparable NYC roles rather
 * than invented: `compFromComparables` takes the median midpoint of postings
 * with the same title shape. The caller supplies those comparables, so the
 * number traces to real postings and moves as the market does.
 *
 * A market estimate is not a fact about him. It is a number he can overrule,
 * which is why it never enters the fact library.
 */
export function compFromComparables(
  roleTitle: string,
  comparables: { role_title: string; comp_min: number | null; comp_max: number | null }[],
): { value: string; basis: string } {
  const shape = (t: string) =>
    /forward.?deployed|\bfde\b|solutions engineer|applied ai|\bai engineer\b|agent engineer/i.test(t) ? 'fde'
      : /design engineer|product engineer|design technologist|founding designer/i.test(t) ? 'design-eng'
        : /product designer/i.test(t) ? 'product-design'
          : 'other'

  const want = shape(roleTitle)
  // "other" is not a comparable set, it is everything left over. A title that
  // does not match a known shape falls back to his own band rather than to the
  // median of four hundred unrelated postings.
  if (want === 'other') return { value: '$200,000', basis: 'no comparable title shape; midpoint of his own band' }

  const mids = comparables
    .filter((c) => c.comp_min && c.comp_max && shape(c.role_title) === want)
    .map((c) => (c.comp_min! + c.comp_max!) / 2)
    // Frontier labs and consultancies post bands two to three times a seed
    // startup's for the same title. Including them prices him out of the
    // companies he is actually targeting.
    .filter((m) => m >= 140_000 && m <= 280_000)
    .sort((a, b) => a - b)

  if (!mids.length) return { value: '$200,000', basis: 'no comparable band published; midpoint of his own band' }

  const median = mids[Math.floor(mids.length / 2)]!
  // Seniority in the title moves it off the median of the whole set.
  const t = roleTitle.toLowerCase()
  const bump = /\bstaff\b|\bprincipal\b/.test(t) ? 1.12 : /\bsenior\b|\bsr\.?\b|\blead\b/.test(t) ? 1.05 : 1
  const value = Math.max(150, Math.min(280, Math.round((median * bump) / 1000 / 5) * 5))
  return { value: `$${value},000`, basis: `median of ${mids.length} comparable NYC bands` }
}

export function resolveField({ field, profile, answers = {}, files = {}, compMidpoint = null }: MapArgs): Resolution {
  const label = norm(field.label || field.name)
  const name = norm(field.name)
  const hay = `${label} ${name}`

  for (const rule of NEVER_FILL) {
    if (!rule.re.test(hay)) continue
    // Demographic questions are voluntary by design, so an optional one stays
    // blank. A form that insists gets the answer he supplied, rather than
    // leaving him unable to submit.
    if (rule.demographic && field.required === true) {
      const value = demographicAnswer(hay, profile)
      if (value !== null) return coerce(value, field, 'his stated answer, required by this form')
    }
    // The midpoint of a published band. Never the bottom, which anchors low,
    // and never the top, which prices him out of the conversation.
    if (rule.comp) {
      if (compMidpoint !== null) {
        return { action: 'fill', value: compMidpoint, source: 'midpoint of the posted band', field }
      }
      return { action: 'skip', reason: rule.reason, field }
    }
    return { action: 'skip', reason: rule.reason, field }
  }

  // An approved draft answer, matched on the exact question key, wins over
  // everything: it is the text a human reviewed for this specific question.
  const drafted = answers[field.name]
  if (drafted) return { action: 'fill', value: drafted, source: 'approved draft answer', field }

  if (field.type === 'file' || /\b(resume|cv|cover letter|attachment|upload)\b/.test(hay)) {
    if (/cover/.test(hay)) {
      return files.cover
        ? { action: 'upload', paths: [files.cover], source: 'generated cover letter', field }
        : { action: 'unresolved', reason: 'cover letter PDF has not been rendered', field }
    }
    if (/portfolio/.test(hay) && files.portfolio) {
      return { action: 'upload', paths: [files.portfolio], source: 'portfolio PDF', field }
    }
    return files.resume
      ? { action: 'upload', paths: [files.resume], source: 'resume PDF', field }
      : { action: 'unresolved', reason: 'resume PDF not found', field }
  }

  // Ordered: a question's intent is matched before any generic location word
  // it happens to contain. "Are you authorized to work in the country (US/CAN)"
  // contains "country", and a generic rule reaching it first put a country
  // name into a Yes/No dropdown.
  const direct: [RegExp, string | boolean | null][] = [
    [/\bhow did you hear\b|\bhow did you find\b|\bsource\b/, profile.heard_about_us ?? null],
    [/\bcurrent (company|employer)\b|\bpresent employer\b|\bwhere do you work\b/, profile.current_company ?? null],
    [/\b(legally|lawfully)?\s*(authori[sz]ed|eligible) to work\b|\bwork authori[sz]ation\b|\bright to work\b/, profile.work_authorized],
    [/\bsponsorship\b|\bvisa\b/, profile.requires_sponsorship],
    [/\b18 years\b|\bat least 18\b|\bage of 18\b/, profile.over_18],
    [/\b(come|coming|commute|work) (in)?to the .*office\b|\bdays a week\b|\bon ?site\b|\bin ?person\b|\bhybrid\b/, profile.willing_onsite],
    [/\brelocat\w*\b|\bwilling to move\b/, profile.willing_to_relocate ?? null],
    [/\bfirst name\b|\bgiven name\b|^first$/, profile.first_name],
    [/\blast name\b|\bsurname\b|\bfamily name\b|^last$/, profile.last_name],
    [/\bfull name\b|^name$/, profile.full_name],
    [/\be ?mail\b/, profile.email],
    [/\bphone\b|\bmobile\b|\btelephone\b/, profile.phone],
    [/\blinkedin\b/, profile.linkedin],
    [/\bgithub\b/, profile.github],
    [/\bportfolio\b|\bwork sample\b|\bdribbble\b|\bbehance\b/, profile.portfolio],
    [/\b(personal )?(website|url|link)\b/, profile.website],
    [/\bcity\b/, profile.city],
    [/\bstate\b|\bprovince\b|\bregion\b/, profile.state],
    [/\bcountry\b/, profile.country],
    [/\b(current )?location\b|\bwhere are you based\b|\bbased in\b|\bmetro\b|\baddress\b/, profile.location],
  ]

  for (const [re, value] of direct) {
    if (!re.test(hay)) continue
    if (value === null || value === undefined || value === '') {
      return { action: 'unresolved', reason: `no value for "${field.label}" in data/profile.json`, field }
    }
    return coerce(value, field, 'profile')
  }

  // A free-text prompt with no drafted answer. Draft it before applying rather
  // than typing something in the moment.
  if (/textarea|long_text/.test(field.type) || field.label.includes('?')) {
    return {
      action: 'unresolved',
      reason: 'free-text question with no approved answer. Run /draft for this posting first.',
      field,
    }
  }

  return { action: 'unresolved', reason: 'no rule matches this field', field }
}

/**
 * A field with a fixed option list can only ever receive one of those options.
 * Writing free text into a Yes/No dropdown is how "authorized to work in the
 * country (US/CAN/UK)" ended up answered "United States". If the value does
 * not map onto an option, that is a gap, not something to force.
 */
function coerce(value: string | boolean, field: DetectedField, source: string): Resolution {
  const options = field.options
  if (!options?.length) {
    // A yes/no question asked as a text box wants a word, not "false".
    return { action: 'fill', value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value, source, field }
  }

  const wanted =
    typeof value === 'boolean'
      ? value
        ? ['yes', 'true']
        : ['no', 'false']
      : [String(value).toLowerCase()]

  const match = options.find((o) => wanted.includes(o.toLowerCase().trim()))
  if (match) return { action: 'fill', value: match, source, field }

  return {
    action: 'unresolved',
    reason: `"${String(value)}" is not one of the allowed options (${options.slice(0, 4).join(', ')})`,
    field,
  }
}

function demographicAnswer(hay: string, profile: Profile): string | boolean | null {
  const d = profile.demographics
  if (!d) return null
  if (/pronoun/.test(hay)) return d.pronouns ?? null
  if (/hispanic|latino/.test(hay)) return d.hispanic_latino ?? null
  if (/veteran/.test(hay)) return d.veteran_status ?? null
  if (/disabilit/.test(hay)) return d.disability_status ?? null
  if (/race|ethnicit/.test(hay)) return d.race ?? null
  if (/gender|\bsex\b/.test(hay)) return d.gender ?? null
  return null
}

export function summarize(resolutions: Resolution[]) {
  return {
    fill: resolutions.filter((r) => r.action === 'fill'),
    upload: resolutions.filter((r) => r.action === 'upload'),
    skip: resolutions.filter((r) => r.action === 'skip'),
    unresolved: resolutions.filter((r) => r.action === 'unresolved'),
  }
}

/** An application is only ready when nothing required is unresolved. */
export function blockers(resolutions: Resolution[]): Resolution[] {
  return resolutions.filter((r) => r.action === 'unresolved' && r.field.required !== false)
}
