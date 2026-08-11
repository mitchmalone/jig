import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { composeProject, validateName } from '../src/compose.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const templateRoot = join(repoRoot, 'template')
const standardPath = join(repoRoot, 'AGENTS.md')

function stamp(options = {}) {
	const target = mkdtempSync(join(tmpdir(), 'compose-'))
	return composeProject({
		templateRoot,
		standardPath,
		target: join(target, 'proj'),
		name: 'proj',
		git: false,
		now: new Date('2026-08-11T00:00:00Z'),
		...options,
	})
}

describe('validateName', () => {
	it('rejects non-kebab names', () => {
		assert.match(validateName('MyThing'), /kebab-case/)
		assert.equal(validateName('my-thing'), null)
	})
})

describe('composeProject', () => {
	it('renames underscore dotfiles but keeps _TEMPLATE.md', () => {
		const { target } = stamp()
		assert.ok(existsSync(join(target, '.gitignore')))
		assert.ok(!existsSync(join(target, '_gitignore')))
		assert.ok(existsSync(join(target, 'docs', 'plans', '_TEMPLATE.md')))
	})

	it('substitutes placeholders', () => {
		const { target } = stamp()
		const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
		assert.equal(pkg.name, 'proj')
		assert.ok(!readFileSync(join(target, 'AGENTS.md'), 'utf8').includes('{{'))
	})

	it('stamps the onboarding plan', () => {
		const { target } = stamp()
		assert.ok(
			existsSync(join(target, 'docs', 'plans', 'active', '0000-onboard.md')),
		)
	})

	it('keeps the pnpm CI variant for node repos', () => {
		const { target } = stamp({ layers: ['ci'] })
		const workflow = readFileSync(
			join(target, '.github', 'workflows', 'verify.yml'),
			'utf8',
		)
		assert.match(workflow, /pnpm/)
		assert.ok(!existsSync(join(target, '.github', 'workflows', 'verify-bun.yml')))
	})

	it('swaps to the bun CI variant and drops the pnpm workspace for tui-bun', () => {
		const { target } = stamp({ flavors: ['tui-bun'], layers: ['ci'] })
		const workflow = readFileSync(
			join(target, '.github', 'workflows', 'verify.yml'),
			'utf8',
		)
		assert.match(workflow, /setup-bun/)
		assert.ok(!existsSync(join(target, 'pnpm-workspace.yaml')))
	})

	it('vendors the standard with a date stamp for public repos', () => {
		const { target } = stamp({ layers: ['public'] })
		const standards = readFileSync(join(target, 'docs', 'STANDARDS.md'), 'utf8')
		assert.match(standards, /vendored from the jig on 2026-08-11/)
	})

	it('refuses a non-empty target', () => {
		const { target } = stamp()
		assert.throws(
			() => composeProject({ templateRoot, target, name: 'proj', git: false }),
			/not empty/,
		)
	})
})
