---
title: Bootstrap the jig
status: active
created: 2026-08-11
updated: 2026-08-11
links: []
---

# Bootstrap the jig

## Goal

A public, hackable project template ("the jig") that stamps out new solo-dev projects with a single repo shape, a shared docs/operating system, and per-stack flavors — plus a generator that does the stamping. A project is "on the jig" when its deviations file is short and every line has a justification.

## Context

This distills several prior projects (TUIs, desktop apps, web apps, mobile games) that were scaffolded in similar ways and succeeded for similar reasons: a living docs system, a session operating protocol, one verify gate, strict tooling defaults, and decisions recorded once with reasoning. The divergences between them (repo topology, hook manager, package manager, release wiring) were accidents of history, not choices — the jig unifies them.

### Decisions already made (record in DECISIONS.md at bootstrap)

1. **One topology.** Every project is a single monorepo: `apps/*` + `packages/*`. The only external repos are **generated satellites** — outputs of the release pipeline (e.g. a Homebrew tap), never places where development happens. Marketing sites live in the monorepo as `apps/www`. Splitting a surface into its own repo requires a written trigger (e.g. a privacy boundary that actually materializes).
2. **Toolchain default: Node (current LTS) + pnpm + Vitest.** **Bun is a scoped exception** for projects whose deliverable is a compiled single-file binary (`bun build --compile`); a Bun project uses Bun for everything (workspaces, install, test) — one toolchain per repo, no hybrids. Picking Bun is recorded in the deviations file.
3. **Framework stack.** Next.js (static-first) for `apps/www` marketing/public sites — step up to dynamic rendering only when needed, recorded as a deviation. Vite + React + shadcn for product web apps. Hono for APIs. Tauri for desktop. Bun + terminal UI for TUIs. Expo/EAS for mobile (later flavor).
4. **Hooks and commits.** Lefthook everywhere (pre-commit: staged lint/format with `stage_fixed`; commit-msg: commitlint conventional; pre-push: the verify gate). Never `--no-verify`.
5. **One gate.** `verify` = typecheck + lint + test. Pre-push, CI, and the definition of done all reference this one command.
6. **Docs system.** `docs/{STATUS,ROADMAP,JOURNAL,DECISIONS}.md` + `docs/plans/{_TEMPLATE.md,active/,done/}`. Session protocol: orient on STATUS → plan before non-trivial work → record decisions/gotchas as they happen → close out docs in the same commit as the code. STATUS stays short (a cursor, not a history — prune or archive past ~150 lines). JOURNAL.md is the canonical learnings file (append-only, newest first, one–two lines per entry, symptom → cause → fix).
7. **Agent files.** `AGENTS.md` is canonical; `CLAUDE.md` is a one-line pointer to it. The jig's root AGENTS.md is **self-contained and public** — it absorbs the previously-global standards (red/green/refactor TDD, naming, TypeScript strictness, commit discipline, learnings protocol, agent session discipline) so projects and other people can inherit it without a private file. Machine-/person-private rules stay out of the jig.
8. **Deviations are documented, never silent.** Each stamped project carries a `DEVIATIONS.md` reconciling it against the jig: what diverged, why, and (where relevant) the trigger to reconverge. Same convention as project-vs-global rule overrides, lifted a level.
9. **Release fan-out is CI-driven.** Tag `v*` → build artifacts → GitHub Release → conditional jobs push to generated satellites (Homebrew tap, etc.), each no-oping honestly when its token/repo variable is absent. Release notes are written before tagging, from a template, and gate the release. Local-only steps (e.g. codesigning/notarization) stay local but hand off to CI for fan-out.
10. **Env convention.** Per-app, root-level: `.env.<app>.example` committed with commented required/optional blocks; `.env.<app>.local` (and other tiers) gitignored via negation pattern. No secrets in the working tree beyond gitignored locals; templates ship only `.example` files.
11. **Discipline tiers are layers, not variants.** Base (hooks + docs + gate) → `+ci` (GitHub Actions verify) → `+public` (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, issue templates, gitleaks scan, publishable-repo hygiene, release fan-out). Public projects also keep marketing copy claims traceable to the code that backs them — one repo makes this a same-commit concern.

## Approach

The repo is three things: (1) a canonical `AGENTS.md` anyone can adopt, (2) a `template/` tree of stampable files organized as base + flavors + layers, (3) a generator script that composes them into a new project. The jig dogfoods its own docs system.

Proposed shape:

```
jig/
  README.md
  AGENTS.md                  # canonical standards, self-contained
  CLAUDE.md                  # pointer to AGENTS.md
  docs/                      # the jig's own STATUS/DECISIONS/JOURNAL/ROADMAP + plans/
  template/
    base/                    # the spine every project gets
      AGENTS.md              # project stub: identity, invariants, deviations pointer
      CLAUDE.md              # pointer
      DEVIATIONS.md          # empty, with instructions
      docs/                  # STATUS/ROADMAP/JOURNAL/DECISIONS + plans/_TEMPLATE.md
      lefthook.yml  commitlint.config.js  .prettierrc  .prettierignore
      eslint.config.js  tsconfig.base.json  .gitignore  .env.app.example
      package.json           # scripts contract: dev/build/typecheck/lint/format/test/verify
      pnpm-workspace.yaml
    flavors/
      api-hono/  web-vite/  www-next/  tui-bun/  desktop-tauri/
      # composable: a project picks one or more (www-next + api-hono + web-vite is the classic trio)
      # tui-bun swaps the toolchain files (bun workspaces, bun test, .bun-version)
    layers/
      ci/                    # .github/workflows/verify.yml (+ commitlint job)
      public/                # LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, issue templates,
                             # gitleaks hook, release.yml fan-out, docs/releases/_TEMPLATE.md
  scripts/
    new-project.mjs          # the generator: prompts/flags → compose base+flavors+layers,
                             # rename placeholders, git init, install, run verify
```

Generator mechanics: a plain `.mjs` script on bare Node (zero deps), driven by flags (`--name`, `--flavors`, `--layers`, `--bun`), with a thin Claude skill wrapper later so an agent can drive it conversationally. Placeholder substitution over copied files; finishes by running the verify gate in the stamped project so a fresh stamp is proven green.

## Steps

- [ ] **Phase 1 — Foundation.** Dogfood docs skeleton for the jig itself (STATUS, ROADMAP, JOURNAL, DECISIONS seeded with the decisions above, plans/). Write the canonical `AGENTS.md`: merge the shareable global standards (language/runtime, style, TS strictness, red/green/refactor TDD, error handling, env, git/commits, dependencies, linting, security, docs, learnings protocol, agent session discipline) with the conventions proven across prior projects (session protocol, invariants/standing-policies pattern, deferral-with-trigger pattern, definition of done). Strip anything machine- or person-private. Add `CLAUDE.md` pointer.
- [ ] **Phase 2 — Base template.** Build `template/base/` (files above), including the docs skeleton with `_TEMPLATE.md`, the root scripts contract, and the `.claude` gitignore block. Base alone must stamp a valid empty project.
- [ ] **Phase 3 — Flavors.** `www-next` (static-first Next), `api-hono` (+ `packages/contracts` and `packages/db` seeds), `web-vite`, `tui-bun` (toolchain swap + compile/release conventions), `desktop-tauri` (minimal: Rust standards delta, lefthook rust hooks). Keep each flavor minimal — seeds, not starter kits.
- [ ] **Phase 4 — Layers.** `ci` (verify workflow + commitlint job) and `public` (hygiene files, gitleaks pre-commit, tag-triggered `release.yml` with conditional satellite fan-out jobs that no-op without config, release-notes template + written-first gate).
- [ ] **Phase 5 — Generator.** `scripts/new-project.mjs` composing base + flavors + layers; stamp a throwaway project of each flavor and prove `verify` green; document usage in README.
- [ ] **Phase 6 — Reconciliation (private, outside this repo).** Use the per-project deviation reports to bring existing projects onto the jig; feed anything they prove back into the template (e.g. auto-discovery CI matrix, smoke-suite pattern, scaffold-a-sub-app script) as optional layers.

## Acceptance criteria

- `AGENTS.md` is self-contained: a stranger could adopt it without access to any private file.
- `node scripts/new-project.mjs --name demo --flavors www-next` produces a repo where `pnpm verify` passes; same for a `tui-bun` stamp with `bun`.
- The `public` layer stamp includes a working tag-triggered release workflow whose satellite jobs no-op cleanly when unconfigured.
- The jig repo itself passes its own session protocol: STATUS current, decisions recorded, this plan moved to `done/` in the closing commit.
- No private project names, tokens, hostnames, or person-specific infrastructure anywhere in the repo (grep-checked).

## Out of scope

- Migrating existing projects (tracked privately in the reconciliation reports).
- An Expo/EAS mobile flavor (deferred — trigger: next mobile project).
- Turborepo/Nx, changesets, shared config packages, Renovate (deferred — trigger: CI wall-time or a second contributor makes them earn their place).
- Multi-contributor guardrails (CODEOWNERS, PR templates, branch protection) as a default — candidate future `+collab` layer, trigger: a second contributor.

## Risks / open questions

- **Flavor composition rules** — which combinations are valid (e.g. `tui-bun` + `www-next` in one Bun workspace) needs a working proof, not just convention.
- **AGENTS.md dual-home** — once the jig's AGENTS.md is canonical, the private global copy should become a thin pointer + private extras; risk of drift between them until that happens.
- **Template staleness** — stamped files (Next/Vite/Hono versions) rot; mitigation: keep flavors minimal and let `pnpm create`-style upstream scaffolds do heavy lifting where possible.
- **Bun compile flow in CI** — cross-platform binary matrix belongs in the `public` layer's release workflow; verify runner costs are acceptable.
