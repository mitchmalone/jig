# jig

A hackable solo-dev project template. One repo shape, one set of operating rules, stamped into every new project.

A **jig** is a workshop tool: it holds the work steady and guides the cut, so every piece comes out the same. This repo does that for software projects — it carries the decisions that don't need re-making (repo layout, docs system, hooks, gates, release wiring) so each new project starts at full speed and stays consistent with its siblings.

## Usage

```sh
node scripts/new-project.mjs --name my-thing \
  --flavors www-next,api-hono,web-vite \
  --layers ci,public
```

Compose order: `base` → flavors → layers (later files win). The stamp ends with a git repo whose `verify` gate (typecheck + lint + format check + test) passes after install. The generator refuses to finish if any `{{PLACEHOLDER}}` survives substitution.

- **Flavors** — `www-next` (static-first marketing site), `api-hono` (+ Zod contracts and db seed packages; with `web-vite`, deploys as one Vercel project via a root `vercel.json`), `web-vite` (product web app), `tui-bun` (Bun toolchain swap for compiled-binary CLIs/TUIs), `desktop-tauri` (Rust standards delta; scaffold the app from upstream), `desktop-swift` (native Apple app: pure SwiftPM packages + XcodeGen-described SwiftUI app, Swift Testing, swift-format).
- **Layers** — `ci` (GitHub Actions running the same verify gate as the pre-push hook), `public` (LICENSE, CONTRIBUTING, issue templates, gitleaks as a lefthook fragment, tag-triggered release fan-out to generated satellite repos). `ci` does not apply to `desktop-swift`.
- Flags: `--title` (human-facing name for headings and page titles; defaults to the kebab name in Title Case), `--dir`, `--author`, `--bundle-id` (Swift apps), `--board-scope` and `--backlog` (see Sessions), `--no-git`, `--verify` (install + run the gate immediately).
- Every stamp vendors the standard as `docs/STANDARDS.md`, records the jig commit and its composition in `.jig.json`, and ships an `.envrc.example` with the Infisical + direnv recipe.

## Re-stamping

A stamped project is brought to the latest jig by re-running the stamp over it, from a jig checkout:

```sh
node scripts/restamp.mjs ../my-thing            # dry run: report only
node scripts/restamp.mjs ../my-thing --apply    # write what the jig owns
```

- **Jig-owned files are replaced whole**: `docs/STANDARDS.md`, `scripts/session.mjs`, the two session commands, and the rest of the owned list.
- **Shared files are never written**: root `package.json`, `lefthook.yml`, `tsconfig.base.json`, the ESLint, Prettier and commitlint configs, `.gitignore`, workflows. The report shows how each differs from today's jig, for a person or an agent to merge.
- **Project files are never touched**: `AGENTS.md`, `DEVIATIONS.md`, `docs/DECISIONS.md`, `session.config.json`, everything under `apps/` and `packages/`. The one exception is a listed migration, a change the new jig-owned scripts need (today: `board.profile` leaves `session.config.json`).

Who owns what is one list, `scripts/restamp-rules.mjs`. Every stamp records the jig commit and its flavors and layers in a committed `.jig.json`; a re-stamp reads the composition from it and updates it. A repo stamped before the record existed names its composition once: `--flavors www-next,api-hono --layers ci`. Flags: `--reference <dir>` keeps the fresh stamp the repo was compared against, to copy from; `--force` overwrites uncommitted changes to jig-owned files; `--name`, `--title` and `--bundle-id` when they can't be read back from the repo. After `--apply`: merge the shared files, run the project's `verify`, commit.

## Sessions

A stamped project keeps its working state outside the repo: work items in a Notion database, session handoffs and learnings on a [Vercel Board](https://vercel.com/docs/board) channel named after the repo. Two Claude Code commands, stamped into `.claude/skills/`, run a session:

- **`/session-start`** pulls the backlog, the last handoff and an index of learnings into `local/session/`, orients, recommends what to work on and waits for a go.
- **`/session-end`** shows the close-out, then updates the backlog, posts the handoff and removes `local/session/`.

Both drive `scripts/session.mjs`, which reads `session.config.json`. The standard (`AGENTS.md`, "Working State") has the rules: statuses, labels, who may start what.

Once per machine:

| Need                 | How                                                                             |
| -------------------- | ------------------------------------------------------------------------------- |
| Vercel CLI ≥ 66.2    | `pnpm add -g vercel@latest`, then `vercel login`. Older CLIs have no `board`    |
| Notion CLI           | `curl -fsSL https://ntn.dev \| bash`, then `ntn login`                           |
| The `board` skill    | `npx skills add vercel/board --skill board -g -a claude-code -y`                |
| `JIG_AGENT`          | Your agent's name (`claude`, `beebee`) in its env. Board posts are written as it |

The stamp defaults point at the jig owner's Vercel team and Notion data source. Stamping for yourself: pass `--board-scope <team>` and `--backlog <data-source-id>`, with a database that has `Name`, `Status`, `Owner`, `Project` and `PR Link` properties as the standard describes. `Project` is a relation to a database of projects (a plain select also works); the project's entry there must exist before the first `/session-start`, named as in `session.config.json`. `Owner` is a read-only rollup of `Project` → the projects database's `Droid` relation (a database of droids with a `Name` title, one droid per project); the script only reads it, to show the project's droid in `pull`, and never writes it. A backlog without that rollup still works: the droid shows as "no droid". The Board is experimental and anyone on the team can read a channel, so nothing secret goes on it.

## Working on the jig

```sh
pnpm install     # git hooks
pnpm test        # generator tests — fast, no network
pnpm verify      # + stamp, install and verify the pnpm, Bun and Swift compositions
```

`pnpm smoke pnpm` (or `bun`, `swift`) runs one composition; the pnpm one also runs an offline `vercel build` to prove the web + API one-project deploy. Template files are never formatted in place — they carry placeholders; formatting is checked in the stamp.

## What lives here

- `AGENTS.md` — the canonical coding standards and agent operating rules (self-contained; projects inherit it).
- `template/` — the files stamped into new projects: a shared base, stack flavors, and optional layers.
- `scripts/` — the generator that does the stamping, the re-stamp that brings a project to a later jig, their tests, and the smoke-stamp runner.
- `docs/DECISIONS.md` and `docs/LEARNINGS.md` — this repo's own decisions, and the learnings a contributor needs. Its backlog and learnings live where every project's do. The jig follows its own rules, and reaches the template's session commands and script by symlink (`.claude/skills`, `scripts/session.mjs`) so it runs exactly what it stamps.

## Philosophy

- **Decide once, write it down.** Standing policies are recorded with their reasoning and not relitigated. Deferrals are recorded with the trigger that would revisit them.
- **Each fact has one home.** Decisions ship with the code they constrain. Work items live in one backlog across every project; handoffs and learnings live on a board. A session starts and ends with a command, not with a paragraph the agent has to remember.
- **One gate.** A single verify command (typecheck + lint + test) that the pre-push hook, CI, and the definition of done all reference.
- **Deviations are documented, never silent.** A project may diverge from the jig — in a file that says what diverged and why.
