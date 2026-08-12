---
title: Expo/EAS mobile flavor — donor material
status: backlog
created: 2026-08-12
updated: 2026-08-12
links: []
---

# Expo/EAS mobile flavor — donor material

Trigger (per ROADMAP): next mobile project. Collected from the two Expo repos' reconciliations; verify against current Expo/EAS at build time.

## Workspace / toolchain

- `pnpm-workspace.yaml` needs `nodeLinker: hoisted` — Metro/Expo assume a hoisted layout, AND Vercel prebuilt deploys break on symlinks into the `.pnpm` store.
- pnpm config (overrides, nodeLinker) lives in `pnpm-workspace.yaml`; pnpm 11 silently ignores `package.json#pnpm`.
- `prepare` must be the git-guarded lefthook install (EAS builders extract tarballs without `.git`).
- Builder image controls Node, not the repo — `engines >=24` is warn-only without `engine-strict`; check builder-image Node when bumping (pnpm 11 itself needs >=22.13).
- Root wrapper scripts (`"build:ios:<app>": "pnpm --filter <app> build:ios"`) pin the CWD inside the app — running `eas` from the monorepo root misfires.

## eas.json shape

- `cli.appVersionSource: "remote"`; profiles: `development` (`developmentClient: true`, `distribution: "internal"`), `preview` (internal), `production` (`autoIncrement: true`); each profile sets `environment`.

## Doctrine (from live DECISIONS)

- Dev clients never go to TestFlight — they displace the real app as "latest" for testers.
- Credentials creation is interactive exactly once (Apple constraint); after that `-- --auto-submit --non-interactive` is fully agent-runnable.
- `EXPO_PUBLIC_*` config lives in EAS env vars per environment, not the repo.
- No OTA/expo-updates — every change is a native build.

## Open design questions

- Testing story: one repo runs four tiers (Vitest cores + jest-expo apps + fast-check + Maestro), the other has no app-level tests at all — the flavor must decide rather than inherit Vitest blindly.
- CI: auto-discovery matrix + always-reported summary job (see the multi-game repo) once per-app wall time hurts.
