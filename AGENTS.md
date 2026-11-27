# AGENTS.md — Smoke Swift

<!-- One line: what this product is and who it's for. -->

Smoke Swift is …

## Standard

This project was stamped from the [jig](https://github.com/mitchmalone/jig). Its standard lives **in this repo** at `docs/STANDARDS.md` (vendored at stamp time) — that copy governs; do not consult or "upgrade to" the jig's current version mid-task. This file carries **deltas only** — identity, stack, invariants — never restatements. Divergences live in `DEVIATIONS.md` with a justification. Refreshing `docs/STANDARDS.md` from the jig is a deliberate reconciliation, done as its own change.

## Sessions

Working state lives outside the repo — see the standard for roles and discipline. Start every session with `/session-start` and end it with `/session-end`; both drive `scripts/session.mjs`, and `session.config.json` holds the pointers below.

- **Backlog:** Notion, The Backlog, `Project` = `Smoke Swift`.
- **Handoffs and learnings:** Vercel Board, team `ramenamok`, channel `smoke-swift`.
- **Decisions:** `docs/DECISIONS.md`, in the commit that makes them.
- **This session's copy:** `local/session/` (gitignored).

## Stack

<!-- Table or short list: runtime, frameworks, data, deploy target. Delete what doesn't apply. -->

| Surface | Choice |
| ------- | ------ |
| …       | …      |

## Invariants

<!-- Numbered, non-negotiable, product-specific. Decided once — don't relitigate here; that's DECISIONS.md's job. Exemplars of the right altitude, from a real project:
"**`packages/<core>` is pure.** No I/O, no network, no direct `Date.now()` — time is injected. Every behaviour is unit-tested. If you're tempted to import anything with a side effect, you're in the wrong package."
"Sync state transitions, never ticks — nothing that runs every second may touch the network." -->

1. …

<!-- Optional, for perf-sensitive products — budgets are requirements:

## Performance budgets

| Metric                       | Budget                  |
| ---------------------------- | ----------------------- |
| e.g. keystroke → new results | < 16 ms (one frame)     |
| e.g. idle memory             | < 120 MB ceiling        |

A budget miss cuts or flags the offending feature. Measure before claiming;
record numbers in the PR and as a learning. Release notes carry a
"Performance receipts" table; the release gate refuses while `_ ms`/`_ MB`
placeholders remain. -->

## Commands

- `pnpm verify` — the gate. The pre-push hook and CI run exactly this.
- Everything else is a script in the root `package.json`.

<!-- Record project-unique local ports here (the standard requires them). -->

## Definition of done

- `pnpm verify` green.
- New behavior has tests, written first (red/green/refactor).
- Decisions recorded in `docs/DECISIONS.md` in the same commit.
- The backlog item is `In Review` with its PR link; `/session-end` closes the session out.
