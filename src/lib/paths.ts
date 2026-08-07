import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Everything personal lives under data/ and is gitignored. Resolving from the
 * source file rather than cwd means the CLI works from any directory and the
 * Next.js server (which runs from the repo root) agrees with it.
 */
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return resolve(process.cwd())
}

export const REPO_ROOT = findRepoRoot()
export const DATA_DIR = join(REPO_ROOT, 'data')

export const PATHS = {
  repoRoot: REPO_ROOT,
  data: DATA_DIR,
  db: join(DATA_DIR, 'recruit.db'),
  schema: join(REPO_ROOT, 'schema.sql'),
  facts: join(DATA_DIR, 'facts.json'),
  voice: join(DATA_DIR, 'voice.md'),
  config: join(DATA_DIR, 'config.json'),
  handoff: join(DATA_DIR, 'handoff.md'),
  source: join(DATA_DIR, 'source'),
  corpus: join(DATA_DIR, 'corpus'),
  coversArchive: join(DATA_DIR, 'covers-archive'),
  reference: join(DATA_DIR, 'reference'),
  work: join(DATA_DIR, 'work'),
  outCovers: join(DATA_DIR, 'out', 'covers'),
} as const

export type WorkStep = 'score' | 'research' | 'draft' | 'critique'
export const WORK_STEPS: readonly WorkStep[] = ['score', 'research', 'draft', 'critique']

export function workDir(step: WorkStep, bucket: 'pending' | 'results' | 'done'): string {
  return join(PATHS.work, step, bucket)
}
