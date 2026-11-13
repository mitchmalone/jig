import { healthSchema } from '@{{PROJECT_NAME}}/contracts'
import { describe, expect, it } from 'vitest'

import { app } from './app'

describe('GET /api/health', () => {
  it('returns a contract-valid health payload', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(healthSchema.parse(await res.json()).status).toBe('ok')
  })
})
