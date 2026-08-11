# tui-bun

Toolchain-swap flavor for projects whose deliverable is a **compiled single-file binary** (`bun build --compile`). Replaces the base root `package.json` and `lefthook.yml` with Bun equivalents — one toolchain per repo: Bun for workspaces, install, and test. Record the Bun choice in `DEVIATIONS.md` (justification: compiled-binary distribution).

Composes with `www-next` (Next runs fine under Bun; Vercel supports `bun install`). Do not compose with pnpm-assuming flavors without adjusting their scripts.
