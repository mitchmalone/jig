# Roadmap

Phases carry triggers, not dates.

## Phase 1 — Foundation (current)

Docs skeleton, canonical `AGENTS.md`, base template, core flavors, ci/public layers, generator.

## Backlog (deferred, with triggers)

- **Expo/EAS mobile flavor** — trigger: next mobile project.
- **`+collab` layer** (CODEOWNERS, PR template, branch protection, fence script) — trigger: a second contributor on any jig project.
- **Auto-discovery CI matrix** for multi-app repos — trigger: a jig project where per-app CI wall-time hurts.
- **Prod smoke-suite + screenshot-harness pattern** as an optional layer — trigger: second project that wants one.
- **Turborepo/Nx, changesets, shared config packages** — trigger: CI wall-time or publishing needs make them earn their place.
- **Jig self-verify** (stamp-and-verify as the repo's own test suite) — trigger: first template regression that a smoke stamp would have caught.
