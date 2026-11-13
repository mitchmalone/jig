---
title: Stamp rot, project-name bug, and jig self-verify
status: done
created: 2026-11-13
updated: 2026-11-13
links: []
---

# Stamp rot, project-name bug, and jig self-verify

## Goal

A stamp never ships an unsubstituted placeholder again, every documented flavor/layer composition stamps and passes its gate, and the jig has its own `verify` so the next regression is caught before a project is.

## Context

Commit `ef6ba7a` ran Prettier over the template; in JSX `{{PROJECT_NAME}}` is an object literal, so it became `{{ PROJECT_NAME }}` and the exact-match substitution missed it. Every `www-next`/`web-vite` stamp since has shipped the raw token. A pass over the jig also found: `desktop-swift` + `public` cannot be stamped, `public` overwrites the Bun/Swift `lefthook.yml` with pnpm commands, `my-`/`a--b` names crash, the display name is the kebab name, and several dependency majors and docs have drifted.

## Approach

Fix the hazard (no tokens in JSX expression position), make the generator fail on any leftover token, and give the jig a zero-dependency test suite plus a smoke-stamp gate. Then fix composition, naming, and drift under that gate.

## Steps

- [x] Commit the pending Next/Vercel ignore fixes.
- [x] Generator tests (`node --test`) + leftover-token guard + JSX tokens moved into strings.
- [x] Jig root gate: `package.json`, lefthook, commitlint, CI workflow, smoke stamps.
- [x] Composition: `public` layer adds gitleaks via a lefthook fragment; CI-variant picker only runs for the `ci` layer.
- [x] Naming: strict kebab validation, `--title` / `{{PROJECT_TITLE}}`.
- [x] Tidy: Infisical recipe replaces `_env.api.example`, toolchain-aware commands in stamped docs, README.
- [x] Dependency and Actions bumps, verified by smoke stamps.
- [x] Deploy topology (added after review): web + api as Vercel Services in one project, stamped and gated.
- [x] Docs close-out.

## Acceptance criteria

- `pnpm verify` in the jig is green: fast generator tests plus full stamp-and-verify of the pnpm, Bun, and (on a Mac) Swift compositions.
- A template containing `{{ PROJECT_NAME }}` makes the generator exit non-zero.

## Out of scope

- Node 26 as the baseline (dev machines are on 24).
- TypeScript 7 (typescript-eslint still peers on `<6.1.0`).
- Fleet reconciliation of already-stamped projects.

## Risks / open questions

- Major bumps (pnpm 12, vitest 5, `@hono/node-server` 2) may need template changes; any that fail the smoke stamp are held back and recorded with a trigger.
