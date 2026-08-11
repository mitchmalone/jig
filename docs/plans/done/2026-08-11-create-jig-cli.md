---
title: create-jig CLI
status: done
created: 2026-08-11
updated: 2026-08-11
links: []
---

# create-jig CLI

## Goal

`npm create jig` — a zero-dependency CLI that does the deterministic half of project setup (prompt → compose → git → install), then detects the user's coding agent and hands off the judgment half via a pre-stamped onboarding plan. Not published yet; runnable locally from the repo.

## Context

The generator (`scripts/new-project.mjs`) already does mechanical composition. The CLI wraps it for strangers: interactive prompts, template resolution that works outside a checkout (GitHub tarball fetch), agent detection, and a first-session kickoff that teaches the session protocol by being an active plan.

## Approach

- `create-jig/` package at repo root: `bin/create-jig.mjs` + `src/{compose,prompts,agents}.mjs` + `node --test` tests. `"private": true` until release; publishing later joins the tag-triggered fan-out.
- Extract stamp logic from `scripts/new-project.mjs` into `create-jig/src/compose.mjs`; the generator becomes a thin flag-driven wrapper importing it (second-use rule — the CLI is the second consumer).
- Template resolution: local `template/` when running inside a jig checkout; otherwise fetch the repo tarball from GitHub and extract via the system `tar`.
- Agent handoff: stamp `docs/plans/active/0000-onboard.md` into every project (added to `template/base`); detect agents on PATH (claude, cursor-agent, codex, opencode, gemini); offer to launch the detected agent with "Follow docs/plans/active/0000-onboard.md", print the prompt as fallback.

## Steps

- [x] Onboarding plan in `template/base/docs/plans/active/0000-onboard.md`
- [x] `compose.mjs` extracted, `new-project.mjs` refactored onto it
- [x] `prompts.mjs` (readline), `agents.mjs` (detect + launch), `bin/create-jig.mjs`
- [x] Tests (`node --test`) for arg parsing, compose fixups, agent detection
- [x] Smoke: stamp via the CLI in flags mode; tests green
- [x] README usage section

## Acceptance criteria

- `node create-jig/bin/create-jig.mjs --name demo --flavors api-hono --layers ci --yes` stamps a project whose verify gate passes.
- `node --test create-jig/test/` green.
- Fresh stamps carry `0000-onboard.md`; generator prints the handoff prompt.

## Out of scope

- npm publish (trigger: announcing the repo publicly).
- `jig doctor` / `jig reconcile` (trigger: first outside adopter or next manual fleet reconciliation).

## Risks / open questions

- Tarball fetch needs network + system `tar`; acceptable, fallback is cloning the repo.
- `create-jig` npm name availability unchecked — irrelevant until publish.
