import { check, describe, eq } from './harness.ts'
import { resolveField, blockers, type DetectedField } from '../apply/fields.ts'
import type { Profile } from '../apply/profile.ts'

const PROFILE: Profile = {
  first_name: 'Ieuan', last_name: 'King', full_name: 'Ieuan King',
  email: 'Ieuan@yionvisual.com', phone: null,
  location: 'Brooklyn, NY', city: 'Brooklyn', state: 'NY', country: 'United States',
  linkedin: 'https://linkedin.com/in/ieuan-king', github: 'https://github.com/akaieuan',
  portfolio: 'https://akabuild.dev', website: 'https://akaoss.dev',
  work_authorized: true, requires_sponsorship: false, work_authorization_note: 'U.S. citizen.',
  over_18: true, willing_onsite: true,
  demographics: {
    pronouns: 'he/him/his', gender: 'Male', race: 'White', hispanic_latino: false,
    veteran_status: 'I am not a protected veteran', disability_status: 'No, I do not have a disability',
  },
  resume_path: 'data/resume.pdf', portfolio_path: null, notes: [], confirm: [],
}

const f = (label: string, type = 'input_text', extra: Partial<DetectedField> = {}): DetectedField => ({
  name: label.toLowerCase().replace(/\W+/g, '_'), label, type, ...extra,
})

const r = (field: DetectedField, over: Parameters<typeof resolveField>[0] extends never ? never : Partial<Parameters<typeof resolveField>[0]> = {}) =>
  resolveField({ field, profile: PROFILE, files: { resume: '/abs/resume.pdf', cover: '/abs/cover.pdf' }, ...over })

await describe('apply: fills from the profile', () => {
  eq('first name', (r(f('First Name')) as { value: string }).value, 'Ieuan')
  eq('last name', (r(f('Last Name')) as { value: string }).value, 'King')
  eq('email', (r(f('Email')) as { value: string }).value, 'Ieuan@yionvisual.com')
  eq('linkedin', (r(f('LinkedIn Profile')) as { value: string }).value, 'https://linkedin.com/in/ieuan-king')
  eq('location', (r(f('What is your current location?')) as { value: string }).value, 'Brooklyn, NY')
  // A yes/no question asked as a plain text box wants a word, not "false".
  eq('work authorized', (r(f('Are you legally authorized to work in the US?')) as { value: string }).value, 'Yes')
  eq('sponsorship', (r(f('Will you require visa sponsorship?')) as { value: string }).value, 'No')
})

await describe('apply: never invents a missing value', () => {
  // The profile has no phone. The only honest outcome is to hand it back.
  const phone = r(f('Phone'))
  eq('a missing phone is unresolved', phone.action, 'unresolved')
  check('and says where to set it', (phone as { reason: string }).reason.includes('profile.json'))

  const unknown = r(f('What is your favourite HVAC brand?', 'input_text'))
  eq('an unrecognised field is unresolved', unknown.action, 'unresolved')
})

await describe('apply: never answers for him', () => {
  for (const label of [
    'What are your pronouns?',
    'Gender',
    'Race / Ethnicity',
    'Are you a protected veteran?',
    'Voluntary Self-Identification of Disability',
  ]) {
    eq(`skips "${label}"`, r(f(label)).action, 'skip')
  }

  // Compensation is a negotiating position, not a form field to autofill.
  const comp = r(f('What is your target compensation range?'))
  eq('skips compensation', comp.action, 'skip')
  check('and says why', (comp as { reason: string }).reason.includes('his call'))

  eq('skips referral source', r(f('How did you hear about this job?')).action, 'skip')
})

await describe('apply: demographics only when the form insists', () => {
  // Voluntary by design, so an optional one stays blank even though the
  // answer is on file.
  for (const label of ['What are your pronouns?', 'Gender', 'Race / Ethnicity']) {
    eq(`optional "${label}" stays blank`, r(f(label, 'input_text', { required: false })).action, 'skip')
    eq(`unspecified "${label}" stays blank`, r(f(label)).action, 'skip')
  }

  // A form that will not submit without one gets the answer he gave.
  eq('required pronouns', (r(f('What are your pronouns?', 'input_text', { required: true })) as { value: string }).value, 'he/him/his')
  eq('required gender', (r(f('Gender', 'input_text', { required: true })) as { value: string }).value, 'Male')
  eq('required race', (r(f('Race / Ethnicity', 'input_text', { required: true })) as { value: string }).value, 'White')
  eq(
    'required veteran status',
    (r(f('Are you a protected veteran?', 'input_text', { required: true })) as { value: string }).value,
    'I am not a protected veteran',
  )
  eq(
    'required disability status',
    (r(f('Voluntary Self-Identification of Disability', 'input_text', { required: true })) as { value: string }).value,
    'No, I do not have a disability',
  )
  eq(
    'required hispanic/latino maps to the option list',
    (r(f('Are you Hispanic or Latino?', 'multi_value_single_select', { required: true, options: ['Yes', 'No'] })) as { value: string }).value,
    'No',
  )
})

await describe('apply: option-constrained fields', () => {
  const yesNo = (label: string) => f(label, 'multi_value_single_select', { options: ['Yes', 'No'] })

  // The bug this exists for: the label contains the word "country", so a
  // generic location rule reaching it first answered a Yes/No dropdown with
  // "United States".
  const auth = r(yesNo('Are you lawfully authorized to work in the country (US/CAN/UK) where the role is based?'))
  eq('work authorization resolves to an option', (auth as { value: string }).value, 'Yes')

  eq('sponsorship maps to No', (r(yesNo('Will you require sponsorship in the future?')) as { value: string }).value, 'No')
  eq('age maps to Yes', (r(yesNo('Are you 18 years of age or older?')) as { value: string }).value, 'Yes')
  eq('onsite maps to Yes', (r(yesNo('This role requires coming into the NYC office 4 days a week, is this suitable?')) as { value: string }).value, 'Yes')

  // Free text can never be forced into a fixed option list.
  const mismatch = r(f('Country', 'multi_value_single_select', { options: ['Canada', 'Mexico'] }))
  eq('a value outside the options is unresolved', mismatch.action, 'unresolved')
  check('and names the options', (mismatch as { reason: string }).reason.includes('Canada'))
})

await describe('apply: files', () => {
  const resume = r(f('Resume/CV', 'file'))
  eq('uploads the resume', resume.action, 'upload')
  eq('the right file', (resume as { paths: string[] }).paths, ['/abs/resume.pdf'])

  const cover = r(f('Cover Letter', 'file'))
  eq('uploads the cover letter', (cover as { paths: string[] }).paths, ['/abs/cover.pdf'])

  // No rendered cover letter means the application is not ready.
  const missing = resolveField({ field: f('Cover Letter', 'file'), profile: PROFILE, files: { resume: '/abs/resume.pdf' } })
  eq('a missing cover letter blocks', missing.action, 'unresolved')
})

await describe('apply: approved answers win', () => {
  const field = f('Why do you want to work here?', 'textarea')
  const withAnswer = resolveField({
    field, profile: PROFILE, files: {},
    answers: { [field.name]: 'Because the review surface is the product.' },
  })
  eq('uses the approved draft', (withAnswer as { value: string }).value, 'Because the review surface is the product.')
  eq('and says where it came from', (withAnswer as { source: string }).source, 'approved draft answer')

  // Without one, it is not something to improvise at the form.
  const without = r(field)
  eq('an undrafted essay is unresolved', without.action, 'unresolved')
  check('and points at /draft', (without as { reason: string }).reason.includes('/draft'))
})

await describe('apply: readiness', () => {
  const fields = [f('First Name'), f('Phone', 'input_text', { required: true })]
  const res = fields.map((field) => r(field))
  eq('a required unresolved field blocks', blockers(res).length, 1)

  const optional = [f('First Name'), f('Phone', 'input_text', { required: false })]
  eq('an optional one does not', blockers(optional.map((field) => r(field))).length, 0)
})
