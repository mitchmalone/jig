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
- Every stamp vendors the standard as `docs/STANDARDS.md` and ships an `.envrc.example` with the Infisical + direnv recipe.

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

The stamp defaults point at the jig owner's Vercel team and Notion data source. Stamping for yourself: pass `--board-scope <team>` and `--backlog <data-source-id>`, with a database that has `Name`, `Status`, `Owner`, `Project` and `PR Link` properties as the standard describes. The Board is experimental and anyone on the team can read a channel, so nothing secret goes on it.

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
- `scripts/` — the generator that does the stamping, its tests, and the smoke-stamp runner.
- `docs/DECISIONS.md` — this repo's own decisions. Its backlog and learnings live where every project's do; the jig follows its own rules, and shares the template's session commands by symlink.

## Philosophy

- **Decide once, write it down.** Standing policies are recorded with their reasoning and not relitigated. Deferrals are recorded with the trigger that would revisit them.
- **Each fact has one home.** Decisions ship with the code they constrain. Work items live in one backlog across every project; handoffs and learnings live on a board. A session starts and ends with a command, not with a paragraph the agent has to remember.
- **One gate.** A single verify command (typecheck + lint + test) that the pre-push hook, CI, and the definition of done all reference.
- **Deviations are documented, never silent.** A project may diverge from the jig — in a file that says what diverged and why.
