# AGENTS.md — {{PROJECT_NAME}}

<!-- One line: what this product is and who it's for. -->

{{PROJECT_NAME}} is …

## Standard

This project is built on the [jig](https://github.com/mitchmalone/jig) and follows its `AGENTS.md` standard. This file carries **deltas only** — identity, stack, invariants — never restatements. Divergences from the standard live in `DEVIATIONS.md` with a justification.

<!-- Public repos: vendor the standard as docs/STANDARDS.md (the +public layer does this) so this repo stands alone. -->

## Docs system

Living state is in `docs/` — see the standard for roles and discipline. Session protocol: orient on `docs/STATUS.md` and `docs/plans/active/` → plan before non-trivial work → record decisions/gotchas as they happen → close out docs in the same commit as the code.

## Stack

<!-- Table or short list: runtime, frameworks, data, deploy target. Delete what doesn't apply. -->

| Surface | Choice |
| ------- | ------ |
| …       | …      |

## Invariants

<!-- Numbered, non-negotiable, product-specific. Decided once — don't relitigate here; that's DECISIONS.md's job. -->

1. …

<!-- Optional, for perf-sensitive products — budgets are requirements:

## Performance budgets

| Metric                       | Budget                  |
| ---------------------------- | ----------------------- |
| e.g. keystroke → new results | < 16 ms (one frame)     |
| e.g. idle memory             | < 120 MB ceiling        |

A budget miss cuts or flags the offending feature. Measure before claiming;
record numbers in the plan file or JOURNAL. Release notes carry a
"Performance receipts" table; the release gate refuses while `_ ms`/`_ MB`
placeholders remain. -->

## Commands

| Command       | What                                             |
| ------------- | ------------------------------------------------ |
| `pnpm dev`    | Run all apps in parallel                         |
| `pnpm verify` | The gate: typecheck + lint + format check + test |

## Definition of done

- `pnpm verify` green.
- New behavior has tests, written first (red/green/refactor).
- `docs/STATUS.md` updated and the plan moved to `done/` in the same commit.
