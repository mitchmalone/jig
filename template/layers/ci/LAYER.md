# +ci layer

GitHub Actions running the **same `verify` gate as the pre-push hook** — green hooks, green CI, no drift — plus a commitlint job over the PR's commits. Two workflow variants ship; the generator keeps the one matching your toolchain (`verify.yml` for pnpm, `verify-bun.yml` for Bun repos) and deletes the other. Swift repos don't take this layer — their gate runs on the developer's Mac.

After pushing, check the run (`gh run list` / `gh run view`). Don't assume green.
