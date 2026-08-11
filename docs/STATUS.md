# Status

The cursor. Done / in progress / next / blocked. Keep it short.

## Done

- Canonical `AGENTS.md` (self-contained, public), docs system, founding decisions.
- `template/` built: base spine, five flavors (www-next, api-hono, web-vite, tui-bun, desktop-tauri), two layers (ci, public).
- `scripts/new-project.mjs` generator, smoke-tested: a pnpm stamp (www-next + api-hono + web-vite + ci + public) and a Bun stamp (tui-bun + ci) both pass their full `verify` gate; `bun build --compile` produces a working binary.
- Bootstrap plan closed → `plans/done/`.

## In progress

- `create-jig` CLI (PR): interactive stamp + agent detection + `0000-onboard.md` handoff. Unpublished — npm publish deferred (trigger: announcing the repo publicly).

## Next

- Reconcile existing private projects against the jig (tracked privately, outside this repo).
- First real stamp will shake out template rot — journal anything it catches.

## Blocked

- Nothing.
