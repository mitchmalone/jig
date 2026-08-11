# tui-bun

Toolchain-swap flavor for projects whose deliverable is a **compiled single-file binary** (`bun build --compile`). Replaces the base root `package.json` and `lefthook.yml` with Bun equivalents — one toolchain per repo: Bun for workspaces, install, and test. Record the Bun choice in `DEVIATIONS.md` (justification: compiled-binary distribution).

Composes with `www-next` (Next runs fine under Bun; Vercel supports `bun install`). Do not compose with pnpm-assuming flavors without adjusting their scripts.

Composing with `www-next`: pin a single `@types/node` major across the workspace (www's pin vs `bun-types`' `*` dep can resolve two majors in Bun's isolated store and break the CLI typecheck), and if apps/www carries its own ESLint config of a different major, `exclude: [apps/www/**]` in lefthook's lint command and chain `bun run --filter www lint` into the root lint script.
