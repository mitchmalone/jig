import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseArgs } from '../src/args.mjs'

describe('parseArgs', () => {
	it('accepts the name positionally', () => {
		assert.equal(parseArgs(['my-thing']).name, 'my-thing')
	})

	it('splits flavors and layers on commas', () => {
		const args = parseArgs(['--flavors', 'api-hono,web-vite', '--layers', 'ci'])
		assert.deepEqual(args.flavors, ['api-hono', 'web-vite'])
		assert.deepEqual(args.layers, ['ci'])
	})

	it('defaults to git on, verify off, interactive', () => {
		const args = parseArgs([])
		assert.equal(args.git, true)
		assert.equal(args.verify, false)
		assert.equal(args.yes, false)
	})

	it('rejects unknown flags', () => {
		assert.throws(() => parseArgs(['--bogus']), /unknown argument/)
	})
})
