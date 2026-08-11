// The deterministic half of project setup: compose base + flavors + layers
// into a target directory, apply fixups, substitute placeholders, git init,
// optionally install + verify. Shared by scripts/new-project.mjs and the CLI.

import { execSync } from 'node:child_process'
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const SKIP_NAMES = new Set(['FLAVOR.md', 'LAYER.md'])
const RENAME_EXCEPTIONS = new Set(['_TEMPLATE.md'])

export function validateName(name) {
	if (!name) return '--name is required'
	if (!/^[a-z][a-z0-9-]*$/.test(name))
		return '--name must be kebab-case: lowercase letters, digits, hyphens'
	return null
}

export function listAvailable(templateRoot, kind) {
	return readdirSync(join(templateRoot, kind), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
}

function walk(dir, visit) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) walk(path, visit)
		visit(path, entry)
	}
}

function copyLayer(from, target) {
	for (const entry of readdirSync(from, { withFileTypes: true })) {
		if (SKIP_NAMES.has(entry.name)) continue
		cpSync(join(from, entry.name), join(target, entry.name), {
			recursive: true,
			force: true,
		})
	}
}

export function composeProject({
	templateRoot,
	standardPath,
	target,
	name,
	flavors = [],
	layers = [],
	author = 'the author',
	git = true,
	verify = false,
	now = new Date(),
}) {
	const nameError = validateName(name)
	if (nameError) throw new Error(nameError)

	for (const flavor of flavors)
		if (!listAvailable(templateRoot, 'flavors').includes(flavor))
			throw new Error(`unknown flavor "${flavor}"`)
	for (const layer of layers)
		if (!listAvailable(templateRoot, 'layers').includes(layer))
			throw new Error(`unknown layer "${layer}"`)
	if (existsSync(target) && readdirSync(target).length > 0)
		throw new Error(`target directory is not empty: ${target}`)

	const isBun = flavors.includes('tui-bun')

	mkdirSync(target, { recursive: true })
	copyLayer(join(templateRoot, 'base'), target)
	for (const flavor of flavors)
		copyLayer(join(templateRoot, 'flavors', flavor), target)
	for (const layer of layers) copyLayer(join(templateRoot, 'layers', layer), target)

	// `_name` → `.name`, deepest first so parent renames don't orphan paths.
	const renames = []
	walk(target, (path, entry) => {
		if (entry.name.startsWith('_') && !RENAME_EXCEPTIONS.has(entry.name))
			renames.push(path)
	})
	renames
		.sort((a, b) => b.length - a.length)
		.forEach((path) => {
			const dir = dirname(path)
			const base = path.slice(dir.length + 1)
			renameSync(path, join(dir, `.${base.slice(1)}`))
		})

	// Toolchain-dependent CI workflow: keep the matching variant.
	const workflows = join(target, '.github', 'workflows')
	const bunVariant = join(workflows, 'verify-bun.yml')
	if (existsSync(bunVariant)) {
		if (isBun) renameSync(bunVariant, join(workflows, 'verify.yml'))
		else rmSync(bunVariant)
	}

	// Bun repos have no pnpm workspace file.
	if (isBun) rmSync(join(target, 'pnpm-workspace.yaml'), { force: true })

	// Public repos vendor the standard so they stand alone.
	if (layers.includes('public') && standardPath) {
		const standard = readFileSync(standardPath, 'utf8')
		const stamp = `<!-- vendored from the jig on ${now.toISOString().slice(0, 10)} -->\n\n`
		mkdirSync(join(target, 'docs'), { recursive: true })
		writeFileSync(join(target, 'docs', 'STANDARDS.md'), stamp + standard)
	}

	const substitutions = [
		['{{PROJECT_NAME}}', name],
		['{{AUTHOR}}', author],
		['{{YEAR}}', String(now.getFullYear())],
	]
	walk(target, (path, entry) => {
		if (!entry.isFile()) return
		if (statSync(path).size > 512 * 1024) return
		const content = readFileSync(path, 'utf8')
		let replaced = content
		for (const [token, value] of substitutions)
			replaced = replaced.replaceAll(token, value)
		if (replaced !== content) writeFileSync(path, replaced)
	})

	const run = (cmd) => execSync(cmd, { cwd: target, stdio: 'inherit' })

	if (git) {
		run('git init -q -b main')
		run('git add -A')
		run('git commit -q -m "chore: stamp project from the jig" --no-verify')
	}

	if (verify) {
		run(isBun ? 'bun install' : 'pnpm install')
		run(isBun ? 'bun run verify' : 'pnpm verify')
	}

	return { target, isBun, flavors, layers }
}
