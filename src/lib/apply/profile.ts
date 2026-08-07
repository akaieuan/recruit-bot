import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PATHS } from '../paths.ts'

/**
 * The answers every application form asks for.
 *
 * Anything not known is null and stays null. A form field with no value is
 * reported as unresolved and handed back to him; it is never filled with a
 * plausible guess, because a guessed phone number or work authorisation answer
 * is a false statement submitted under his name.
 */
export interface Profile {
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string | null
  location: string
  city: string
  state: string
  country: string
  linkedin: string
  github: string | null
  portfolio: string
  website: string
  /** Free-text answers to the standard work-eligibility questions. */
  work_authorized: boolean | null
  requires_sponsorship: boolean | null
  work_authorization_note: string | null
  over_18: boolean | null
  /** He wants in-person; 4 to 5 days onsite is a positive signal, not a cost. */
  willing_onsite: boolean | null
  /** Files uploaded to the form. Paths are relative to the repo root. */
  resume_path: string
  portfolio_path: string | null
  /**
   * Deliberately absent: compensation expectations and every demographic
   * question. Both are answered by him, per application, or left blank.
   */
  notes: string[]
  /** Fields he still has to supply before an application can be completed. */
  confirm: string[]
}

export const PROFILE_PATH = join(PATHS.data, 'profile.json')

const DEFAULT_PROFILE: Profile = {
  first_name: 'Ieuan',
  last_name: 'King',
  full_name: 'Ieuan King',
  email: 'Ieuan@yionvisual.com',
  // Never invented. An application that needs a phone number stops here.
  phone: null,
  location: 'Brooklyn, NY',
  city: 'Brooklyn',
  state: 'NY',
  country: 'United States',
  linkedin: 'https://linkedin.com/in/ieuan-king',
  github: 'https://github.com/akaieuan',
  portfolio: 'https://akabuild.dev',
  website: 'https://akaoss.dev',
  // From his own Axon letter: "I am a U.S. citizen."
  work_authorized: true,
  requires_sponsorship: false,
  work_authorization_note: 'U.S. citizen.',
  over_18: true,
  willing_onsite: true,
  resume_path: 'data/Ieuan King - Resume 2026.pdf',
  portfolio_path: 'data/ieuan-king-portfolio-2026.pdf',
  notes: [
    'Compensation expectations are answered per application, by him. Never auto-filled.',
    'Demographic and voluntary self-identification questions are always left blank.',
  ],
  confirm: ['phone', 'github', 'email'],
}

export function readProfile(): Profile {
  if (!existsSync(PROFILE_PATH)) {
    writeFileSync(PROFILE_PATH, `${JSON.stringify(DEFAULT_PROFILE, null, 2)}\n`)
    return DEFAULT_PROFILE
  }
  return JSON.parse(readFileSync(PROFILE_PATH, 'utf8')) as Profile
}

/**
 * Gaps that matter for this form, not in the abstract.
 *
 * A missing phone number blocks an application that asks for one and is
 * irrelevant to one that does not. Reporting it as blocking either way trains
 * you to skim past the blocking list, which is the point at which it stops
 * doing its job. Fields the form never shows are not gaps.
 */
export function profileGaps(p: Profile, askedFor?: Set<string>): string[] {
  const gaps: string[] = []
  const asked = (key: string) => !askedFor || askedFor.has(key)

  if (!p.phone && asked('phone')) gaps.push('phone is not set in data/profile.json, and this form asks for one')
  if (!existsSync(join(PATHS.repoRoot, p.resume_path))) gaps.push(`resume not found at ${p.resume_path}`)

  for (const field of p.confirm ?? []) {
    if (asked(field)) gaps.push(`"${field}" is marked for confirmation in data/profile.json`)
  }
  return gaps
}
