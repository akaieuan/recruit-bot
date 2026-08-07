import { existsSync, readFileSync } from 'node:fs'
import { PATHS } from './paths.ts'
import type { Fact } from './types.ts'

export interface Gap {
  id: string
  text: string
  /** Vocabulary that signals this gap is being claimed. */
  patterns: string[]
}

export interface FactLibrary {
  generated_at: string
  source: string
  facts: Fact[]
  gaps: Gap[]
}

export interface Config {
  name: string
  location: string
  email: string
  links: Record<string, string[]> & { design: string[] }
  confirm?: string[]
}

let factsCache: FactLibrary | undefined
let configCache: Config | undefined

export function readFacts(): FactLibrary {
  if (factsCache) return factsCache
  if (!existsSync(PATHS.facts)) {
    throw new Error(`no fact library at ${PATHS.facts}. Run: pnpm cli import source`)
  }
  factsCache = JSON.parse(readFileSync(PATHS.facts, 'utf8')) as FactLibrary
  return factsCache
}

export function readConfig(): Config {
  if (configCache) return configCache
  if (!existsSync(PATHS.config)) {
    throw new Error(`no config at ${PATHS.config}. Run: pnpm cli import source`)
  }
  configCache = JSON.parse(readFileSync(PATHS.config, 'utf8')) as Config
  return configCache
}

/** Test seam: lets a test supply a library without touching data/. */
export function setFactsForTesting(library: FactLibrary | undefined): void {
  factsCache = library
}

export function factById(id: string): Fact | undefined {
  return readFacts().facts.find((f) => f.id === id)
}

export function factIds(): Set<string> {
  return new Set(readFacts().facts.map((f) => f.id))
}

/** Resolves ids to facts, reporting any that do not exist. */
export function resolveFacts(ids: string[]): { found: Fact[]; unknown: string[] } {
  const library = readFacts()
  const byId = new Map(library.facts.map((f) => [f.id, f]))
  const found: Fact[] = []
  const unknown: string[] = []
  for (const id of ids) {
    const fact = byId.get(id)
    if (fact) found.push(fact)
    else unknown.push(id)
  }
  return { found, unknown }
}

export function searchFacts(query: string): Fact[] {
  const q = query.toLowerCase()
  return readFacts().facts.filter((f) => f.text.toLowerCase().includes(q) || f.id.includes(q))
}
