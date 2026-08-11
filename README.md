# jig

A hackable solo-dev project template. One repo shape, one set of operating rules, stamped into every new project.

A **jig** is a workshop tool: it holds the work steady and guides the cut, so every piece comes out the same. This repo does that for software projects — it carries the decisions that don't need re-making (repo layout, docs system, hooks, gates, release wiring) so each new project starts at full speed and stays consistent with its siblings.

Status: bootstrapping. See `docs/plans/active/` for the current plan.

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
