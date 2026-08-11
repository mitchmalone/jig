import { describe, expect, it } from 'vitest'

import { healthSchema } from './index'

describe('healthSchema', () => {
	it('accepts a valid health payload', () => {
		expect(
			healthSchema.parse({ status: 'ok', version: '0.0.0' })
		).toEqual({ status: 'ok', version: '0.0.0' })
	})

	it('rejects an unknown status', () => {
		expect(() =>
			healthSchema.parse({ status: 'down', version: '0.0.0' })
		).toThrow()
	})
})
