# Decisions

Append-only, newest first. Decision, context, reasoning. Decided once — don't relitigate.

## 2026-11-26 — A droid owns a project; Owner is a read-only rollup; repo = project = droid

The backlog's Owner is no longer a select of people and `Code Agent`. It is a read-only rollup of Project → Droid: each project has one droid, and every item's owner is its project's droid. `scripts/session.mjs` never writes Owner. `OWNERS`, `AGENT` and the `--owner` flag on `set` and `raise` are gone, and `--owner` now fails with a message saying Owner is the project's droid. Startable means `Ready`, with no ownership check. Status says whose turn it is: `Triage` (planning), `In Review` and `Blocked` are the owner of the backlog's; `Ready` and `In Progress` are the agent's. Work only a person can do is raised `--status Blocked`, with the blocker kind and reason in the body. `pull` reads the rollup and names the droid in its output and in `backlog.md`, looking each droid page up once and showing "no droid" when the rollup is empty or the page is unreadable. The `In Progress` lock, the session claim and the `--force` rules are unchanged, less the person-item refusal in `start`, which has nothing left to check. This supersedes the owner half of the 2026-11-21 Code Agent decision; its agreement and model rules stand.

Context: Mitch changed the Notion property on 2026-11-26. The old script's `start` kept writing `Owner: Code Agent`, and Notion answered 200 with the page and the rollup unchanged: a write to a rollup is silently dropped, not refused. Nothing would ever have flagged it.

Reasoning: one droid per project makes the repo, the project and the droid the same unit, so any session in the repo works that project's items and an owner per item adds nothing that the project relation does not already say. Status already carries whose turn it is. A silently dropped write is worse than an error, so the script stops making it rather than relying on Notion to complain. No droid config key: the rollup is the source of truth. Stamped projects keep their old script, which still writes Owner harmlessly, until they are reconciled.

## 2026-11-21 — Code Agent covers every agent; agreement promotes an item; Fable for hard tasks

The backlog's agent owner is `Code Agent` alone, standing for every agent: the owner's orchestrating agent (Beebee) running a session, its subagents, or Claude Code run locally by a person. `Beebee` is gone from the Notion Owner options and from `OWNERS`. When the owner of the backlog agrees in a session that an agent takes an item, the agent reassigns it to `Code Agent` and makes it `Ready` itself; that agreement is the promotion. Agreement is the owner of the backlog explicitly telling the agent, in the session, to take that named item; it covers items in `Triage`, `Todo`, `Scheduled` or `Ready`, never one `In Progress`. Subagents run on Opus by default and Fable (`model: "fable"`) for hard tasks.

Projects already stamped (Wriker, for one) keep the old `OWNERS`, with `Beebee`, and the old `/session-start` until they are reconciled. The shared Notion database no longer has that option, so a stamped script's `--owner Beebee` must not be used meanwhile.

Context: Mitch's orchestrating agent runs sessions and delegates. `start` refused any owner but `Code Agent` or none, and set the owner to `Code Agent`, so a separate `Beebee` owner could not be started. Mitch decided one agent label is enough.

Reasoning: who ran a session is already in its handoff, so a second agent label on the item says nothing new and would need the script to learn it. Keeping the refusal of a person's item in `start`, even with `--force`, keeps a session from taking work nobody handed over; the agreed path is one explicit `set`, which the backlog shows.

## 2026-11-21 — Working state moves out of the repo: Notion backlog, Board handoffs and learnings, two session commands

`STATUS.md`, `ROADMAP.md`, `JOURNAL.md` and `plans/` are retired. Work items live in one shared Notion database (The Backlog, each item related to its project). Session handoffs and learnings live on the Vercel Board, one channel per repo. A session's plan and its copy of both live in gitignored `local/session/`. `/session-start` and `/session-end` are stamped into every project and drive a stamped, zero-dependency `scripts/session.mjs`. `DECISIONS.md` stays in the repo. Public repos add a curated `docs/LEARNINGS.md`. The `board-ops` repo of Board conventions is folded into the standard.

Context: Wriker ran a Board handoff routine from an `AGENTS.md` block alone and it did not fire on its own; Mitch had to ask for the handoff after a day of work. And the backlog was spread across one `ROADMAP.md` and one `STATUS.md` per repo, which nobody can manage across projects.

Reasoning:

- **Commands, not instructions.** A routine that depends on the agent remembering a paragraph loses to whatever the session is busy with. A command the person runs, backed by a script with tests, does not.
- **Decisions stay in the repo** because the Board has no versioning, edits in place, and only a shallow text search (`read --text` matches a phrase in one page of threads), and a decision has to be findable months later and reviewable beside the code it constrains. This is the one part of the old system that was doing a job nothing else can.
- **Scripts for the fixed paths, the Notion connector for judgement.** Pulling the backlog and posting a handoff happen every session and should be identical every time; a model composing those calls afresh is slower and varies.
- **`In Progress` is the lock**, re-read live before a claim, so no extra property is needed. It is a check then a write, not atomic: two sessions starting one item within the same second would both succeed. Accepted, because one session per project is the norm and the alternative is a claim property to maintain. No priority field either: one more thing to maintain, and the choice is made in conversation.
- **Learnings are posted when they happen**, and a failed close keeps `local/session/`, with a record of every write that succeeded, for the next `/session-start` to finish without repeating them, because sessions die. Posts carry an idempotency key for the same reason.
- **Board tasks are not used as a backlog.** Their claims are short leases built for swarms; two task systems would drift.

Costs accepted: a session needs network and two logins (`ntn`, `vercel`) to start; learnings and handoffs are no longer versioned with the code; the Board is experimental and US-hosted. Reconverge trigger: the Board changes terms or loses data — learnings move into the repo beside the decisions. The owner's team and data source are generator defaults (`--board-scope`, `--backlog`), not secrets; a fork passes its own.

**The jig follows its own rule.** It has an entry in the projects database, its roadmap and status items are in The Backlog (22 items), and its journal is on the `jig` channel (52 learnings). Its `STATUS.md`, `ROADMAP.md`, `JOURNAL.md` and `plans/` are deleted; git history keeps them. It reaches the template's commands and script by symlink rather than carrying a copy, so the jig runs exactly what it stamps. The jig is a public repo, so it carries a curated `docs/LEARNINGS.md` like any other. `board-ops` is retired: its folder is deleted and its conventions live here.

Deferred: a hook that closes a session automatically (trigger: a session is lost without `/session-end` more than once); a Board profile per session (trigger: two sessions on one project at once become routine); agents other than Claude Code.

## 2026-11-13 — The one-project deploy is implemented with Vercel Services, and it is stamped and gated

The 2026-08-11 topology stands (two Vercel projects per product; the API rides in the app project). What changes is the mechanism and where it lives. Mechanism: the root `vercel.json` declares `web` and `api` as Vercel Services of one project rooted at the repo, replacing the planned catch-all function inside `apps/web` — Services builds each app with its own framework preset, bundles workspace packages, and deploys both atomically, with no hand-written function wrapper. Where it lives: in the template and in the stamp's `verify`, not only in the standard. Context: the standard said "don't give the API its own project" from day one, but the template shipped a standalone Node server and no Vercel config, so every project rebuilt the wiring by hand and the easy path was a third project — the rule was being held up by memory. Reasoning: a standard clause that can be an artifact plus a failing test should be; prose alone loses to whatever is quickest on the day. Known limit: nothing in a repo can see the Vercel dashboard, so a hand-made third project is only caught locally (a `vercel link` in `apps/api` fails the test). Add a Vercel-API check if that ever actually happens.

## 2026-11-13 — The jig's own gate: zero-dependency tests, no formatter over the template

The jig gets a pnpm root as a gate runner (lefthook, commitlint, gitleaks) and `verify` = `node --check` on the scripts + `node --test` generator tests + smoke stamps that install and run each composition's own gate. Context: a placeholder regression shipped in every web stamp for three months because the jig had no gate, which fired the roadmap's self-verify trigger. Two departures from the standard, both deliberate. Tests use `node:test`, not Vitest: the generator is a zero-dependency script and its tests should not need an install to run. And there is no Prettier/ESLint pass over the repo: template files are not valid source until stamped (placeholders in identifiers, YAML keys, file names), and a formatter over them is exactly what caused the bug — formatting and lint are asserted where they are meaningful, inside the smoke stamps. Reconverge trigger for the formatter: a placeholder-aware format step (see ROADMAP).

## 2026-11-13 — `--title` is separate from `--name`; unsafe titles are refused, not escaped

`--name` stays the machine identifier (kebab-case: package names, binary names, bundle id suffix); `{{PROJECT_TITLE}}` is the human name used in headings, page titles and the app display name, defaulting to the name in Title Case. A title containing quotes, backslashes, `<>`, `{}` or `&` is rejected. Reasoning: the title lands in TS strings, HTML, YAML and Markdown, and per-file-type escaping in a zero-dependency generator is more machinery than a one-time `--title` deserves; an awkward title is a one-line edit after stamping.

## 2026-09-05 — Swift repos have no CI verify job; runners are for releases only

The `ci` layer refuses to compose with `desktop-swift`. The pre-push hook on the developer's Mac is the gate; GitHub macOS runners are used only for tag-triggered release builds. Context: the flavor initially shipped a macOS `verify` workflow. Reasoning (Mitch): the code is already built and verified on a Mac before every push, so a runner re-doing it buys nothing and macOS minutes bill at 10× Linux on private repos. Reconverge trigger: a second contributor on a Swift project, where "green on my Mac" stops being a shared fact.

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
