import { decodeEntities, htmlToText } from './html.ts'
import { extractComp, extractYears, remotePolicyFrom } from './normalize.ts'
import type { ApplicationQuestion, NormalizedPosting } from './types.ts'

/** Greenhouse's public job board API. No auth. */
const BOARD_URL = (token: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`
const JOB_URL = (token: string, jobId: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs/${encodeURIComponent(jobId)}?questions=true`

interface GreenhouseJob {
  id: number
  internal_job_id?: number
  absolute_url: string
  title: string
  company_name?: string
  updated_at?: string
  first_published?: string
  location?: { name?: string }
  offices?: { name?: string; location?: string }[]
  departments?: { name?: string }[]
  metadata?: { name?: string; value?: unknown }[] | null
  content?: string
}

const UA = { accept: 'application/json', 'user-agent': 'recruit-bot (personal job search tool)' }

export function normalizeGreenhouseJob(token: string, job: GreenhouseJob): NormalizedPosting | null {
  if (!job.id || !job.title) return null

  // content is HTML wrapped in HTML entities: decode once to get the markup,
  // then convert that markup to text.
  const html = job.content ? decodeEntities(job.content) : null
  const text = html ? htmlToText(html) : ''

  const location = job.location?.name ?? job.offices?.map((o) => o.name).filter(Boolean).join(', ') ?? null
  const comp = compFromMetadata(job) ?? extractComp(text)
  const years = extractYears(text)

  return {
    ats: 'greenhouse',
    board_token: token,
    job_id: String(job.id),
    url: job.absolute_url,
    company: job.company_name?.trim() || token,
    role_title: job.title.trim(),
    location,
    remote_policy: remotePolicyFrom({ location, text }),
    comp_min: comp.min,
    comp_max: comp.max,
    years_min: years.min,
    years_max: years.max,
    description_html: html,
    description_text: text,
  }
}

/** Some boards publish a pay range as a metadata field rather than in the body. */
function compFromMetadata(job: GreenhouseJob): { min: number | null; max: number | null } | null {
  const fields = job.metadata ?? []
  for (const f of fields) {
    if (!f?.name || !/pay|salary|compensation|range/i.test(f.name)) continue
    const value = Array.isArray(f.value) ? f.value.join(' to ') : String(f.value ?? '')
    const parsed = extractComp(value)
    if (parsed.min !== null) return parsed
  }
  return null
}

export async function fetchGreenhouseBoard(token: string): Promise<NormalizedPosting[]> {
  const res = await fetch(BOARD_URL(token), { headers: UA })
  if (!res.ok) throw new Error(`greenhouse ${token}: HTTP ${res.status}`)
  const body = (await res.json()) as { jobs?: GreenhouseJob[] }
  return (body.jobs ?? [])
    .map((j) => normalizeGreenhouseJob(token, j))
    .filter((p): p is NormalizedPosting => p !== null)
}

export function parseGreenhouseUrl(url: string): { token: string; jobId: string } | null {
  const m = /greenhouse\.io\/(?:embed\/job_app\?for=)?([^/?#]+)\/jobs\/(\d+)/i.exec(url)
  if (!m?.[1] || !m[2]) return null
  return { token: m[1], jobId: m[2] }
}

/**
 * The application form schema. This is the highest-value endpoint here: it
 * reveals custom questions ("why us", "most challenging project") before the
 * form is ever opened, so answers can be drafted and reviewed in advance.
 */
export async function fetchGreenhouseQuestions(
  token: string,
  jobId: string,
): Promise<{ raw: unknown; questions: ApplicationQuestion[] }> {
  const res = await fetch(JOB_URL(token, jobId), { headers: UA })
  if (!res.ok) throw new Error(`greenhouse ${token}/${jobId}: HTTP ${res.status}`)
  const raw = (await res.json()) as {
    questions?: {
      label?: string
      required?: boolean
      fields?: { name?: string; type?: string; values?: { label?: string; value?: unknown }[] }[]
    }[]
  }

  const questions: ApplicationQuestion[] = []
  for (const q of raw.questions ?? []) {
    const field = q.fields?.[0]
    if (!field?.name) continue
    const options = field.values?.map((v) => String(v.label ?? v.value ?? '')).filter(Boolean)
    questions.push({
      key: field.name,
      label: (q.label ?? field.name).trim(),
      type: field.type ?? 'input_text',
      required: Boolean(q.required),
      ...(options?.length ? { options } : {}),
    })
  }
  return { raw, questions }
}

/**
 * Questions worth drafting an answer for: free-text prompts, not the resume
 * upload, demographic blocks, or yes/no compliance checkboxes.
 */
export function draftableQuestions(questions: ApplicationQuestion[]): ApplicationQuestion[] {
  const skip = /^(first_name|last_name|name|email|phone|resume|cover_letter|location|org_id|gender|race|veteran|disability|hispanic)/i
  return questions.filter(
    (q) =>
      !skip.test(q.key) &&
      !q.options?.length &&
      /textarea|input_text|long_text/i.test(q.type) &&
      // A short label with no question mark is usually a URL field, not a prompt.
      (q.label.length > 24 || q.label.includes('?')),
  )
}
