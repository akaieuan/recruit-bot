export type Ats = 'ashby' | 'greenhouse' | 'manual'
export type RemotePolicy = 'onsite' | 'hybrid' | 'remote' | 'unknown'

export type Stage =
  | 'new'
  | 'auto_rejected'
  | 'needs_score'
  | 'scored'
  | 'needs_research'
  | 'researched'
  | 'needs_draft'
  | 'in_review'
  | 'approved'
  | 'applied'
  | 'skipped'

export const STAGES: readonly Stage[] = [
  'new',
  'auto_rejected',
  'needs_score',
  'scored',
  'needs_research',
  'researched',
  'needs_draft',
  'in_review',
  'approved',
  'applied',
  'skipped',
]

export type Tier = 'strong' | 'possible' | 'long_shot' | 'reject'
export type TitleMatch = 'ideal' | 'adjacent' | 'off'
export type Recommendation = 'advance' | 'hold' | 'skip'
export type NycFit = 'in_person' | 'hybrid' | 'remote_ok' | 'not_nyc' | 'unknown'

export type DraftKind = 'cover_letter' | 'answer'
export type DraftStatus = 'draft' | 'needs_edit' | 'approved' | 'rejected'
export type ContactVariant = 'design' | 'engineering'

export type ApplicationStatus =
  | 'unknown'
  | 'applied'
  | 'no_response'
  | 'in_progress'
  | 'interviewing'
  | 'rejected'
  | 'offer'
  | 'withdrawn'
  | 'do_not_apply'

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'unknown',
  'applied',
  'no_response',
  'in_progress',
  'interviewing',
  'rejected',
  'offer',
  'withdrawn',
  'do_not_apply',
]

export interface Posting {
  id: number
  ats: Ats
  board_token: string | null
  job_id: string | null
  url: string
  company: string
  role_title: string
  location: string | null
  remote_policy: RemotePolicy | null
  comp_min: number | null
  comp_max: number | null
  years_min: number | null
  years_max: number | null
  description_html: string | null
  description_text: string | null
  content_hash: string | null
  first_seen: string
  last_seen: string
  closed_at: string | null
  stage: Stage
  stage_reason: string | null
  comp_flag: number
  years_flag: string | null
}

/** What a poller produces before it touches the database. */
export interface NormalizedPosting {
  ats: Ats
  board_token: string | null
  job_id: string | null
  url: string
  company: string
  role_title: string
  location: string | null
  remote_policy: RemotePolicy
  comp_min: number | null
  comp_max: number | null
  years_min: number | null
  years_max: number | null
  description_html: string | null
  description_text: string
}

export interface Score {
  id: number
  posting_id: number
  scored_at: string
  score: number
  tier: Tier
  title_match: TitleMatch | null
  keyword_hits: string | null
  company_size_estimate: string | null
  stage_estimate: string | null
  nyc: NycFit | null
  rationale: string
  recommendation: Recommendation
}

export interface Research {
  id: number
  posting_id: number
  researched_at: string
  company_summary: string | null
  funding: string | null
  headcount: string | null
  hard_problem: string | null
  jd_lines: string | null
  sources: string | null
  raw_md: string | null
}

export interface JdLineMapping {
  jd_line: string
  fact_ids: string[]
}

export interface Draft {
  id: number
  posting_id: number
  kind: DraftKind
  question_key: string | null
  version: number
  body: string
  contact_variant: ContactVariant
  facts_used: string
  jd_lines: string | null
  critique: string | null
  review_note: string | null
  status: DraftStatus
  pdf_path: string | null
  created_at: string
  updated_at: string
}

export interface Critique {
  weakest: string
  stretches: string[]
  needs_verification: string[]
  verdict: 'ship' | 'revise'
}

export interface ApplicationQuestion {
  key: string
  label: string
  type: string
  required: boolean
  options?: string[]
}

export interface Application {
  id: number
  posting_id: number | null
  company: string
  role: string
  location: string | null
  comp_range: string | null
  ats: string | null
  url: string | null
  applied_at: string | null
  applied_at_precision: 'day' | 'before' | null
  materials: string | null
  status: ApplicationStatus
  status_raw: string | null
  status_ambiguous: number
  notes: string | null
  follow_up_at: string | null
  followed_up_at: string | null
  source: 'csv_import' | 'pipeline' | 'manual'
  created_at: string
  updated_at: string
}

export interface Fact {
  id: string
  text: string
  tags: string[]
}
