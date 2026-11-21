---
title: Session system — Board, Notion backlog, /session-start and /session-end
status: active
created: 2026-11-21
updated: 2026-11-21
links: []
---

# Session system — Board, Notion backlog, /session-start and /session-end

## Goal

Replace most of the in-repo docs system with three stores and two commands, so a session starts oriented, works from one backlog, and closes out reliably:

1. Mitch runs `/session-start`; the agent syncs Notion and the Board and orients itself.
2. The agent recommends what to work on and waits for a go.
3. The agent breaks the work down and builds it, with Opus subagents for well-specified coding tasks.
4. The agent reports; Mitch approves.
5. Mitch runs `/session-end`; the agent shows the close-out, then writes it to the Board and Notion.

## Context

The docs system (`STATUS.md`, `ROADMAP.md`, `JOURNAL.md`, `DECISIONS.md`, `plans/`) keeps everything in the repo. Two things pushed this change:

- Wriker's Board handoff routine, driven only by an `AGENTS.md` block, did not fire on its own; Mitch had to ask for the handoff after a day of work. A command is needed, not an instruction.
- The backlog belongs somewhere Mitch can manage across projects without opening a repo.

What was checked on 2026-11-21:

- `vercel board read <channel> --json` returns full message text (the ~70-character truncation is text output only).
- `ntn datasources query <id> --filter <json>` exists and `ntn doctor` reports a valid login on this machine (workspace Ramen Amok). `ntn` is at 0.14.1; 0.23.31 is available.
- The Board is a one-day-old trial: one `General` board on team `ramenamok`, one flat channel per repo, no automation, no search, no pinning, experimental and US-hosted.

## Approach

### Where each thing lives

| Was | Now |
| --- | --- |
| `docs/STATUS.md` | Board handoff thread (`kind=handoff`) plus Notion statuses |
| `docs/ROADMAP.md` | Notion: The Backlog |
| `docs/JOURNAL.md` | Board, one thread per learning (`kind=learning`), posted as it happens |
| `docs/plans/` | `local/session/` (gitignored), destroyed by `/session-end` |
| `docs/DECISIONS.md` | Unchanged, in the repo, in the same commit as the code |
| — | Public repos only: curated `docs/LEARNINGS.md` |

Decisions stay in the repo because the Board has no search and no versioning, and decisions must be findable months later and reviewable with the code.

### Notion: The Backlog

One shared database (`collection://41f3d7d1-79ad-8045-a361-000b56ae7f12`), used as it is. No new properties; each project adds its own `Project` option.

- **Startable pool:** `Ready` items whose Owner is `Code Agent` or empty. A session never picks up Mitch's or Beebee's items.
- **No priority.** The agent recommends from the pool using the last handoff and item dependencies; Mitch decides in discussion.
- **Flow:** `Ready` → `In Progress` (Owner set to `Code Agent`) → `In Review` (PR Link set) → `Done` after Mitch approves the merge.
- **`In Progress` is the lock.** An In Progress item with no local reference belongs to another session or a dead one; `/session-start` asks before touching it.
- **Agent-raised work** is created as `Triage` with no Owner. Only Mitch promotes it.
- **Waiting on Mitch** becomes an item with Owner `Mitch`, `Blocked` if it blocks agent work, with the reason in the page body.
- Triggers and acceptance criteria live in the page body.

### Board

Channel named after the repo, on the `General` board, `--scope ramenamok`, posting as `--as claude`.

- `kind=handoff` with `state=active|paused|waiting|review|done`: one thread per session, headings **Changed**, **Half-done**, **Next**.
- `kind=learning`: one thread per learning. The first line is a headline (symptom → cause), the body is the fix. An optional `topic=<word>` label narrows reads.
- Board tasks are not used for the backlog. They are allowed only for subagent coordination inside a session.

### Local reference

`local/session/`, written by `/session-start`:

- `backlog.md`: the project's open items, grouped by status.
- `handoff.md`: the latest handoff in full.
- `learnings.md`: an index of learning headlines with thread IDs; full threads are read on demand.
- `plan.md`: the session's plan, written after Mitch's go.
- `session.json`: start time, claimed items, board cursor.

### `scripts/session.mjs`

One zero-dependency Node script, stamped into every project, wrapping `ntn` and `vercel board` for the operations that happen every session. It is deterministic and exits non-zero with a clear message when a store is unreachable. Subcommands:

| Command | Does |
| --- | --- |
| `pull` | Writes the local reference. Reports a leftover `local/session/` instead of overwriting it |
| `start <item>` | Sets `In Progress` and Owner `Code Agent`, records the claim locally |
| `learn` | Posts a `kind=learning` thread |
| `raise <title>` | Creates a `Triage` item |
| `review <item> --pr <url>` | Sets `In Review` and the PR Link |
| `done <item>` | Sets `Done` |
| `close --file <handoff> --state <state>` | Posts the handoff, then removes `local/session/` only if every write succeeded |

The Notion MCP connector remains for work that needs judgement, such as reading a page body in depth.

Project settings (board scope and channel, Notion data source and Project value) live in one committed file with no secret material, like `.infisical.json`.

### `/session-start`

1. Run `pull`. If a previous session was not closed, reconcile it first: show what it left, write its close-out on confirmation, then pull again.
2. Read `AGENTS.md`, `docs/DECISIONS.md`, the handoff, the backlog and the learning index.
3. Report in a few lines: last state, in-flight items, what waits on Mitch.
4. Recommend one item, or a set that is safe to run in parallel, with the reason and a breakdown. Wait for a go.
5. On go: `start` the items, write `plan.md`, branch, build with TDD.
6. If the Board or Notion is unreachable, stop and say so.

Working rules the command sets:

- Main thread on the session's model. Subagents on Opus for well-specified coding tasks.
- Parallel items run as subagents in worktrees: one item, one branch, one PR. Dependent items, and items touching the same migrations or contracts, stay serial.
- Only the main thread writes to Notion and the Board.
- Learnings are posted when they happen. Decisions go in `docs/DECISIONS.md` in the commit that makes them.
- Commits and pushes to a feature branch need no approval. Merging the PR and moving an item to `Done` need Mitch's.

### `/session-end`

1. Draft the handoff, the Notion changes (status and PR Link per item, new Triage items) and, in public repos, any learning worth promoting to `docs/LEARNINGS.md`.
2. Show the draft. Write on Mitch's confirmation.
3. Remove `local/session/`. If any write failed, keep it and say what was not written.

### Standard changes (`AGENTS.md`)

- "The Docs System" and "Session Protocol" rewritten to the above.
- "Definition of Done": `verify` green, tests written first, decisions recorded in the same commit, pushed with CI green, the item `In Review` with its PR Link.
- "Agent Discipline": sessions die, so learnings are posted as they happen.
- The Board's experimental status recorded as a deferral with a trigger: if it changes terms or loses data, learnings return to `docs/JOURNAL.md`.

## Steps

- [ ] Record the decision in `docs/DECISIONS.md`; rewrite the standard's docs, session, done and discipline sections.
- [ ] `scripts/session.mjs`, tests first (`node --test`): filter and payload building, snapshot rendering, leftover detection, close refusing to delete on a failed write.
- [ ] `/session-start` and `/session-end` skills in `template/base/_claude/skills/`.
- [ ] Template: remove `STATUS.md`, `ROADMAP.md`, `JOURNAL.md` and `plans/` from `template/base/docs/`; add the settings file, the script and the skills; rewrite the stamped `AGENTS.md` session block; update the generator's flags and its "next steps" output.
- [ ] `public` layer: `docs/LEARNINGS.md` and the matching lines in `CONTRIBUTING.md`.
- [ ] Smoke stamps green for the pnpm, Bun and Swift compositions.
- [ ] README: usage and the "Docs are state" principle.
- [ ] Dogfood: move the jig's own roadmap and status items to Notion (`Project` = `Jig`), its journal to the `jig` channel as learning threads, post a first handoff, then delete the retired files and this plan.

## Acceptance criteria

- A fresh stamp contains the two skills, the script and the settings file, contains none of the retired docs, and passes `verify`.
- `session.mjs pull` in a project writes the four reference files from live Notion and Board data, and fails loudly when either is unreachable.
- `close` leaves `local/session/` in place when a write fails.
- In the jig itself: `/session-start` produces a recommendation from The Backlog, and `/session-end` leaves a handoff on the Board, updated items in Notion and no `local/session/`.

## Out of scope

- Reconciling stamped projects. Wriker is first, then Scuttler, each in its own session after this lands.
- Agents other than Claude Code.
- A hook that runs the close-out automatically when a session ends. Trigger: a session is lost without `/session-end` more than once.
- Distinct Board profiles per session. Trigger: two sessions on one project at the same time become routine.

## Risks / open questions

- **Owner-specific values in a public template.** The team scope and the Notion data source are Mitch's. Assumption: generator flags with Mitch's values as defaults, written into the stamped settings file.
- **Empty pool.** With nothing `Ready`, the agent proposes candidates from `Todo` and Mitch promotes them. `Scheduled` is treated like `Todo`.
- **Learning volume.** Scuttler has about 1,400 lines of journal. The index keeps session start cheap, but a channel read returns at most 500 threads; past that the index needs paging or topic labels.
- **Board is experimental.** Limits and terms may change. `DECISIONS.md` staying in the repo bounds the loss to learnings and handoffs.
- **`ntn` version.** The script should state the minimum version it was tested against; this machine is well behind current.
- **Done plans.** The jig's `docs/plans/done/` files are deleted in the dogfood step; git history keeps them.
