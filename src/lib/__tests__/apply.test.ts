import { check, describe, eq } from './harness.ts'
import { compBandMidpoint, compFromComparables, resolveField, blockers, type DetectedField } from '../apply/fields.ts'
import type { Profile } from '../apply/profile.ts'
import { priorFor } from '../already.ts'
import { normalizeCompany, normalizeRole } from '../dedupe.ts'

const PROFILE: Profile = {
  first_name: 'Ieuan', last_name: 'King', full_name: 'Ieuan King',
  email: 'Ieuan@yionvisual.com', phone: null,
  location: 'Brooklyn, NY', city: 'Brooklyn', state: 'NY', country: 'United States',
  linkedin: 'https://linkedin.com/in/ieuan-king', github: 'https://github.com/akaieuan',
  portfolio: 'https://akabuild.dev', website: 'https://akaoss.dev',
  work_authorized: true, requires_sponsorship: false, work_authorization_note: 'U.S. citizen.',
  over_18: true, willing_onsite: true, heard_about_us: 'LinkedIn', current_company: 'Independent',
  citizenships: ['United States', 'United Kingdom'], willing_to_relocate: true,
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



  // He gave a standing answer, so this stopped being a gap handed back to him.
  eq('referral source uses his standing answer', (r(f('How did you hear about this job?')) as { value: string }).value, 'LinkedIn')
  eq('current company is always Independent', (r(f('Current Company')) as { value: string }).value, 'Independent')
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

await describe('apply: compensation takes the midpoint of the posted band', () => {
  // Never the bottom, which anchors low. Never the top, which prices him out
  // of a conversation he wants to have.
  eq('162 to 209 gives 186', compBandMidpoint(162000, 209000), '$186,000')
  eq('180 to 230 gives 205', compBandMidpoint(180000, 230000), '$205,000')
  eq('no band gives nothing', compBandMidpoint(null, null), null)

  // A 260k-wide band spans several levels. Its midpoint would ask $370,000,
  // which prices him against the senior end rather than his own.
  eq('a wide band gives a range above their floor', compBandMidpoint(240_000, 500_000), '$250,000 - $300,000')
  check('and never below their floor', !compBandMidpoint(240_000, 500_000)!.includes('$240,000 -'))
  eq('one side only gives nothing', compBandMidpoint(180000, null), null)

  // No band published: the median midpoint of comparable NYC postings that
  // did publish, so the number traces to real bands rather than a guess.
  const market = [
    { role_title: 'Forward Deployed Engineer', comp_min: 120000, comp_max: 200000 },
    { role_title: 'Solutions Engineer', comp_min: 125000, comp_max: 250000 },
    { role_title: 'Applied AI Engineer', comp_min: 175000, comp_max: 250000 },
    { role_title: 'Software Engineer, Applied AI', comp_min: 200000, comp_max: 300000 },
    { role_title: 'Senior Product Designer', comp_min: 130000, comp_max: 170000 },
  ]
  eq('fde takes the fde median', compFromComparables('Solutions Engineer, AI', market).value, '$215,000')
  check('and says what it is based on', compFromComparables('Solutions Engineer, AI', market).basis.includes('comparable'))
  eq('a product design title takes its own set', compFromComparables('Product Designer', market).value, '$150,000')

  // A frontier-lab band is not a comparable for a seed startup role.
  const withOutlier = market.concat([{ role_title: 'Forward Deployed Engineer', comp_min: 320000, comp_max: 500000 }])
  eq('an outlier band is excluded', compFromComparables('Solutions Engineer, AI', withOutlier).value, '$215,000')
  // An unrecognised title shape falls back rather than averaging everything.
  eq('unknown shape falls back', compFromComparables('Chief Vibes Officer', market).value, '$200,000')
  eq('senior lifts it', compFromComparables('Senior Applied AI Engineer', market).value, '$225,000')

  const withBand = resolveField({
    field: f('What are your compensation expectations?'), profile: PROFILE, files: {},
    compMidpoint: compBandMidpoint(162000, 209000),
  })
  eq('the form gets the midpoint', (withBand as { value: string }).value, '$186,000')
  eq('and says where it came from', (withBand as { source: string }).source, 'midpoint of the posted band')
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

await describe('apply: relocation and work authorisation', () => {
  const yesNo = (label: string) => f(label, 'multi_value_single_select', { options: ['Yes', 'No'] })

  // Mutiny's actual question, which no rule matched before.
  eq(
    'relocation question',
    (r(yesNo('Are you currently based in the New York City area, or are you willing to relocate here prior to starting this role?')) as { value: string }).value,
    'Yes',
  )
  // Dual citizenship: authorised in both, sponsorship needed in neither.
  eq('authorised in the US', (r(yesNo('Are you legally authorized to work in the United States?')) as { value: string }).value, 'Yes')
  eq('authorised in the UK', (r(yesNo('Do you have the right to work in the United Kingdom?')) as { value: string }).value, 'Yes')
  eq('no sponsorship needed', (r(yesNo('Will you require visa sponsorship?')) as { value: string }).value, 'No')
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

await describe('already applied', () => {
  // The tracker names roles differently from the boards, so matching has to
  // survive "Senior Product Designer (Founding)" against "Product Designer"
  // while keeping genuinely different reqs apart.
  const prior = new Map([
    [`${normalizeCompany('Revin')}::${normalizeRole('Senior Product Designer (Founding)')}`,
      { status: 'applied', role: 'Senior Product Designer (Founding)', applied_at: '2026-08-07' }],
    [`${normalizeCompany('Moment')}::${normalizeRole('Design Engineer')}`,
      { status: 'rejected', role: 'Design Engineer', applied_at: '2026-08-07' }],
  ])

  check('a differently worded prior application matches',
    Boolean(priorFor(prior, { company: 'Revin', role_title: 'Senior Product Designer' })))
  eq('a rejection is reported as one',
    priorFor(prior, { company: 'Moment', role_title: 'Design Engineer' })?.status, 'rejected')
  check('a different role at the same company does not match',
    !priorFor(prior, { company: 'Moment', role_title: 'Agent Engineer' }))
  check('a different company does not match',
    !priorFor(prior, { company: 'Maple', role_title: 'Design Engineer' }))
})
