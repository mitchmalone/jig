# Status

The cursor. Done / in progress / next / blocked. Keep it short.

## Done

- Session system (2026-11-21): stamps no longer carry `STATUS.md`, `ROADMAP.md`, `JOURNAL.md` or `plans/`. Each gets `/session-start` and `/session-end` (`.claude/skills/`), `scripts/session.mjs` (Notion backlog via `ntn`, Board handoffs and learnings via `vercel board`, `local/session/` as the session's copy) and `session.config.json`; public stamps get a curated `docs/LEARNINGS.md`. The standard's docs system became "Working State" and absorbed the `board-ops` conventions. The script was run live against Wriker's backlog and channel (`pull`) and the `jig` channel (`learn`, 48 posted). The jig itself stays on these in-repo docs — see DECISIONS 2026-11-21.
- Stamp-rot pass (2026-11-13): fixed the project-name bug (Prettier had reshaped `{{PROJECT_NAME}}` in JSX; the generator now fails on any surviving placeholder), added `--title`/`{{PROJECT_TITLE}}`, strict name validation, gitleaks as a lefthook fragment so `public` composes with Bun and Swift, `desktop-swift` + `public` stamping, the Infisical `.envrc.example` in place of dotenv examples, and toolchain-aware stamped docs. Dependencies moved to current majors (pnpm 12, vitest 5, `@hono/node-server` 2, `@vitejs/plugin-react` 6, Actions v7/v6).
- Deploy topology is stamped and gated, not just written down (2026-11-13): `web-vite` + `api-hono` stamps carry a root `vercel.json` declaring web and api as two Vercel Services of one project, the API mounts at `/api` with a deploy entrypoint, `apps/www/vercel.json` carries the site's ignore step, and `apps/api/src/deploy.test.ts` fails the stamp's gate if the wiring is removed or the API gets a Vercel config/link of its own. The smoke stamp runs a real offline `vercel build` for both projects.
- The jig verifies itself: `pnpm verify` = script syntax check + generator tests (`node --test`) + stamp-install-verify of the pnpm, Bun and Swift compositions; lefthook pre-push and CI run it.
- `desktop-swift` flavor (2026-09-05): native Apple apps — pnpm root as gate runner, XcodeGen `project.yml`, pure SwiftPM `packages/*` with Swift Testing, swift-format, env-driven signing. No CI verify job for Swift repos — pre-push hook is the gate, runners for releases only. Smoke stamp passes `verify`. Generator grew `{{PROJECT_PASCAL}}`, `{{BUNDLE_ID}}`/`--bundle-id`, token substitution in paths, and a toolchain-keyed CI-variant picker.
- Canonical `AGENTS.md` (self-contained, public), docs system, founding decisions.
- Env/secrets standard replaced: Infisical for every tier — workspace pointer committed, direnv + CLI for dev, no real value on disk (2026-08-14 decision, driven by triviabard's reconvergence).
- Database default decided: Neon via Vercel Marketplace, region a swappable locality default (2026-08-14 decision).
- `template/` built: base spine, five flavors (www-next, api-hono, web-vite, tui-bun, desktop-tauri), two layers (ci, public).
- `scripts/new-project.mjs` generator, smoke-tested: a pnpm stamp (www-next + api-hono + web-vite + ci + public) and a Bun stamp (tui-bun + ci) both pass their full `verify` gate; `bun build --compile` produces a working binary.
- Bootstrap plan closed → `plans/done/`.

## In progress

- Nothing.

## Next

- Reconcile Wriker to the session system, in Wriker's own session: add the script, commands and `session.config.json`; replace its `AGENTS.md` Board routine block; move its roadmap, status items and its one open Board task into The Backlog; move its journal to the `wriker` channel; retire the old docs; refresh `docs/STANDARDS.md`. Then Scuttler (public: keep a curated `docs/LEARNINGS.md`; ~1,400 journal lines, so label learnings by topic).
- Not yet exercised live: `start`, `set`, `raise` and `close` (covered by tests only), and a whole `/session-start` → `/session-end` round trip. Wriker's first session is the proof; journal what it shows.
- Retire `board-ops` (Mitch deletes the folder; its conventions are in the standard and its setup notes in the README). Two Board tasks are still open, one in `board-ops` and one in `wriker`.
- First real deploy of a stamped web+api project: two things a local `vercel build` cannot prove — that per-service `ignoreCommand` skips as intended (it fails safe: an error builds), and that Vercel Services needs no opt-in on the account (the build output still labels it `experimentalServicesV2`). Journal what it shows.
- Audit the standard for other prose-only rules: mark each clause stamped, gated, or prose, and close the ones worth closing (candidates: no raw `process.env` outside `env.ts` as a lint rule; project-unique ports).
- Fleet reconciliation, on next touch of each stamped project: fix `{{ PROJECT_NAME }}` in `apps/web/src/app.tsx` / `apps/www/src/app/page.tsx` if still present, move gitleaks to `.lefthook/gitleaks.yml`, vendor `docs/STANDARDS.md` in private projects (2026-08-12 decision), replace `.env.*.example` with `.envrc.example`, and collapse any separate API Vercel project into the app project's `vercel.json` services.
- Unpark note: the create-jig PR branch's `compose.mjs` predates every-stamp vendoring, the placeholder guard, and the lefthook fragments — port all three when unparking.
- Swift release pipeline — see ROADMAP.

## Watching

- TypeScript 7: held at `^6` until typescript-eslint's peer range (`<6.1.0` as of 8.72) admits it.
- Node 26: template stays on 24 until the dev machines move; bump `engines`, the CI `node-version`, and `@types/node` together.
- `minimatch` GHSA-g3hv-75wg-m249 (moderate) arrives transitively through the lint toolchain in every stamp; clears when upstream moves to `minimatch` 11. Not overridden — forcing a major under ESLint is the bigger risk.

## Blocked

- Nothing.
