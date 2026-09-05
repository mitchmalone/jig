# jig

A hackable solo-dev project template. One repo shape, one set of operating rules, stamped into every new project.

A **jig** is a workshop tool: it holds the work steady and guides the cut, so every piece comes out the same. This repo does that for software projects — it carries the decisions that don't need re-making (repo layout, docs system, hooks, gates, release wiring) so each new project starts at full speed and stays consistent with its siblings.

## Usage

```sh
node scripts/new-project.mjs --name my-thing \
  --flavors www-next,api-hono,web-vite \
  --layers ci,public
```

Compose order: `base` → flavors → layers (later files win). The stamp ends with a git repo whose `verify` gate (typecheck + lint + format check + test) passes after install.

- **Flavors** — `www-next` (static-first marketing site), `api-hono` (+ Zod contracts and db seed packages), `web-vite` (product web app), `tui-bun` (Bun toolchain swap for compiled-binary CLIs/TUIs), `desktop-tauri` (Rust standards delta; scaffold the app from upstream), `desktop-swift` (native Apple app: pure SwiftPM packages + XcodeGen-described SwiftUI app, Swift Testing, swift-format).
- **Layers** — `ci` (GitHub Actions running the same verify gate as the pre-push hook), `public` (LICENSE, CONTRIBUTING, issue templates, gitleaks, vendored standard, tag-triggered release fan-out to generated satellite repos).
- Flags: `--dir`, `--author`, `--bundle-id` (Swift apps), `--no-git`, `--verify` (install + run the gate immediately).

## What lives here

- `AGENTS.md` — the canonical coding standards and agent operating rules (self-contained; projects inherit it).
- `template/` — the files stamped into new projects: a shared base, stack flavors, and optional layers.
- `scripts/` — the generator that does the stamping.
- `docs/` — this repo's own status, decisions, and plans. The jig follows its own rules.

## Philosophy

- **Decide once, write it down.** Standing policies are recorded with their reasoning and not relitigated. Deferrals are recorded with the trigger that would revisit them.
- **Docs are state, shipped with the code.** Every project carries a small set of living documents (status, decisions, journal, plans) updated in the same commit as the work they describe.
- **One gate.** A single verify command (typecheck + lint + test) that the pre-push hook, CI, and the definition of done all reference.
- **Deviations are documented, never silent.** A project may diverge from the jig — in a file that says what diverged and why.
