import { describe, expect, it } from 'vitest'

import { App } from './app'

describe('App', () => {
	it('is a renderable component', () => {
		expect(App()).toBeTruthy()
	})
})
