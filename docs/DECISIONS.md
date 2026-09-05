# Decisions

Append-only, newest first. Decision, context, reasoning. Decided once — don't relitigate.

## 2026-09-05 — Native Swift is the Apple-only app stack; the pnpm root stays as the gate runner

Apple-only apps (macOS/iPadOS) are written in Swift via the `desktop-swift` flavor: pure SwiftPM packages under `packages/*` hold all logic and tests (`swift test`, no Xcode, no signing), a thin SwiftUI target under `apps/app` is described by an XcodeGen `project.yml`, and the `.xcodeproj` is generated and gitignored. Swift 6 language mode, complete concurrency checking, Swift Testing, and Xcode-bundled `swift-format`. The pnpm root survives purely to run the gate (lefthook, commitlint, prettier for docs); TypeScript tooling is stripped. Signing is environment-driven (`DEVELOPMENT_TEAM` via `.envrc`), so an unset team yields an unsigned build and CI/fresh clones always verify. Context: Fenestre needs CloudKit, app sandbox, and per-workspace WebKit data stores, which a Tauri shell reaches only through plugins and a Rust bridge. Reasoning: the jig bar is hackable and agent-friendly — every artefact is a text file an agent can edit and every step runs from the shell; XcodeGen and SwiftPM make that true where a raw `.pbxproj` would not. Tauri stays the cross-platform desktop choice. Rejected: Tuist (heavier, its own DSL and cache), SwiftLint (a second tool where swift-format already lints), dropping the pnpm root (commitlint has no non-npm equivalent and the docs formatter would go with it).

## 2026-08-14 — Infisical is the env/secret source for every tier

The standard's per-app dotenv scheme (`.env.<app>.example` committed, `.env.<app>.local` gitignored, `infra` reserved scope for operator creds) is replaced by Infisical: one workspace per project, `.infisical.json` committed (pointer only), direnv + Infisical CLI injecting the dev shell, deploy platforms fed by integration or synced export. No real env value lives on disk, gitignored or not; `env.ts` (Zod-parsed) is the manifest of what an app needs, superseding `.example` files. Context: triviabard hit the old standard's own reconvergence trigger ("prefer a secret manager; in-tree prod creds are a recorded deviation") and Mitch ruled the fix should be the standard, not a per-project deviation. Reasoning: gitignored real values are one `git add -f` or one stolen laptop from disaster, `.example` files drift from the Zod manifest that actually gates startup, and a secret manager makes the operator-credential story identical to the app-env story instead of a special case. Templates still ship `_env.api.example` — reconcile the flavor templates to ship `.infisical.json` placeholders + an `.envrc` recipe when the next project is stamped (trigger, not date).

## 2026-08-14 — Neon is the default database, managed via Vercel

When a project needs a database, it uses Neon Postgres provisioned through the Vercel Marketplace integration, not a self-managed Postgres or another provider. Context: the standard previously prescribed no database at all, leaving each project to improvise. Reasoning: the Vercel integration keeps billing, env injection, and preview-branch databases inside the existing two-projects-per-product deploy topology with zero extra credentials to manage, and Neon's branching maps cleanly onto preview deploys. Region defaults to `aws-ap-southeast-2` (Sydney) — that's a personal locality default, not an architectural choice; adopters of the standard change the region per project freely, no deviation entry required.

## 2026-08-12 — The jig is a stamp, not a runtime dependency

Every stamp vendors the full standard into the project (`docs/STANDARDS.md`); the in-repo copy governs thereafter, and no file inside or outside a project points at the jig repo as live authority. The machine-global AGENTS.md carries personal context only, zero standards authority. Reasoning: a live reference is redundant next to the vendored copy, can fight a project's legitimate deviations as the jig evolves, and leaks jig rules into repos that follow other conventions (forks, team projects). Jig updates reach projects only through deliberate reconciliation.

## 2026-08-12 — One shared Homebrew tap per owner (standing policy)

All Homebrew-distributing projects publish into the single shared tap (`<owner>/homebrew-tap`): formulae in `Formula/`, casks in `Casks/`, installs as `brew install <owner>/tap/<name>`. Per-project `homebrew-<project>` repos are never created (the one that existed is archived). Config pair per app repo: `vars.HOMEBREW_TAP_REPO` + `secrets.HOMEBREW_TAP_TOKEN` (one fine-grained PAT, Contents r/w, scoped to the tap). The token lives only on GitHub; local release scripts never push to the tap — fan-out is CI's job. Context: consolidating two per-project taps ahead of open-sourcing several more packages; one satellite instead of N, one credential instead of N.

## 2026-08-11 — Two Vercel projects per product, not three

The API deploys as serverless functions inside the web app's Vercel project (static Vite build + `api/` functions coexist in one project; Hono collapses to a catch-all function) rather than as its own project. Context: three projects per product was bloating the dashboard and forced cross-project `/api/*` rewrites for same-origin auth cookies. Same-origin becomes real, one less deploy per push; coupling cost is nil since the apps share a monorepo. `www` stays separate — different framework, and one project can't serve two builds. Ignored Build Steps keep unaffected projects from redeploying.

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
