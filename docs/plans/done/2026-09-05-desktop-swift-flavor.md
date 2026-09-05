---
title: desktop-swift flavor — native Apple apps
status: done
created: 2026-09-05
updated: 2026-09-05
links: []
---

# desktop-swift flavor — native Apple apps

## Goal

A flavor for macOS/iPadOS apps written in Swift, stamped to the same shape and gate as every other jig project. First consumer: Fenestre (a native, account-free web-app shell with iCloud sync).

## Context

`desktop-tauri` covers cross-platform desktop. Apple-only products that need platform features (iCloud/CloudKit, sandbox, WebKit data stores, Keychain) are better native, and the jig has no Swift story. The jig's own bar applies: highly hackable, agent-friendly — everything is a text file, everything runs from the shell.

## Approach

- **pnpm root stays** as the gate runner (lefthook, commitlint, prettier for docs). TypeScript tooling is stripped; no `tsconfig`, no ESLint.
- **XcodeGen** — `project.yml` is the project; `.xcodeproj` is generated and gitignored. Agents edit YAML, never pbxproj.
- **Pure SwiftPM core packages** (`packages/*`) hold all logic and tests, runnable with `swift test` — no simulator, no signing. The app target (`apps/app`) is SwiftUI composition only.
- **Swift Testing** (`@Test`/`#expect`), **swift-format** (ships with Xcode), Swift 6 language mode with complete concurrency checking.
- **Signing from the environment**: `DEVELOPMENT_TEAM` via `.envrc`; absent → unsigned build, so CI and fresh clones verify without a team.
- `scripts/xcode.mjs` wraps generate/build/run so the gate is one command everywhere.

## Steps

- [x] Flavor files: package.json, lefthook.yml, .swift-format, Brewfile, gitignore, docs/SWIFT.md, packages/core, apps/app, scripts/xcode.mjs
- [x] Generator: `{{PROJECT_PASCAL}}`, `{{BUNDLE_ID}}` (+ `--bundle-id`), token substitution in paths, toolchain-keyed CI variant, Swift cleanup list
- [x] CI layer: `verify-swift.yml` (macOS runner)
- [x] Canonical AGENTS.md: Swift as the sanctioned exception to TypeScript-everywhere; native SwiftUI for Apple-only apps
- [x] Smoke stamp passes `pnpm verify`
- [x] README, STATUS, DECISIONS, JOURNAL

## Acceptance criteria

- `node scripts/new-project.mjs --name x --flavors desktop-swift --layers ci --verify` ends green on this machine.
- `swift test` in `packages/core` runs a Swift Testing test.
- `.xcodeproj` never enters git.

## Out of scope

- iPad target wiring (the flavor is macOS by default; adding a destination is a one-line project.yml change, documented).
- Release/notarization pipeline for Swift apps — trigger: first Swift project ships.

## Risks / open questions

- XcodeGen `${ENV}` expansion for `DEVELOPMENT_TEAM` — verified: expands when set, literal when unset (journaled).
- macOS CI minutes are 10× Linux on private repos.
