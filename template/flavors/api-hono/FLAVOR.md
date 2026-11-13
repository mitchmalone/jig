# api-hono

Hono API at `apps/api` with the two keystone packages: `packages/contracts` (Zod schemas — the single source of truth for shapes) and `packages/db` (schema stub — swap in your ORM/driver). Env is Zod-parsed in `src/env.ts`; no raw `process.env` anywhere else. `env.ts` is the manifest of what the app needs; values come from Infisical via direnv (see `.envrc.example`).

Auth: **Better Auth**, mounted in this app when the product needs accounts — server-side only, same-origin cookies (which the functions-in-app-project deploy makes trivial).

Deploy: the API does **not** get its own Vercel project. The root `vercel.json` declares two [Vercel Services](https://vercel.com/docs/services) in one project — `web` (the Vite build) and `api` (this app, entrypoint `src/index.ts`) — with `/api/*` rewritten to the API, so it is genuinely same-origin and both ship in one atomic deployment. The Vercel project's Root Directory is the repo root. The app is mounted with `basePath('/api')` because Vercel and the Vite dev proxy both forward the original path. `src/deploy.test.ts` fails the gate if the wiring is removed or `apps/api` grows a Vercel config or link of its own. Crons ride along in the same `vercel.json`.

Stamped without `web-vite`, the generator leaves `vercel.json` and that test out — an API-only product chooses its deploy and records it in `DEVIATIONS.md`.
