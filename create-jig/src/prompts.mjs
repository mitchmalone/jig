// Minimal interactive prompts on node:readline. Only used for values not
// supplied as flags; --yes skips everything and takes defaults.

import { createInterface } from 'node:readline/promises'

export async function interview({ args, flavorChoices, layerChoices }) {
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	try {
		if (!args.name) {
			args.name = (await rl.question('project name (kebab-case): ')).trim()
		}
		if (args.flavors.length === 0) {
			const answer = await rl.question(
				`flavors [${flavorChoices.join(', ')}] (comma-separated, empty for none): `
			)
			args.flavors = answer
				.split(',')
				.map((flavor) => flavor.trim())
				.filter(Boolean)
		}
		if (args.layers.length === 0) {
			const answer = await rl.question(
				`layers [${layerChoices.join(', ')}] (comma-separated, empty for none): `
			)
			args.layers = answer
				.split(',')
				.map((layer) => layer.trim())
				.filter(Boolean)
		}
		return args
	} finally {
		rl.close()
	}
}

export async function confirm(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	try {
		const answer = (await rl.question(`${question} [Y/n] `)).trim().toLowerCase()
		return answer === '' || answer === 'y' || answer === 'yes'
	} finally {
		rl.close()
	}
}
