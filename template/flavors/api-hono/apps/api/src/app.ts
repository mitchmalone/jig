import { healthSchema } from '@{{PROJECT_NAME}}/contracts'
import { Hono } from 'hono'

export const app = new Hono()

app.get('/health', (c) =>
  c.json(healthSchema.parse({ status: 'ok', version: '0.0.0' })),
)
