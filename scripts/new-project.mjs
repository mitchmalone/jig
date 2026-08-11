#!/usr/bin/env node
// Stamp a new project from the jig (repo-local path; strangers use create-jig).
//
//   node scripts/new-project.mjs --name my-thing [--dir path] \
//     [--flavors www-next,api-hono] [--layers ci,public] \
//     [--author "Name"] [--no-git] [--verify]
//
// Compose order: base → flavors → layers (later files overwrite earlier).

import { execSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ONBOARD_PROMPT } from '../create-jig/src/agents.mjs'
import { parseArgs } from '../create-jig/src/args.mjs'
import { composeProject } from '../create-jig/src/compose.mjs'

const jigRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
	console.error(`error: ${message}`)
	process.exit(1)
}

let args
try {
	args = parseArgs(process.argv.slice(2))
} catch (error) {
	fail(error.message)
}

const author =
	args.author ??
	(() => {
		try {
			return execSync('git config user.name', { encoding: 'utf8' }).trim()
		} catch {
			return 'the author'
		}
	})()

let result
try {
	result = composeProject({
		templateRoot: join(jigRoot, 'template'),
		standardPath: join(jigRoot, 'AGENTS.md'),
		target: resolve(args.dir ?? args.name ?? ''),
		name: args.name,
		flavors: args.flavors,
		layers: args.layers,
		author,
		git: args.git,
		verify: args.verify,
	})
} catch (error) {
	fail(error.message)
}

const tool = result.isBun ? 'bun' : 'pnpm'
console.log(`\nstamped ${args.name} at ${result.target}`)
console.log(`  flavors: ${result.flavors.join(', ') || '(none)'}`)
console.log(`  layers:  ${result.layers.join(', ') || '(none)'}`)
console.log(`\nnext steps:`)
console.log(`  1. ${tool} install   # also installs git hooks`)
console.log(`  2. tell your agent: "${ONBOARD_PROMPT}"`)
