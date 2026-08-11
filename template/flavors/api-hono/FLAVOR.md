# api-hono

Hono API at `apps/api` with the two keystone packages: `packages/contracts` (Zod schemas — the single source of truth for shapes) and `packages/db` (schema stub — swap in your ORM/driver). Env is Zod-parsed in `src/env.ts`; no raw `process.env` anywhere else. The committed `.env.api.example` documents every var.
