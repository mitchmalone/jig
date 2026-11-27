import { z } from 'zod'

// The only file that reads process.env. Everything else imports `env`.
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(8787),
})

export const env = envSchema.parse(process.env)
