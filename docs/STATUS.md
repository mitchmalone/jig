# Status

The cursor. Done / in progress / next / blocked. Keep it short.

## Done

- Canonical `AGENTS.md` (self-contained, public), docs system, founding decisions.
- Database default decided: Neon via Vercel Marketplace, region a swappable locality default (2026-08-14 decision).
- `template/` built: base spine, five flavors (www-next, api-hono, web-vite, tui-bun, desktop-tauri), two layers (ci, public).
- `scripts/new-project.mjs` generator, smoke-tested: a pnpm stamp (www-next + api-hono + web-vite + ci + public) and a Bun stamp (tui-bun + ci) both pass their full `verify` gate; `bun build --compile` produces a working binary.
- Bootstrap plan closed → `plans/done/`.

## In progress

- Nothing.

## Next

- Fleet follow-up: copy-not-reference semantics (2026-08-12 decision) means already-reconciled PRIVATE projects should vendor `docs/STANDARDS.md` and reword their AGENTS.md "Standard" section on next touch — only the two public repos vendored it.
- Unpark note: the create-jig PR branch's `compose.mjs` still has public-only vendoring — port the every-stamp vendoring change when unparking.
- First real stamp will shake out template rot — journal anything it catches.

## Blocked

- Nothing.
