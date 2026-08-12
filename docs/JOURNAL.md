# Journal

Append-only, newest first. 1–2 lines per entry: symptom → cause → fix.

- 2026-08-12 — pnpm 11 EDITS `pnpm-workspace.yaml` in place on install, inserting `pkg: set this to true or false` placeholders under `allowBuilds` — resolve them before the next install.
- 2026-08-12 — `sharp` under `allowBuilds: true` attempts a node-gyp source build and fails noisily; the prebuilt `@img/sharp-*` optional deps are what actually load — set `sharp: false`. `unrs-resolver` (via eslint-config-next) needs `true`.
- 2026-08-12 — Next generates more than `next-env.d.ts`: typed-routes `types/routes.d.ts` + `types/validator.ts` fail `--max-warnings 0` and format:check — add explicit lint/prettier ignores in Next repos.
- 2026-08-12 — `verbatimModuleSyntax` in a Next repo stops SWC eliding default imports used only as types — a browser-only lib loaded at SSR module scope crashed prerender with `window is not defined`, and tsc shows no error (package exports both value and type). Fix: `import type`.
- 2026-08-12 — Gitignored build-time JSON imports (content pipelines) break `tsc --noEmit` in CI — ambient `declare module` typings decouple typecheck from the pipeline.
- 2026-08-12 — pnpm 11 deprecates `$`-reference overrides (`sharp: "$sharp"`) — use `catalog:` entries in pnpm-workspace.yaml referenced from both deps and overrides.
- 2026-08-12 — A repo-wide `ajv: 6` override crashes commitlint at commit-msg time (`Keyword [object Object] is not a valid identifier`) — @commitlint/config-validator needs ajv 8; scope an exemption: `"@commitlint/config-validator>ajv": ^8`.
- 2026-08-12 — Migrating package managers regenerates the lockfile and re-resolves `^` ranges — expect (and budget for) new lint/type findings from newer minors mid-migration; they're real findings, not migration breakage.
- 2026-08-12 — After removing husky, `lefthook install` refuses with "Custom hooks paths are not supported" — husky leaves `core.hooksPath=.husky/_` in local git config; `git config --unset-all --local core.hooksPath` first. Every husky-era repo migration hits this.
- 2026-08-12 — `brew untap <tap> --force` UNINSTALLS the tap's casks (deletes the .app), and a locally-tapped clone doesn't see new casks until `brew update` — tap-migration order: tap/pull the new tap → `brew install` from it → only then untap the old one.
- 2026-08-11 — Under `set -o pipefail`, `cmd | grep -q` exits 141 (grep's early exit SIGPIPEs the writer) — capture output to a variable and grep that. And `codesign -dv` doesn't print Authority lines; only `-dvv` does.
- 2026-08-11 — Template briefly standardized on tabs (`useTabs: true`) — an authoring artifact mistaken for a decision; house style is Prettier's default spaces. Config fixed, template reformatted; no reconciled project inherited it (all kept their own configs).
- 2026-08-11 — `prepare: lefthook install` exits 128 on any tarball-based builder (EAS extracts without `.git`) — guard it: `git rev-parse --git-dir >/dev/null 2>&1 && lefthook install || true`. Husky silently no-oped there, so the failure only appeared after the lefthook migration.
- 2026-08-11 — pnpm 11 needs Node >=22.13 (imports `node:sqlite`) — builder images pinned to Node 20 die at install; check CI/builder image Node versions when migrating existing repos to pnpm.
- 2026-08-11 — pnpm forwards a literal `--` in `pnpm run script -- --flag` to the underlying CLI — commands documented for npm need the `--` dropped.
- 2026-08-11 — Composing tui-bun + www-next: two `@types/node` majors in Bun's isolated store (www's pin vs bun-types' `*`) break the CLI typecheck with nonsense errors — pin one `@types/node` major across the workspace.
- 2026-08-11 — Staged-file lint passes an app's files to the root ESLint, which loads the app's own flat config under the root's (different-major) ESLint → `contextOrFilename.getFilename is not a function`. Apps with their own eslint config: `exclude` them in lefthook's lint command and chain their lint into the root `lint` script.
- 2026-08-11 — pnpm 11 silently ignores `package.json#pnpm` (overrides etc.) and `.npmrc node-linker=` — only a WARN at install. Both belong in `pnpm-workspace.yaml` (`overrides:`, `nodeLinker:`); React Native/Expo repos need `nodeLinker: hoisted` (isolated layout breaks Metro/RN codegen).
- 2026-08-11 — A worktree got committed as an embedded repo — the jig repo never gave itself the `.gitignore` block its own template prescribes; the stamper must also follow the standard.
- 2026-08-11 — Vendored `docs/STANDARDS.md` failed `format:check` in stamped repos — it's generated content; added to the base `.prettierignore`.
- 2026-08-11 — Prettier rewrote `__PROJECT_NAME__` placeholders in markdown as `**PROJECT_NAME**` (bold syntax) — switched all placeholders to `{{PROJECT_NAME}}` style, which every formatter leaves alone.
- 2026-08-11 — typescript-eslint hard-errors on TypeScript 7 (the Go port) — the standard pins TS `^6`; revisit when typescript-eslint ships TS 7 support.
- 2026-08-11 — `@eslint/js` versions independently of `eslint` (10.0.x vs 10.8.x) — don't copy the eslint version onto it.
- 2026-08-11 — pnpm 11 ignores dependency build scripts by default (`lefthook`, `esbuild` silently skipped) — the field is `allowBuilds` in `pnpm-workspace.yaml`, not `onlyBuiltDependencies`.
- 2026-08-11 — `prepare: lefthook install` fails in a directory that isn't a git repo — the generator runs `git init` before install; keep that order.
- 2026-08-11 — Template dotfiles are stored with a `_` prefix (`_gitignore`, `_github/`) and renamed by the generator; a real `.gitignore` inside `template/` would leak its rules onto the jig repo itself. `_TEMPLATE.md` is the rename exception.
