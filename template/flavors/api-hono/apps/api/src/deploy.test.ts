import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import entrypoint from './index'

// The standard: the API has no Vercel project of its own. It deploys as a
// service of the app project, declared in the root vercel.json, so /api/* is
// same-origin. These tests fail when that wiring is removed or bypassed.
type VercelConfig = {
  services: Record<string, { root: string; entrypoint?: string }>
  rewrites: { source: string; destination: unknown }[]
}

const fromRepoRoot = (path: string) =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url))

const config = JSON.parse(
  readFileSync(fromRepoRoot('vercel.json'), 'utf8'),
) as VercelConfig

describe('deploy topology', () => {
  it('serves the API under /api through the deploy entrypoint', async () => {
    const res = await entrypoint.request('/api/health')

    expect(res.status).toBe(200)
  })

  it('declares the API as a service of the app project', () => {
    const api = config.services.api

    expect(api?.root).toBe('apps/api')
    expect(existsSync(fromRepoRoot(`apps/api/${api?.entrypoint}`))).toBe(true)
    expect(config.services.web?.root).toBe('apps/web')
  })

  it('routes /api to the API before the web catch-all', () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/(.*)',
      destination: { service: 'api' },
    })
  })

  it('has no Vercel project of its own', () => {
    // A vercel.json or a `vercel link` here means a second deployment.
    expect(existsSync(fromRepoRoot('apps/api/vercel.json'))).toBe(false)
    expect(existsSync(fromRepoRoot('apps/api/.vercel'))).toBe(false)
  })
})
