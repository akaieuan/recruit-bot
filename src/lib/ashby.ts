import { extractYears, remotePolicyFrom } from './normalize.ts'
import type { NormalizedPosting } from './types.ts'

/**
 * Ashby's public posting API. No auth, no key, documented for job boards.
 * The posting pages themselves are JS-rendered, so the API is the only way to
 * read a description; scraping the HTML yields metadata and nothing else.
 */
const BOARD_URL = (token: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`

interface AshbyComponent {
  compensationType?: string
  interval?: string
  currencyCode?: string | null
  minValue?: number | null
  maxValue?: number | null
}

interface AshbyJob {
  id: string
  title: string
  department?: string | null
  team?: string | null
  employmentType?: string | null
  location?: string | null
  secondaryLocations?: { location?: string }[]
  isListed?: boolean
  isRemote?: boolean
  workplaceType?: string | null
  jobUrl?: string
  applyUrl?: string
  descriptionHtml?: string
  descriptionPlain?: string
  compensation?: {
    summaryComponents?: AshbyComponent[]
    compensationTierSummary?: string | null
  }
}

/** Annual USD salary only. Equity, hourly and other currencies are ignored. */
export function salaryFrom(job: AshbyJob): { min: number | null; max: number | null } {
  const comps = job.compensation?.summaryComponents ?? []
  const salary = comps.find(
    (c) =>
      c.compensationType === 'Salary' &&
      (c.currencyCode ?? 'USD') === 'USD' &&
      /year/i.test(c.interval ?? ''),
  )
  if (!salary) return { min: null, max: null }
  const min = typeof salary.minValue === 'number' ? Math.round(salary.minValue) : null
  const max = typeof salary.maxValue === 'number' ? Math.round(salary.maxValue) : null
  if (min !== null && min < 30_000) return { min: null, max: null }
  return { min, max }
}

export function normalizeAshbyJob(token: string, job: AshbyJob): NormalizedPosting | null {
  if (!job.id || !job.title) return null

  const text = job.descriptionPlain?.trim() || ''
  const html = job.descriptionHtml ?? null
  const location =
    job.location ??
    job.secondaryLocations?.map((l) => l.location).filter(Boolean).join(', ') ??
    null
  const { min, max } = salaryFrom(job)
  const years = extractYears(text)

  return {
    ats: 'ashby',
    board_token: token,
    job_id: job.id,
    url: job.jobUrl ?? `https://jobs.ashbyhq.com/${token}/${job.id}`,
    // The board API carries no company name field; the token is the company.
    company: token,
    role_title: job.title.trim(),
    location,
    remote_policy: remotePolicyFrom({
      workplaceType: job.workplaceType,
      isRemote: job.isRemote,
      location,
      text,
    }),
    comp_min: min,
    comp_max: max,
    years_min: years.min,
    years_max: years.max,
    description_html: html,
    description_text: text,
  }
}

export async function fetchAshbyBoard(token: string): Promise<NormalizedPosting[]> {
  const res = await fetch(BOARD_URL(token), {
    headers: { accept: 'application/json', 'user-agent': 'recruit-bot (personal job search tool)' },
  })
  if (!res.ok) throw new Error(`ashby ${token}: HTTP ${res.status}`)
  const body = (await res.json()) as { jobs?: AshbyJob[] }
  const jobs = body.jobs ?? []
  return jobs.map((j) => normalizeAshbyJob(token, j)).filter((p): p is NormalizedPosting => p !== null)
}

/** Pulls the board token and job id out of a jobs.ashbyhq.com posting URL. */
export function parseAshbyUrl(url: string): { token: string; jobId: string } | null {
  const m = /jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{16,})/i.exec(url)
  if (!m?.[1] || !m[2]) return null
  return { token: m[1], jobId: m[2] }
}

/**
 * A single posting by URL. Unlisted postings resolve in a browser but are
 * absent from the board response, so this asks the board first and only then
 * falls back to the page's embedded JSON payload.
 */
export async function fetchAshbyPosting(url: string): Promise<NormalizedPosting | null> {
  const parsed = parseAshbyUrl(url)
  if (!parsed) return null

  const listed = await fetchAshbyBoard(parsed.token).catch(() => [])
  const hit = listed.find((p) => p.job_id === parsed.jobId)
  if (hit) return hit

  const res = await fetch(url, { headers: { 'user-agent': 'recruit-bot (personal job search tool)' } })
  if (!res.ok) return null
  const html = await res.text()
  const m = /window\.__appData\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/.exec(html)
  if (!m?.[1]) return null
  try {
    const data = JSON.parse(m[1]) as { posting?: AshbyJob }
    if (!data.posting) return null
    const job: AshbyJob = { ...data.posting, id: data.posting.id ?? parsed.jobId }
    return normalizeAshbyJob(parsed.token, job)
  } catch {
    return null
  }
}
