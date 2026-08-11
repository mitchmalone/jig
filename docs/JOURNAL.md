# Journal

Append-only, newest first. 1–2 lines per entry: symptom → cause → fix.

- 2026-08-11 — Vendored `docs/STANDARDS.md` failed `format:check` in stamped repos — it's generated content; added to the base `.prettierignore`.
- 2026-08-11 — Prettier rewrote `__PROJECT_NAME__` placeholders in markdown as `**PROJECT_NAME**` (bold syntax) — switched all placeholders to `{{PROJECT_NAME}}` style, which every formatter leaves alone.
- 2026-08-11 — typescript-eslint hard-errors on TypeScript 7 (the Go port) — the standard pins TS `^6`; revisit when typescript-eslint ships TS 7 support.
- 2026-08-11 — `@eslint/js` versions independently of `eslint` (10.0.x vs 10.8.x) — don't copy the eslint version onto it.
- 2026-08-11 — pnpm 11 ignores dependency build scripts by default (`lefthook`, `esbuild` silently skipped) — the field is `allowBuilds` in `pnpm-workspace.yaml`, not `onlyBuiltDependencies`.
- 2026-08-11 — `prepare: lefthook install` fails in a directory that isn't a git repo — the generator runs `git init` before install; keep that order.
- 2026-08-11 — Template dotfiles are stored with a `_` prefix (`_gitignore`, `_github/`) and renamed by the generator; a real `.gitignore` inside `template/` would leak its rules onto the jig repo itself. `_TEMPLATE.md` is the rename exception.
