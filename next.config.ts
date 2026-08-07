import type { NextConfig } from 'next'

const config: NextConfig = {
  // The review UI reads the pipeline database directly from server components.
  // node:sqlite is a Node builtin, so nothing needs bundling, but the pages
  // that touch it must never be statically prerendered at build time.
  experimental: {
    serverSourceMaps: true,
  },
}

export default config
