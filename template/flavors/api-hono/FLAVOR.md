# api-hono

Hono API at `apps/api` with the two keystone packages: `packages/contracts` (Zod schemas — the single source of truth for shapes) and `packages/db` (schema stub — swap in your ORM/driver). Env is Zod-parsed in `src/env.ts`; no raw `process.env` anywhere else. The committed `.env.api.example` documents every var.

Auth: **Better Auth**, mounted in this app when the product needs accounts — server-side only, same-origin cookies (which the functions-in-app-project deploy makes trivial).

Deploy: the API does **not** get its own Vercel project — it ships as serverless functions inside the web app's project (one catch-all function wrapping the Hono app), making `/api/*` genuinely same-origin. Crons and MCP endpoints ride along in that project's config.
