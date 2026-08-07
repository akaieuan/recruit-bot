import { check, describe, eq } from './harness.ts'
import { extractComp, extractYears, looksNyc, remotePolicyFrom } from '../normalize.ts'
import { decodeEntities, htmlToText } from '../html.ts'
import { salaryFrom } from '../ashby.ts'

await describe('extractComp', () => {
  eq('plain range', extractComp('The salary range is $150,000 - $200,000 per year.'), { min: 150000, max: 200000 })
  eq('k notation', extractComp('Compensation: $150K – $200K plus equity'), { min: 150000, max: 200000 })
  eq('"to" separator', extractComp('We pay $180,000 to $240,000'), { min: 180000, max: 240000 })
  eq('no comma', extractComp('base of $150000-$190000'), { min: 150000, max: 190000 })

  // An hourly rate must never be read as an annual band.
  eq('hourly ignored', extractComp('This role pays $50 - $75 per hour.'), { min: null, max: null })
  eq('equity ignored', extractComp('Equity of 0.05% - 0.2% is offered.'), { min: null, max: null })
  eq('absent', extractComp('Competitive salary and benefits.'), { min: null, max: null })

  // Boards often quote a narrow zone band before the full range.
  eq(
    'widest range wins',
    extractComp('NYC zone: $170,000 - $180,000. Full range across zones: $150,000 - $210,000.'),
    { min: 150000, max: 210000 },
  )
})

await describe('extractYears', () => {
  eq('range', extractYears('You have 5-8 years of experience'), { min: 5, max: 8 })
  eq('plus', extractYears('7+ years building products'), { min: 7, max: null })
  eq('at least', extractYears('at least 4 years of professional experience'), { min: 4, max: null })
  eq('bare', extractYears('3 years of relevant experience required'), { min: 3, max: null })
  eq('absent', extractYears('You are a strong designer.'), { min: null, max: null })
  // A "401k" style number must not be mistaken for a year count.
  eq('no false positive', extractYears('We offer a 401k and unlimited PTO'), { min: null, max: null })
})

await describe('remotePolicy', () => {
  eq('ashby onsite', remotePolicyFrom({ workplaceType: 'OnSite' }), 'onsite')
  eq('ashby hybrid', remotePolicyFrom({ workplaceType: 'Hybrid' }), 'hybrid')
  eq('ashby remote', remotePolicyFrom({ workplaceType: 'Remote' }), 'remote')
  eq('text hybrid', remotePolicyFrom({ text: 'This is a hybrid role, 3 days in office' }), 'hybrid')
  eq('text remote', remotePolicyFrom({ text: 'We are a remote-first company' }), 'remote')
  eq('unknown', remotePolicyFrom({ text: 'Join our team' }), 'unknown')
})

await describe('looksNyc', () => {
  check('new york', looksNyc('New York, NY'))
  check('brooklyn', looksNyc('Credal HQ (Brooklyn, NY)'))
  check('nyc', looksNyc('NYC'))
  check('not sf', !looksNyc('San Francisco, CA'))
})

await describe('salaryFrom (ashby)', () => {
  eq(
    'annual usd salary',
    salaryFrom({
      id: 'x', title: 'y',
      compensation: {
        summaryComponents: [
          { compensationType: 'Salary', interval: '1 YEAR', currencyCode: 'USD', minValue: 120000, maxValue: 150000 },
          { compensationType: 'EquityPercentage', interval: 'NONE', currencyCode: null, minValue: 0.05, maxValue: 0.2 },
        ],
      },
    }),
    { min: 120000, max: 150000 },
  )
  eq(
    'hourly rejected',
    salaryFrom({
      id: 'x', title: 'y',
      compensation: { summaryComponents: [{ compensationType: 'Salary', interval: '1 HOUR', currencyCode: 'USD', minValue: 60, maxValue: 90 }] },
    }),
    { min: null, max: null },
  )
  eq('absent', salaryFrom({ id: 'x', title: 'y' }), { min: null, max: null })
})

await describe('html', () => {
  eq('entities', decodeEntities('&lt;p&gt;Hi &amp; bye&lt;/p&gt;'), '<p>Hi & bye</p>')
  eq('numeric entities', decodeEntities('caf&#233; &#x2014;'), 'café —')
  eq('paragraphs to breaks', htmlToText('<p>One</p><p>Two</p>'), 'One\n\nTwo')
  eq('list items keep bullets', htmlToText('<ul><li>A</li><li>B</li></ul>'), '- A\n- B')
  eq('script stripped', htmlToText('<script>evil()</script><p>Safe</p>'), 'Safe')
  eq('double encoded round trip', htmlToText(decodeEntities('&lt;p&gt;Design &amp; code&lt;/p&gt;')), 'Design & code')
})
