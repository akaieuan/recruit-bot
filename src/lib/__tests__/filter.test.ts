import { check, describe, eq } from './harness.ts'
import { evaluate, yearsFlag } from '../filter.ts'

function verdict(role_title: string, extra: Partial<Parameters<typeof evaluate>[0]> = {}) {
  return evaluate({
    role_title,
    comp_min: null,
    comp_max: null,
    years_min: null,
    years_max: null,
    description_text: '',
    ...extra,
  })
}

await describe('filter: the allowlist runs first', () => {
  // The whole reason for allowlist-before-reject: these all contain a token
  // that a reject rule matches.
  check('Design Engineer survives the engineering reject', verdict('Design Engineer').decision === 'pass')
  check('Senior Design Engineer survives', verdict('Senior Design Engineer').decision === 'pass')
  check('Founding Designer survives', verdict('Founding Designer').decision === 'pass')
  check('Founding Product Designer survives', verdict('Founding Product Designer').decision === 'pass')
  check('Product Engineer survives', verdict('Product Engineer').decision === 'pass')
  check('Design Engineer (Frontend) survives', verdict('Design Engineer (Frontend)').decision === 'pass')
  eq('allow match is named', verdict('Design Engineer').allowMatch, 'design engineer')
})

await describe('filter: title rejects', () => {
  const rejects: [string, string][] = [
    ['Product Designer I', 'junior'],
    ['Associate Product Designer', 'junior'],
    ['Junior Designer', 'junior'],
    ['Design Intern', 'junior'],
    ['Head of Design', 'management'],
    ['Head of Product Design', 'management'],
    ['Design Director', 'management'],
    ['Director of Design', 'management'],
    ['VP of Design', 'management'],
    ['Design Manager', 'management'],
    ['Frontend Engineer', 'frontend'],
    ['Senior Front-End Engineer', 'frontend'],
    ['Full Stack Engineer', 'frontend'],
    ['Senior Software Engineer, Backend', 'frontend'],
    ['Machine Learning Engineer', 'ml'],
    ['Applied AI Engineer', 'ml'],
    ['Research Scientist', 'ml'],
    ['Data Analyst, Product Analytics', 'ml'],
    ['Developer Advocate', 'devrel'],
    ['DevRel Lead', 'devrel'],
    ['UX Researcher', 'research'],
    ['Senior User Researcher', 'research'],
    ['Account Executive', 'non-design'],
    ['Senior Accountant', 'non-design'],
    ['Forward Deployed Engineer', 'frontend'],
    // Real titles from the seeded boards. Each one survived an earlier version
    // of these rules, which is why it is pinned here.
    ['FDE', 'forward deployed'],
    ['AI Strategist', 'strategy'],
    ['Senior AI Strategist, Enablement', 'strategy'],
    ['AI Evangelist', 'devrel'],
    ['Head of Security', 'management'],
    ['Head of Talent', 'management'],
    ['Head of Partnerships', 'management'],
    ['Chief Compliance Officer', 'management'],
    ['Engineering Manager', 'management'],
    ['Senior Manager, Solutions Consultant', 'management'],
    ['Strategy & Ops Leader', 'strategy'],
    ['Executive Assistant', 'non-design'],
    ['ABM Manager', 'management'],
    ['Community Lead', 'devrel'],
    ['Client Success Representative', 'non-design'],
    ['Senior Client Success Manager', 'management'],
    ['Solutions Consultant', 'forward deployed'],
    ['Customer Deployment Engineer', 'forward deployed'],
    ['Customer Engineer', 'forward deployed'],
    ['GTM Engineer', 'forward deployed'],
    ['Content Engineer', 'forward deployed'],
    ['Full-Stack Creator', 'strategy'],
    ['Applied AI, Engineer & Creator', 'applied ai'],
    ['Researcher', 'research'],
    ['Founding Business Development', 'non-design'],
    ['VTS Talent Network - United States', 'pipeline req'],
    ['Bring Your Own Pod', 'pipeline req'],
    ['Senior Technical Solutions Consultant', 'forward deployed'],
    ['Senior/Staff TPM, Security Risk', 'strategy'],
    ['Senior Platform Reliability Engineer', 'specialist engineering'],
    ['Staff Engineer, Security', 'specialist engineering'],
    ['Engineer, Supercomputing & Distributed Systems', 'specialist engineering'],
    ['Growth Marketer', 'non-design'],
    ['Creative Producer', 'strategy'],
    ['Creative Lead', 'discipline lead'],
    ['Engagement Lead', 'discipline lead'],
    ['Infrastructure Tax Lead', 'discipline lead'],
    ['Deployment Lead - ERP Solutions', 'discipline lead'],
    ['Lead Product Builder, Product & Design', 'discipline lead'],
    ['Incident & Crisis Management Lead', 'management'],
    ['Product Management, Human Data Platform', 'management'],
    ['Brand Ambassador', 'non-design'],
    ['Administrative & Office Assistant', 'non-design'],
    ['Product Expert, PLM and ERP', 'non-design'],
    ['Insider Risk Investigator', 'non-design'],
    ['Audience Booker (Contract)', 'non-design'],
    ['Performance Engineer, GPU', 'specialist engineering'],
    ['Silicon Engineer', 'specialist engineering'],
    ['Quantitative Engineer', 'specialist engineering'],
    ['Brand/Graphic Designer', 'adjacent design'],
    ['Rive Motion Designer and Animator (Contract)', 'adjacent design'],
    ['Art Director', 'management'],
    ['Technical Interns and New Grads', 'junior'],
    ['Design Interns', 'junior'],
    ['Associates, Product', 'junior'],
    ['GTM Systems Administrator', 'non-design'],
  ]
  for (const [title] of rejects) {
    const v = verdict(title)
    check(`rejects "${title}"`, v.decision === 'reject', v.decision === 'reject' ? undefined : 'it passed')
  }
})

await describe('filter: on-target titles are not rejected', () => {
  for (const title of [
    'Design Engineer',
    'Founding Designer',
    'Founding Design Engineer',
    'Product Designer',
    'Senior Product Designer',
    'Staff Product Designer',
    'Senior/Staff Product Designer',
    'Design Engineer, Growth',
    'Creative Technologist',
    'Product Engineer',
    'Founding Product Designer',
  ]) {
    const v = verdict(title)
    check(`passes "${title}"`, v.decision === 'pass', v.decision === 'pass' ? undefined : `rejected: ${v.reason}`)
  }
})

await describe('filter: compensation flags but never rejects', () => {
  const low = verdict('Design Engineer', { comp_min: 90_000, comp_max: 120_000 })
  check('sub-floor is flagged', low.compFlag)
  check('sub-floor still passes', low.decision === 'pass')

  const good = verdict('Design Engineer', { comp_min: 160_000, comp_max: 210_000 })
  check('in-band is not flagged', !good.compFlag)

  // A wide range with a low floor is normal, not underpaid.
  const wide = verdict('Design Engineer', { comp_min: 120_000, comp_max: 220_000 })
  check('wide range judged on its ceiling', !wide.compFlag)

  const none = verdict('Design Engineer')
  check('unpublished comp is not flagged', !none.compFlag)

  // Even a title that rejects must not be rejected *for* its compensation.
  const both = verdict('Frontend Engineer', { comp_min: 90_000, comp_max: 100_000 })
  eq('reject reason is always the title', both.reason, 'title: pure frontend or software engineering')
})

await describe('filter: years flag but never reject', () => {
  eq('4 years is a clean fit', yearsFlag(4, 8), null)
  eq('3 years is a clean fit', yearsFlag(3, null), null)
  eq('5 to 7 is a stretch', yearsFlag(5, 7), 'stretch_5to7')
  eq('8 is a bigger stretch', yearsFlag(8, null), 'stretch_8plus')
  eq('10+ is a long shot', yearsFlag(10, null), 'long_shot_10plus')
  eq('unstated is nothing', yearsFlag(null, null), null)

  const senior = verdict('Design Engineer', { years_min: 12, years_max: null })
  check('12 years still passes', senior.decision === 'pass')
  eq('and is flagged as a long shot', senior.yearsFlag, 'long_shot_10plus')
})

await describe('filter: location', () => {
  const at = (location: string | null, remote_policy = 'onsite') =>
    verdict('Design Engineer', { location, remote_policy } as never)

  check('NYC passes', at('New York, NY').decision === 'pass')
  check('Brooklyn passes', at('Credal HQ (Brooklyn, NY)').decision === 'pass')
  check('Manhattan passes', at('Manhattan').decision === 'pass')
  // A multi-city req lists every office, so one NYC mention is enough.
  check('multi-city with NYC passes', at('San Francisco, CA | New York City, NY').decision === 'pass')

  // He holds US and UK citizenship and will relocate for the right role, so
  // these are real options rather than rejects, flagged for what they involve.
  check('San Francisco passes', at('San Francisco').decision === 'pass')
  eq('flagged as a US move', at('San Francisco').relocation, 'relocate_us')
  check('London passes', at('London, United Kingdom').decision === 'pass')
  eq('flagged as a UK move', at('London, United Kingdom').relocation, 'relocate_uk')
  eq('New York needs no move', at('New York, NY').relocation, null)

  // Somewhere he would need a visa is still out.
  check('Seoul rejects', at('Seoul, Korea').decision === 'reject')
  check('Malaysia rejects', at('Malaysia').decision === 'reject')
  check('Tokyo rejects', at('Tokyo, Japan').decision === 'reject')
  eq('and says why', at('Seoul, Korea').reason, 'somewhere he would need a visa')

  check('US remote passes', at('United States', 'remote').decision === 'pass')
  check('remote with no location passes', at(null, 'remote').decision === 'pass')
  check('remote in Indonesia still rejects', at('Indonesia', 'remote').decision === 'reject')
  // Absence of a location is not evidence of a bad one.
  check('unstated location passes', at(null).decision === 'pass')
  check('empty location passes', at('  ').decision === 'pass')
})

await describe('filter: keyword hits', () => {
  const v = verdict('Design Engineer', {
    description_text:
      'You will build human-in-the-loop review flows for our agent product, own the design system, and prototype in code with Cursor.',
  })
  for (const k of ['agent', 'human-in-the-loop', 'review', 'design system', 'prototype in code', 'cursor']) {
    check(`finds "${k}"`, v.keywordHits.includes(k), `hits: ${v.keywordHits.join(', ')}`)
  }
  eq('no text means no hits', verdict('Design Engineer').keywordHits, [])
})
