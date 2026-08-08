import { check, describe, eq } from './harness.ts'
import { buildAshbyPayload, buildGreenhousePayload } from '../apply/payload.ts'
import type { ApplicationPlan } from '../apply/plan.ts'
import type { DetectedField, Resolution } from '../apply/fields.ts'
import type { Profile } from '../apply/profile.ts'
import type { Posting } from '../types.ts'

const PROFILE: Profile = {
  first_name: 'Ieuan', last_name: 'King', full_name: 'Ieuan King',
  email: 'Ieuan@yionvisual.com', phone: null,
  location: 'Brooklyn, NY', city: 'Brooklyn', state: 'NY', country: 'United States',
  linkedin: 'https://linkedin.com/in/ieuan-king', github: 'https://github.com/akaieuan',
  portfolio: 'https://akabuild.dev', website: 'https://akaoss.dev',
  work_authorized: true, requires_sponsorship: false, work_authorization_note: 'U.S. citizen.',
  over_18: true, willing_onsite: true,
  resume_path: 'data/resume.pdf', portfolio_path: null, notes: [], confirm: [],
}

const POSTING = {
  id: 1, ats: 'ashby', board_token: 'oneill', job_id: 'abc', url: 'https://jobs.ashbyhq.com/oneill/abc',
  company: `O'Neill & "Sons"`, role_title: 'Design Engineer', location: 'New York, NY',
  remote_policy: 'onsite', comp_min: null, comp_max: null, years_min: null, years_max: null,
  description_html: null, description_text: null, content_hash: null,
  first_seen: '2026-08-01', last_seen: '2026-08-07', closed_at: null,
  stage: 'approved', stage_reason: null, comp_flag: 0, years_flag: null,
} as Posting

const field = (label: string, type = 'input_text', extra: Partial<DetectedField> = {}): DetectedField => ({
  name: label.toLowerCase().replace(/\W+/g, '_'), label, type, ...extra,
})

function plan(resolutions: Resolution[], over: Partial<ApplicationPlan> = {}): ApplicationPlan {
  return {
    posting: POSTING,
    applyUrl: 'https://jobs.ashbyhq.com/oneill/abc/application',
    profile: PROFILE,
    files: { resume: '/outside/Ieuan King - Resume 2026.pdf' },
    answers: {},
    knownFields: resolutions.map((r) => r.field),
    resolutions,
    gaps: [],
    ready: true,
    ...over,
  }
}

const OPTS = {
  resumeUrl: 'http://localhost:3000/covers/resume.pdf',
  coverUrl: 'http://localhost:3000/covers/Ieuan%20King%20-%20Acme.pdf',
  // Attaching is opt-in. These tests cover the path that asks for it.
  attachFiles: true,
}

/** The embedded data, read back out of the generated script. */
function spec(js: string) {
  const match = js.match(/var SPEC = (.+);/)
  if (!match?.[1]) throw new Error('no SPEC in the generated payload')
  return JSON.parse(match[1]) as {
    fills: { label: string; value: string }[]
    uploads: { label: string; slot: string; url: string; filename: string }[]
    skipped: { label: string; reason: string }[]
    unresolved: { label: string; reason: string }[]
  }
}

await describe('payload: embeds values instead of interpolating them', () => {
  const built = buildGreenhousePayload(
    plan([
      { action: 'fill', value: `O'Neill & "Sons"`, source: 'profile', field: field('Company') },
      { action: 'fill', value: 'A line.\nAnd </script> a break.', source: 'approved draft answer', field: field('Why here?', 'textarea') },
    ]),
    OPTS,
  )

  // The one failure that would take the whole form down: a name with quotes in
  // it breaking out of the string it was embedded in.
  let constructed = true
  try {
    new Function(built.js)
  } catch {
    constructed = false
  }
  check('the generated script parses', constructed)

  const s = spec(built.js)
  eq('the apostrophes and quotes survive', s.fills[0]?.value, `O'Neill & "Sons"`)
  eq('so do newlines in a drafted answer', s.fills[1]?.value, 'A line.\nAnd </script> a break.')
  check('and the closing tag is escaped in the source', !built.js.includes('</script>'))
})

await describe('payload: fills only what the plan resolved', () => {
  const built = buildGreenhousePayload(
    plan([
      { action: 'fill', value: 'Ieuan King', source: 'profile', field: field('Full Name') },
      { action: 'fill', value: 'Ieuan@yionvisual.com', source: 'profile', field: field('Email') },
      { action: 'unresolved', reason: 'no value for "Phone" in data/profile.json', field: field('Phone') },
    ]),
    OPTS,
  )

  eq('two fills', built.fills, 2)
  const s = spec(built.js)
  eq('and nothing else', s.fills.length, 2)
  check('the unresolved phone is reported', s.unresolved.some((u) => u.label === 'Phone'))
  check('and warned about', built.warnings.some((w) => w.includes('Phone')))
  check('but never filled', !s.fills.some((f) => f.label === 'Phone'))
})

await describe('payload: a null profile value is never invented', () => {
  // Ashby publishes no schema, so the standard fields come from the profile.
  // The profile has no phone, and the payload leaves the box empty.
  const built = buildAshbyPayload(plan([]), OPTS)
  const s = spec(built.js)

  check('name is filled', s.fills.some((f) => f.label === 'Name' && f.value === 'Ieuan King'))
  check('email is filled', s.fills.some((f) => f.label === 'Email'))
  check('linkedin is filled', s.fills.some((f) => f.label === 'LinkedIn'))
  check('phone is not', !s.fills.some((f) => f.label === 'Phone'))
  check('phone is reported unresolved', s.unresolved.some((u) => u.label === 'Phone'))
  check('and warned about', built.warnings.some((w) => w.includes('Phone') && w.includes('profile.json')))
})

await describe('payload: attaches the files it was given a URL for', () => {
  const built = buildAshbyPayload(plan([]), OPTS)

  check('the resume URL is in the script', built.js.includes(OPTS.resumeUrl))
  eq('resume and cover letter', built.uploads, 2)

  const s = spec(built.js)
  const resume = s.uploads.find((u) => u.slot === 'resume')
  eq('the resume keeps his filename', resume?.filename, 'Ieuan King - Resume 2026.pdf')
  eq('the cover letter name is decoded from the URL', s.uploads.find((u) => u.slot === 'cover')?.filename, 'Ieuan King - Acme.pdf')

  // A file input only takes a FileList, which only DataTransfer can build.
  check('fetches the bytes', built.js.includes('await fetch(spec.url)'))
  check('builds a File', built.js.includes('new File([blob], spec.filename'))
  check('through DataTransfer', built.js.includes('new DataTransfer()') && built.js.includes('dt.items.add(file)'))
  check('and assigns the FileList', built.js.includes('input.files = dt.files'))

  // Ashby's first file input parses a resume rather than attaching it.
  check('skips the autofill box', built.js.includes('autofill'))
})

await describe('payload: a missing cover URL is reported, not improvised', () => {
  const built = buildGreenhousePayload(
    plan([{ action: 'upload', paths: ['/outside/cover.pdf'], source: 'generated cover letter', field: field('Cover Letter', 'file') }]),
    { resumeUrl: OPTS.resumeUrl, attachFiles: true },
  )

  eq('nothing is uploaded', built.uploads, 0)
  check('the cover letter is reported unresolved', spec(built.js).unresolved.some((u) => u.label === 'Cover Letter'))
  check('and stays his click', built.warnings.some((w) => w.includes('cover')))
})

await describe('payload: skipped questions stay his', () => {
  const built = buildGreenhousePayload(
    plan([
      { action: 'fill', value: 'Ieuan King', source: 'profile', field: field('Full Name') },
      { action: 'skip', reason: 'compensation is his call, never auto-filled', field: field('Desired salary') },
      { action: 'skip', reason: 'demographic question, optional, left blank', field: field('Gender') },
    ]),
    OPTS,
  )

  const s = spec(built.js)
  eq('one fill', built.fills, 1)
  check('salary is not filled', !s.fills.some((f) => f.label === 'Desired salary'))
  check('gender is not filled', !s.fills.some((f) => f.label === 'Gender'))
  check('salary is reported skipped', s.skipped.some((k) => k.label === 'Desired salary' && k.reason.includes('his call')))
  check('gender is reported skipped', s.skipped.some((k) => k.label === 'Gender'))
})

await describe('payload: option lists and submit', () => {
  const built = buildGreenhousePayload(
    plan([
      {
        action: 'fill',
        value: 'Yes',
        source: 'profile',
        field: field('Are you legally authorized to work in the US?', 'multi_value_single_select', { options: ['Yes', 'No'] }),
      },
    ]),
    OPTS,
  )

  // A select is answered by matching the option's own text, and a value that
  // is not on the list is left alone rather than forced onto it.
  check('reads the option list', built.js.includes('list(el.options)'))
  check('matches on the option text', built.js.includes('norm(options[i].textContent) === want'))
  check('dispatches change', built.js.includes("new Event('change', { bubbles: true })"))
  check('and gives up rather than forcing a value', built.js.includes('if (!match) return false'))

  // The rule the whole tool is built around.
  check('nothing is ever submitted', !/\.click\(\)/.test(built.js.replace('b.click();', '')))
  check('and reCAPTCHA is never touched', !/recaptcha/i.test(built.js.replace('reCAPTCHA: the last action on an application is his, per application.', '')))
})

await describe('payload: reports asynchronously', () => {
  const built = buildAshbyPayload(plan([]), OPTS)
  check('returns synchronously', built.js.includes("return 'started'"))
  check('stashes the report', built.js.includes('window.__recruitbot = report'))
  check('clears a stale one first', built.js.includes('window.__recruitbot = null'))
  check('and truncates what it reports', built.js.includes('s.slice(0, 80)'))
})

await describe('payload: files are left alone by default', () => {
  // The default has to be the safe one. Fetching a file into a form from
  // script is what reads as automation to an ATS, and the account it would
  // cost is his, so a caller that forgets the flag attaches nothing.
  const built = buildAshbyPayload(plan([]), { resumeUrl: OPTS.resumeUrl, coverUrl: OPTS.coverUrl })
  eq('no uploads are encoded', built.uploads, 0)
  check('and the script carries no fetch of the resume', !built.js.includes('covers/resume.pdf'))
  check('the fields are still filled', built.fills > 0)
  check(
    'and it says the uploads are his',
    built.warnings.some((w) => w.includes('upload the resume')),
  )
})
