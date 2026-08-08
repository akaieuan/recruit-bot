import { locationFit, looksNyc, type LocationFit } from './normalize.ts'
import type { NormalizedPosting, Posting } from './types.ts'

/**
 * The deterministic pass. Runs before any model sees a posting, because most
 * of what a board publishes is off-target and rejecting it here is free.
 *
 * Two rules govern the design:
 *   Titles reject; nothing else does. Compensation and years of experience
 *   only ever raise a flag, because a stated band is a preference and a
 *   posting worth arguing with should still reach a human.
 *
 *   The allowlist runs first. "Design Engineer" contains "engineer" and would
 *   otherwise be caught by the frontend-engineering reject, which would
 *   silently discard the single most on-target title there is.
 */

export const COMP_FLOOR = 140_000
export const TARGET_BAND = { min: 150_000, max: 250_000 } as const

/** Titles that are the whole point. Nothing below can reject these. */
export const TITLE_ALLOW: { name: string; re: RegExp }[] = [
  { name: 'design engineer', re: /\bdesign\s+engineer/i },
  { name: 'founding designer', re: /\bfounding\s+(product\s+)?designer\b/i },
  { name: 'product engineer', re: /\bproduct\s+engineer/i },
  { name: 'creative technologist', re: /\bcreative\s+technologist\b/i },
  { name: 'design technologist', re: /\bdesign\s+technologist\b/i },
  { name: 'ui engineer (design-led)', re: /\b(ux|ui)\s+engineer\b/i },
  // He is a strong FDE: client-facing, technical, and used to working a complex
  // problem out in front of the customer. The original handoff rejected all of
  // this, which threw away a category he is genuinely good at.
  { name: 'forward deployed engineer', re: /\bforward[\s-]?deployed\b|\bfde\b/i },
  { name: 'solutions engineer', re: /\bsolutions?\s+(engineer|architect)\b/i },
  { name: 'applied ai', re: /\bapplied\s+ai\b/i },
  { name: 'ai strategist', re: /\bai\s+strateg(ist|y)\b/i },
  { name: 'ai engineer', re: /\bai\s+engineer\b/i },
]

/**
 * Every rejection is a title pattern, each with the reason it exists.
 *
 * These are tuned against the titles that actually came back from the seeded
 * boards, which is why some look oddly specific. Rejection is cheap and
 * reversible: the reason is recorded, and `filter --all` re-runs the rules
 * over everything after an edit, so a rule that turns out too broad costs one
 * command to undo.
 */
export const TITLE_REJECT: { reason: string; re: RegExp }[] = [
  {
    // Semafor posts an Asia Editor out of New York. The desk is Asia, so the
    // title decides even when the office is around the corner. His search is
    // the US, the UK and Europe.
    reason: 'a region outside the US, UK or Europe',
    re: /\b(asia|apac|japan|china|india|singapore|korea|latam|latin america|brazil|mexico|africa|middle east|mena|australia|anz|emea|dubai|hong kong)\b/i,
  },
  {
    reason: 'infrastructure, hardware or datacenter',
    re: /\bdatacenter\b|\bdata\s?cent(er|re)\b|\bhardware\b|\bsilicon\b|\bserver\s+lifecycle\b|\bsupply\s+chain\b|\bcapacity\s+engineering\b/i,
  },
  {
    reason: 'finance, capital or corporate development',
    re: /\bcapital\s+markets\b|\bfinanc(e|ing|ial)\b|\btreasury\b|\bcontroller\b|\bcorporate\s+development\b|\bfp&a\b|\bprocurement\b/i,
  },
  {
    reason: 'partnerships or alliances',
    re: /\bpartnerships?\b|\balliances?\b|\bgtm\b|\bgo[\s-]?to[\s-]?market\b|\bchannel\b|\bbizops\b/i,
  },
  {
    // A contract or fractional engagement is not the job he is looking for.
    reason: 'contract or fractional engagement',
    re: /\bcontract(or)?\b|\bfractional\b|\bfreelance\b|\bpart[\s-]?time\b|\bfacilitator\b|\btemp\b/i,
  },
  {
    // Overqualification reads as flight risk, and the level argues down.
    reason: 'junior or associate level',
    // Plurals matter: "Technical Interns and New Grads" slipped past
    // \bintern\b and \bnew grad\b because the trailing s killed the boundary.
    re: /\b(product\s+)?designer\s*(i|1)\b|\b(associates?|juniors?|jr\.?|intern(ship)?s?|entry[- ]level|apprentices?|new\s+grads?)\b/i,
  },
  {
    // He has never managed a design team and will not claim to. "Head of" and
    // "Manager" are rejected whatever they lead: the req is a people role.
    reason: 'people management or executive',
    re: /\bhead\s+of\b|\bdirector\b|\bvp\b|\bvice\s+president\b|\bchief\b|\bc[teofmr]o\b|\bmanager\b|\bmanagement\b|\bteam\s+lead\b|\bleader\b|\bpartner\b/i,
  },
  {
    // Argues on his weakest axis: competes against deeper CS backgrounds.
    reason: 'pure frontend or software engineering',
    re: /\b(front[\s-]?end|frontend|backend|back[\s-]?end|full[\s-]?stack|software|platform|infrastructure|systems|security|mobile|ios|android|web|data|devops|cloud|network|qa|test|performance|silicon|hardware|quantitative|firmware)\s+(engineer|developer|architect)\b|\bsoftware\s+development\s+engineer\b|\bsre\b/i,
  },
  {
    // Only the commercial end of customer-facing work. Forward deployed and
    // solutions roles are on the allowlist above: those are technical and he
    // is good at them.
    reason: 'sales or account-side customer work',
    re: /\b(sales|gtm|go[\s-]?to[\s-]?market|growth|revenue|partner)\s+(engineer|architect|consultant|strateg)/i,
  },
  {
    // He has no ML research background and will not claim one. Applied AI and
    // AI engineering are on the allowlist; this is the science end.
    reason: 'ML research or model training',
    re: /\b(machine\s+learning|ml|deep\s+learning)\s+(engineer|scientist|architect)\b|\bresearch\s+scientist\b|\b(model|training|inference|pretraining)\s+(engineer|scientist)\b/i,
  },
  {
    // An engineering req wearing a domain: "Staff Engineer, Security" and
    // "Senior Platform Reliability Engineer" split the adjacency the rule
    // above relies on, so the domain word is matched wherever it appears.
    reason: 'specialist engineering domain',
    re: /\bengineer(ing)?\b[\s\S]*\b(security|reliability|platform|infrastructure|distributed|supercomputing|compiler|kernel|database|observability|networking|embedded)\b|\b(security|reliability|platform|infrastructure|distributed|supercomputing|compiler|kernel|database|observability|networking|embedded)\b[\s\S]*\bengineer(ing)?\b/i,
  },
  {
    // Anthropic and other large employers post whole org charts. None of these
    // are design or the kind of engineering he does, and all four reached a
    // model before this rule existed.
    reason: 'infrastructure, hardware or datacenter',
    re: /\bdatacenter\b|\bdata\s?cent(er|re)\b|\bhardware\b|\bsilicon\b|\bserver\s+lifecycle\b|\bsupply\s+chain\b|\bcapacity\s+engineering\b/i,
  },
  {
    reason: 'finance, capital or corporate development',
    re: /\bcapital\s+markets\b|\bfinanc(e|ing|ial)\b|\btreasury\b|\bcontroller\b|\bcorporate\s+development\b|\bfp&a\b|\bprocurement\b/i,
  },
  {
    reason: 'partnerships or alliances',
    re: /\bpartnerships?\b|\balliances?\b|\bgtm\b|\bgo[\s-]?to[\s-]?market\b|\bchannel\b|\bbizops\b/i,
  },
  {
    // A contract or fractional engagement is not the job he is looking for.
    reason: 'contract or fractional engagement',
    re: /\bcontract(or)?\b|\bfractional\b|\bfreelance\b|\bpart[\s-]?time\b|\bfacilitator\b|\btemp\b/i,
  },
  {
    reason: 'developer relations or evangelism',
    re: /\bdev\s?rel\b|\bdeveloper\s+(advocate|relations|experience)\b|\bevangelist\b|\badvocate\b|\bcommunity\b/i,
  },
  {
    // No consumer research, no quant depth, no SQL.
    reason: 'dedicated research',
    re: /\bresearch(er)?\b|\bscientist\b|\banalyst\b|\banalytics\b/i,
  },
  {
    // AI strategy is on the allowlist. This is the management-consulting end.
    reason: 'operations, program or project management',
    re: /\bops\b|\boperations\b|\badvisor\b|\bprogram\s+manager\b|\bproject\s+manager\b|\btpm\b|\bchief\s+of\s+staff\b|\bproducer\b|\bmanagement\s+consultant\b/i,
  },
  {
    // Discipline leads are people roles even when the title says IC. The
    // allowlist protects "Lead Design Engineer" and friends before this runs.
    // The allowlist protects "Lead Design Engineer" before this runs, so a
    // bare "Lead" anywhere else is safe to treat as a people role.
    reason: 'discipline lead',
    re: /\blead\b/i,
  },
  {
    // Adjacent design disciplines. Real work, but not the positioning: these
    // argue from craft he does not sell.
    reason: 'adjacent design discipline',
    re: /\b(graphic|brand|motion|visual|marketing|packaging|industrial|game|3d)\s+designer\b|\bart\s+director\b|\banimator\b|\billustrator\b/i,
  },
  {
    reason: 'not a design or engineering role',
    re: /\b(account\s+(executive|manager)|sales|business\s+development|bd\b|revenue|recruit(er|ing)|talent|people\s+ops|hr\b|marketing|marketer|abm\b|finance|accountant|accounting|controller|legal|counsel|compliance|customer\s+success|client\s+success|customer\s+support|assistant|ambassador|expert|investigator|booker|office\s+manager|coordinator|representative|specialist|administrator|partnerships)/i,
  },
  {
    // Generic pipeline reqs with no role attached.
    reason: 'open pipeline req, not a specific role',
    re: /\btalent\s+(network|pool|community)\b|\bgeneral\s+application\b|\bfuture\s+opportunit|\bspeculative\b|\bbring\s+your\s+own\b/i,
  },
]

/** JD signals worth surfacing. Presence is informative; absence rejects nothing. */
export const JD_KEYWORDS = [
  'agent', 'human-in-the-loop', 'human in the loop', 'review', 'approval',
  'evaluation', 'eval', 'design system', 'prototype in code', 'prototyping in code',
  'claude code', 'cursor', 'shadcn', 'electron', 'founding', 'design engineer',
  'ship', 'zero to one', '0 to 1', 'first design hire', 'craft',
] as const

export interface FilterVerdict {
  decision: 'pass' | 'reject'
  reason: string | null
  compFlag: boolean
  yearsFlag: string | null
  keywordHits: string[]
  allowMatch: string | null
  /** null when it is in New York; otherwise what taking it would involve. */
  relocation: string | null
}

type FilterInput = Pick<
  Posting | NormalizedPosting,
  'role_title' | 'comp_min' | 'comp_max' | 'years_min' | 'years_max' | 'description_text'
> & { location?: string | null; remote_policy?: string | null }

/**
 * Location only rejects where he could not take the job.
 *
 * He is in New York and prefers onsite there, but holds US and UK citizenship
 * and is open to relocating anywhere in the US or to London for the right
 * role. So a San Francisco or London posting is a real option and stays in,
 * carrying a flag that says it would mean moving. Somewhere he would need a
 * visa is out, unless the role is remote and anchored where he can work.
 */
export function outsideNyc(location: string | null | undefined, remotePolicy: string | null | undefined): boolean {
  if (!location?.trim()) return false
  const fit = locationFit(location)
  if (fit === 'elsewhere') return true
  return false
}

/** Says what accepting this role would actually involve. */
export function relocationFlag(location: string | null | undefined, remotePolicy: string | null | undefined): string | null {
  const fit: LocationFit = locationFit(location)
  if (fit === 'nyc' || fit === 'unknown') return null
  if (remotePolicy === 'remote') return 'remote'
  if (fit === 'uk') return 'relocate_uk'
  if (fit === 'eu') return 'relocate_eu'
  if (fit === 'us') return 'relocate_us'
  return null
}

export function evaluate(posting: FilterInput): FilterVerdict {
  const title = posting.role_title ?? ''
  const text = (posting.description_text ?? '').toLowerCase()

  const allow = TITLE_ALLOW.find((a) => a.re.test(title))
  let reject: { reason: string; re: RegExp; bare?: boolean } | undefined = allow
    ? undefined
    : TITLE_REJECT.find((r) => r.re.test(title))

  // Location rejects even an allowlisted title: a Design Engineer role in
  // Seoul is still a Design Engineer role in Seoul.
  if (!reject && outsideNyc(posting.location, posting.remote_policy)) {
    reject = { reason: 'somewhere he would need a visa', re: /(?:)/, bare: true }
  }

  // A posted maximum below the floor is the real signal: a low minimum with a
  // healthy top of band is a normal range, not an underpaid role.
  const ceiling = posting.comp_max ?? posting.comp_min
  const compFlag = ceiling !== null && ceiling !== undefined && ceiling < COMP_FLOOR

  const keywordHits = JD_KEYWORDS.filter((k) => text.includes(k))

  return {
    decision: reject ? 'reject' : 'pass',
    reason: reject ? (reject.bare ? reject.reason : `title: ${reject.reason}`) : null,
    compFlag,
    yearsFlag: yearsFlag(posting.years_min ?? null, posting.years_max ?? null),
    relocation: relocationFlag(posting.location, posting.remote_policy),
    keywordHits: [...new Set(keywordHits)],
    allowMatch: allow?.name ?? null,
  }
}

/**
 * Four years in. 3 to 8 is a clean fit, 5 to 7 a normal stretch worth taking,
 * 10+ a long shot worth surfacing anyway. None of these reject.
 */
export function yearsFlag(min: number | null, max: number | null): string | null {
  if (min === null) return null
  if (min >= 10) return 'long_shot_10plus'
  if (min >= 8) return 'stretch_8plus'
  if (min >= 5) return 'stretch_5to7'
  return null
}
