# Decisions

Append-only, newest first. Decision, context, reasoning. Decided once — don't relitigate.

## 2026-08-11 — Founding decisions

Distilled from several prior projects (TUIs, desktop, web, mobile) whose scaffolding converged. Full context in `plans/active/2026-08-11-bootstrap-the-jig.md`.

1. **One topology.** Every project is a single pnpm monorepo (`apps/*` + `packages/*`). External repos are generated satellites only (release outputs, e.g. a Homebrew tap). The prior "website beside the app repo" arrangement was an accident of history; it duplicated tooling by convention copy and forced hand-synced code ports that a workspace package dissolves.
2. **Toolchain default: Node LTS + pnpm + Vitest.** Bun only when the deliverable is a compiled single-file binary; then Bun everywhere in that repo — no hybrid toolchains, Bun trips on pnpm's symlinked layout and two lockfiles isn't worth it.
3. **Next.js static-first for `apps/www`**; Vite+React+shadcn for product apps; Hono for APIs; Tauri for desktop. Astro rejected: marginal gain for single-page marketing, second framework cost, and it would break workspace code-sharing with React apps.
4. **Lefthook + commitlint everywhere.** (Husky and hook-less repos existed; standardize.)
5. **One `verify` gate** referenced by pre-push, CI, and the definition of done.
6. **Docs system** (STATUS/ROADMAP/JOURNAL/DECISIONS/plans + session protocol) is the engine of these projects' success — it ships in base, not as an option. STATUS gets a size discipline (~150 lines) after observing a 4,000-line STATUS defeat its own purpose at scale.
7. **`AGENTS.md` canonical, `CLAUDE.md` a pointer.** The jig's AGENTS.md is self-contained and public so projects and strangers can inherit it without any private file.
8. **Deviations documented, never silent** — per-project `DEVIATIONS.md`.
9. **Release fan-out is CI-driven** (tag → build → release → satellite jobs that no-op when unconfigured); release notes written first, gating the release. Local steps survive only where physics demands it (codesigning/notarization).
10. **Env convention**: committed `.env.<app>.example`, gitignored tiers, no secrets in the tree.
11. **Discipline tiers are additive layers** (base → `+ci` → `+public`), not template variants. Public projects vendor the canonical standard so they stand alone; private projects may resolve it from the machine's global copy.
