import { describe, expect, it } from 'bun:test'

import { greeting } from './greeting'

describe('greeting', () => {
	it('includes the binary name', () => {
		expect(greeting('demo')).toContain('demo')
	})
})
