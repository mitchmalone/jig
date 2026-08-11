// Resolve where the template comes from: an explicit --template path, the
// enclosing jig checkout (when running from the repo), or a tarball of the
// repo fetched from GitHub (when running as a published package).

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_TARBALL =
	'https://codeload.github.com/mitchmalone/jig/tar.gz/refs/heads/main'

export async function resolveTemplate(explicitPath) {
	if (explicitPath) {
		const root = resolve(explicitPath)
		if (!existsSync(join(root, 'base')))
			throw new Error(`--template path has no base/: ${root}`)
		return { templateRoot: root, standardPath: findStandard(root) }
	}

	// Running from inside a jig checkout?
	const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
	const checkoutTemplate = resolve(packageDir, '..', 'template')
	if (existsSync(join(checkoutTemplate, 'base'))) {
		return {
			templateRoot: checkoutTemplate,
			standardPath: resolve(packageDir, '..', 'AGENTS.md'),
		}
	}

	// Published package: fetch the repo tarball.
	const response = await fetch(REPO_TARBALL)
	if (!response.ok)
		throw new Error(`failed to fetch template: HTTP ${response.status}`)
	const scratch = mkdtempSync(join(tmpdir(), 'create-jig-'))
	const tarball = join(scratch, 'jig.tar.gz')
	writeFileSync(tarball, Buffer.from(await response.arrayBuffer()))
	execSync(`tar -xzf ${JSON.stringify(tarball)} -C ${JSON.stringify(scratch)}`)
	const repoRoot = join(scratch, 'jig-main')
	return {
		templateRoot: join(repoRoot, 'template'),
		standardPath: join(repoRoot, 'AGENTS.md'),
	}
}

function findStandard(templateRoot) {
	const candidate = resolve(templateRoot, '..', 'AGENTS.md')
	return existsSync(candidate) ? candidate : null
}
