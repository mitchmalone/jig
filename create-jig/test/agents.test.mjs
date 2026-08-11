import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { detectAgents, launchCommand } from '../src/agents.mjs'

function fakeBinDir(names) {
	const dir = mkdtempSync(join(tmpdir(), 'agents-'))
	for (const name of names) {
		const path = join(dir, name)
		writeFileSync(path, '#!/bin/sh\n')
		chmodSync(path, 0o755)
	}
	return dir
}

describe('detectAgents', () => {
	it('finds executables on the given PATH', () => {
		const dir = fakeBinDir(['claude', 'codex'])
		const found = detectAgents(dir).map((agent) => agent.id)
		assert.deepEqual(found, ['claude', 'codex'])
	})

	it('returns empty for a PATH with no agents', () => {
		assert.deepEqual(detectAgents(fakeBinDir(['ls'])), [])
	})
})

describe('launchCommand', () => {
	it('passes the onboarding prompt as the initial argument', () => {
		const { cmd, args } = launchCommand({ id: 'claude', bin: 'claude' })
		assert.equal(cmd, 'claude')
		assert.match(args[0], /0000-onboard\.md/)
	})
})
