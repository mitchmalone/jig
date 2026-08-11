#!/usr/bin/env node
// npm create jig — stamp a project, then hand off to your coding agent.

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { ONBOARD_PROMPT, detectAgents, launchCommand } from '../src/agents.mjs'
import { parseArgs } from '../src/args.mjs'
import { composeProject, listAvailable } from '../src/compose.mjs'
import { confirm, interview } from '../src/prompts.mjs'
import { resolveTemplate } from '../src/template-source.mjs'

const HELP = `create-jig — stamp a project from the jig (github.com/mitchmalone/jig)

usage: npm create jig [name] [-- flags]
       node bin/create-jig.mjs --name my-thing --flavors api-hono --layers ci,public

flags:
  --name <kebab-case>   project name (positional also works)
  --dir <path>          target directory (default ./<name>)
  --flavors <a,b>       www-next, api-hono, web-vite, tui-bun, desktop-tauri
  --layers <a,b>        ci, public
  --author <name>       for LICENSE (default: git config user.name)
  --template <path>     use a local template dir instead of checkout/tarball
  --agent <id|none>     agent to launch after stamping (default: auto-detect)
  --verify              install dependencies and run the verify gate
  --no-git              skip git init + first commit
  --yes, -y             non-interactive: take flags as-is, don't launch an agent
`

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
if (args.help) {
	console.log(HELP)
	process.exit(0)
}

const { templateRoot, standardPath } = await resolveTemplate(args.template).catch(
	(error) => fail(error.message)
)

const interactive = !args.yes && process.stdin.isTTY
if (interactive) {
	await interview({
		args,
		flavorChoices: listAvailable(templateRoot, 'flavors'),
		layerChoices: listAvailable(templateRoot, 'layers'),
	})
}

const author =
	args.author ??
	(() => {
		try {
			return spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' })
				.stdout.trim()
		} catch {
			return 'the author'
		}
	})()

let result
try {
	result = composeProject({
		templateRoot,
		standardPath,
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

const agents = detectAgents()
const chosen =
	args.agent === 'none'
		? null
		: args.agent
			? (agents.find((agent) => agent.id === args.agent) ??
				fail(`agent "${args.agent}" not found on PATH`))
			: agents[0]

if (chosen && interactive) {
	const launch = await confirm(
		`launch ${chosen.label} in ${args.name} to onboard the project?`
	)
	if (launch) {
		const { cmd, args: cmdArgs } = launchCommand(chosen)
		const { status } = spawnSync(cmd, cmdArgs, {
			cwd: result.target,
			stdio: 'inherit',
		})
		process.exit(status ?? 0)
	}
}

console.log(`\nnext steps:`)
console.log(`  1. cd ${args.dir ?? args.name}`)
if (!args.verify) console.log(`  2. ${tool} install   # also installs git hooks`)
console.log(
	`  ${args.verify ? 2 : 3}. tell your agent: "${ONBOARD_PROMPT}"${
		chosen ? ` (detected: ${chosen.label})` : ''
	}`
)
