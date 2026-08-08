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
const NEVER_FILL: { re: RegExp; reason: string; demographic?: boolean }[] = [
  { re: /\b(gender|pronouns?|races?|ethnicit\w*|veterans?|disabilit\w*|hispanic|latino|lgbtq?\w*|sexual orientation|self identif\w*|demographics?)\b/, reason: 'demographic question, optional, left blank', demographic: true },
  { re: /\b(salary|compensation|pay expectation|desired pay|expected pay|rate expectation)\b/, reason: 'compensation is his call, never auto-filled' },
  { re: /\b(how did you hear|referr?al|referred by)\b/, reason: 'source attribution, needs his answer' },
]

interface MapArgs {
  field: DetectedField
  profile: Profile
  /** Approved answer drafts, keyed by the question key they were written for. */
  answers?: Record<string, string>
  /** Absolute paths to the resume and generated cover letter. */
  files?: { resume?: string; cover?: string; portfolio?: string }
}

export function resolveField({ field, profile, answers = {}, files = {} }: MapArgs): Resolution {
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
    [/\b(legally|lawfully)?\s*(authori[sz]ed|eligible) to work\b|\bwork authori[sz]ation\b/, profile.work_authorized],
    [/\bsponsorship\b|\bvisa\b/, profile.requires_sponsorship],
    [/\b18 years\b|\bat least 18\b|\bage of 18\b/, profile.over_18],
    [/\b(come|coming|commute|work) (in)?to the .*office\b|\bdays a week\b|\bon ?site\b|\bin ?person\b|\bhybrid\b/, profile.willing_onsite],
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
