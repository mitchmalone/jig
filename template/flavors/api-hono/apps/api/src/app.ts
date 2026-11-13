import { healthSchema } from '@{{PROJECT_NAME}}/contracts'
import { Hono } from 'hono'

// Mounted at /api in dev (Vite proxy) and in production (Vercel rewrite) —
// both forward the original path, so the prefix lives here.
export const app = new Hono().basePath('/api')

app.get('/health', (c) =>
  c.json(healthSchema.parse({ status: 'ok', version: '0.0.0' })),
)
