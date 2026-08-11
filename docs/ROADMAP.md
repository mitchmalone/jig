# Roadmap

Phases carry triggers, not dates.

## Phase 1 — Foundation (current)

Docs skeleton, canonical `AGENTS.md`, base template, core flavors, ci/public layers, generator.

## Backlog (deferred, with triggers)

- **Expo/EAS mobile flavor** — trigger: next mobile project.
- **`daemon-bun` flavor** (long-running background service: launchd plist + systemd unit templates, install/uninstall scripts, offline event spool, darwin-arm64 + linux-arm64 compile matrix in the release workflow) — trigger: the fleet-monitor project's daemon stabilizes, or a second project needs a background service. Build in-project first, upstream what proves out.
- **`+collab` layer** (CODEOWNERS, PR template, branch protection, fence script) — trigger: a second contributor on any jig project.
- **Auto-discovery CI matrix** for multi-app repos — trigger: a jig project where per-app CI wall-time hurts.
- **Prod smoke-suite + screenshot-harness pattern** as an optional layer — trigger: second project that wants one.
- **Turborepo/Nx, changesets, shared config packages** — trigger: CI wall-time or publishing needs make them earn their place.
- **Jig self-verify** (stamp-and-verify as the repo's own test suite) — trigger: first template regression that a smoke stamp would have caught.
