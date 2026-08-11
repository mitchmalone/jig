# +public layer

Everything a repo needs to stand alone in the open:

- **Hygiene files** — LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, issue templates.
- **Vendored standard** — the generator copies the jig's `AGENTS.md` into `docs/STANDARDS.md` (with a version stamp) so contributors and their agents see the rules without any private file.
- **Secret scanning** — this layer's `lefthook.yml` replaces the base one, adding a gitleaks pre-commit scan. Keep the two files in sync when the base changes.
- **Release fan-out** — `release.yml`: tag `v*` → verify → build → GitHub Release (gated on a release-notes file written first from `docs/releases/_TEMPLATE.md`) → satellite jobs (e.g. Homebrew tap) that no-op honestly when their repo variable/token isn't configured. Satellites are generated output: fix the generator, not the output. The build job is a scaffold — replace the build step with your artifact (bun compile matrix, tauri build, etc.).

Publishable-repo hygiene extends to copy: marketing claims in `apps/www` must trace to the code that backs them — one repo makes that a same-commit concern.

The release workflow's notes-first gate should also assert that any in-repo release facts (e.g. `apps/www/src/data/release.json`) match the tag version — with branch protection on `main`, the workflow can't push corrections back, so the check must fail the release instead.
