// Detect the user's coding agent and build the onboarding handoff.

import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'

export const KNOWN_AGENTS = [
	{ id: 'claude', bin: 'claude', label: 'Claude Code' },
	{ id: 'cursor', bin: 'cursor-agent', label: 'Cursor' },
	{ id: 'codex', bin: 'codex', label: 'Codex CLI' },
	{ id: 'opencode', bin: 'opencode', label: 'opencode' },
	{ id: 'gemini', bin: 'gemini', label: 'Gemini CLI' },
]

export function detectAgents(pathVar = process.env.PATH ?? '') {
	const dirs = pathVar.split(delimiter).filter(Boolean)
	return KNOWN_AGENTS.filter((agent) =>
		dirs.some((dir) => {
			try {
				accessSync(join(dir, agent.bin), constants.X_OK)
				return true
			} catch {
				return false
			}
		})
	)
}

export const ONBOARD_PROMPT =
	'Follow docs/plans/active/0000-onboard.md to set this project up.'

export function launchCommand(agent) {
	// Every known agent accepts an initial prompt as a positional argument.
	return { cmd: agent.bin, args: [ONBOARD_PROMPT] }
}
