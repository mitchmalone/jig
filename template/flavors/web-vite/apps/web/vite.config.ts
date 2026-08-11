import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react()],
	server: {
		// Same-origin API during dev; the browser never calls services directly.
		proxy: { '/api': 'http://localhost:8787' },
	},
})
