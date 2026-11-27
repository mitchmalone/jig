# Learnings

Hard-won knowledge a contributor to the jig needs, by topic: symptom → cause → fix. Curated, not a log: an entry earns its place when someone changing the template or the generator would otherwise lose time to it. The full journal up to 2026-11-21 is in git history (`docs/JOURNAL.md`).

## Placeholders and formatting

- **Never run a formatter over `template/`.** In JSX `{{PROJECT_NAME}}` is an object literal, so Prettier rewrote it as `{{ PROJECT_NAME }}` and the exact-match substitution missed it; every web stamp shipped the raw token for three months. In YAML the same token is a flow mapping. Placeholders live inside strings, the generator fails on any survivor, and formatting is checked in the stamp.
- **Markdown tables in stamped docs can't hold a placeholder.** The substituted value changes the column widths and the stamp fails `format:check`. Use a list where a value varies in length.
- **`__NAME__`-style placeholders don't survive Markdown.** Prettier rewrites them as bold. Use `{{NAME}}`.
- **Format a new template file in a stamp, then copy it back.** Stamp into a scratch directory, install, run the stamp's own `prettier --write` and `eslint` on the file, and copy the result into `template/`. The smoke stamp is what proves it.
- **`docs/STANDARDS.md` is generated in each stamp** and is in the base `.prettierignore`; it is never formatted.

## Template layout

- **Dotfiles are stored with a `_` prefix** (`_gitignore`, `_github/`, `_claude/`) and renamed by the generator. A real `.gitignore` inside `template/` would apply to the jig itself. `_TEMPLATE.md` is the one rename exception.
- **Every template file has an owner in `scripts/restamp-rules.mjs`** (jig-owned, shared or project-owned). A test stamps each composition and fails on a file that matches no pattern or two; a new template file means a new entry there.
- **A file the generator writes into a stamp must already be Prettier-clean**, since the stamp's gate runs `format:check`. `.jig.json` is written by hand-rolled code for that reason: `JSON.stringify` breaks a short array over several lines and Prettier wants it on one.
- **A layer never ships a whole `lefthook.yml`.** It would silently replace the toolchain's hooks (Bun and Swift repos once got pnpm hooks from `public`). Layers add fragments under `.lefthook/`; every root `lefthook.yml` has `extends: [.lefthook/*.yml]`, which lefthook accepts when the glob matches nothing.
- **Key generator behaviour on the selected layers, not on directories.** The CI-variant picker once keyed on `.github/workflows` existing, and broke when `public` started shipping `release.yml` there.
- **When picking one of several variant files, delete the losers before renaming the winner.** Renaming first got the winner deleted as a stale variant.
- **Swift import order depends on the project name** (`<Name>Core` sorts either side of `SwiftUI`), so the generator runs swift-format on a Swift stamp instead of the template hand-sorting imports.

## The gate and CI

- **CI runners have no git identity.** The stamp's initial commit fails with `fatal: empty ident name`; the smoke runner supplies one through `GIT_AUTHOR_*` and `GIT_COMMITTER_*` when none is configured.
- **Stamping the Swift flavor needs a Mac** (`xcrun swift-format`). Any test that stamps it must carry `{ skip: !isMac }`, or it passes locally and fails on the Linux runner.
- **Swift needs Xcode, not just a Mac.** The stamp's verify runs `pnpm build`, which drives xcodebuild (`template/flavors/desktop-swift/package.json`, `scripts/xcode.mjs`), and xcodebuild always needs Xcode selected. With only the Command Line Tools, `/usr/bin/xcodebuild` exists but exits 1 ("requires Xcode"); `swift test` also fails with `no such module 'Testing'` even though CLT ships Testing.framework. Probe with `xcodebuild -version`, never `command -v xcodebuild` (`scripts/xcode-status.mjs`, shared by the generator's `--verify` preflight and smoke). Smoke skips the Swift stamp loudly without it; set `JIG_SMOKE_REQUIRE=swift` on the Mac that gates Swift so the skip fails instead.
- **A git hook exports `GIT_DIR`** (in a linked worktree, `GIT_WORK_TREE` and `GIT_INDEX_FILE` too), and every child inherits it. Smoke runs from pre-push, so the stamp's `git init` and initial commit hit the jig's repo: junk `stamp project` commits and `core.bare = true` in the shared `.git/config`. Anything that runs git in a repo of its own takes `withoutRepoGitEnv()` (`scripts/git-env.mjs`, the list from `git rev-parse --local-env-vars`) as its env.
- **`prepare: lefthook install` fails outside a git repo**, including tarball-based builders. The guarded form is `git rev-parse --git-dir >/dev/null 2>&1 && lefthook install || true`, and the generator runs `git init` before install.
- **The base ESLint config sets no Node globals.** A stamped `scripts/*.mjs` fails lint with `'process' is not defined` unless the `scripts/**/*.mjs` block declares what it uses. ESLint 10's `preserve-caught-error` also wants `{ cause }` on a rethrow.
- **`vercel build` runs offline** with a hand-written `.vercel/project.json` (`{projectId, orgId, settings}`). `settings.rootDirectory` stands in for a project's Root Directory; `cd apps/www` does not, because the CLI resolves the link at the git root.

## The session script

- **The Board CLI reports errors as JSON on stdout**, with nothing useful on stderr. Reading only stderr hides every reason, including `channel_not_found`, which is how a never-posted channel answers a read.
- **Every non-interactive `vercel board` command needs `--scope`**, or it exits `missing_scope`. `read --json` returns full message text; the plain listing truncates at about 70 characters. CLI 61 has no `board` command; it needs 66.2 or later.
- **The Board lists threads by latest activity, not creation.** A handoff with a newer reply sorts ahead of a newer handoff, so "the last handoff" is picked by `createdAt`, not by position.
- **A script run through a symlink has `import.meta.url` at the real path**, so comparing it to `process.argv[1]` is false and the script silently does nothing. Compare against `realpathSync(process.argv[1])`.
- **Read the Notion schema; don't assume it.** The backlog's `Project` changed from a select to a relation while the script was being built, and the first live write failed with `Project is expected to be relation`.
- **A fake that routes commands by substring can pass a test for the wrong reason.** The first version's tests threw errors that already contained the reason text, and so never noticed the real CLI puts it on stdout. Test the runner against a real process too.
- **Pass a CLI value as one `--flag=value` argument when it can start with a dash.** A Markdown body beginning with `-` or `---` passed after `--content` can be read as an option.
- **A local record of remote state goes stale.** Claims recorded in `local/session/session.json` were never released, so `discard` refused forever. Release the record on the write that changes the remote, and check the remote live before refusing on it.
- **Resolve the repo root from git, not the current directory.** Run from a subdirectory, the script reported removing a session that was somewhere else.
