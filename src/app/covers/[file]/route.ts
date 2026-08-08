import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readConfig } from '@/lib/facts'
import { PATHS } from '@/lib/paths'

/**
 * Serves a rendered cover letter over HTTP so the fill payload can fetch it
 * from the ATS page. A file input only accepts bytes the page can read, and
 * the page cannot read the disk, so the PDF has to arrive over the wire with
 * CORS open.
 *
 * This serves one directory and only PDFs in it. The name is a basename or it
 * is rejected: a request that walks out of the covers directory reaches the
 * rest of data/, which is everything personal in this repo.
 */

export const dynamic = 'force-dynamic'

const CORS = { 'Access-Control-Allow-Origin': '*' } as const

function coversDir(): string {
  const configured = readConfig().uploads?.covers_dir
  return configured && existsSync(configured) ? configured : PATHS.outCovers
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params
  const name = decodeURIComponent(file)

  if (name.includes('/') || name.includes('\\') || name.includes('..') || !name.toLowerCase().endsWith('.pdf')) {
    return new Response('cover letters are served by basename, and only PDFs', { status: 400, headers: CORS })
  }

  const path = join(coversDir(), name)
  if (!existsSync(path)) {
    return new Response('no such cover letter', { status: 404, headers: CORS })
  }

  return new Response(new Uint8Array(readFileSync(path)), {
    headers: { ...CORS, 'Content-Type': 'application/pdf' },
  })
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' },
  })
}
