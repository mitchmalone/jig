// The deploy entrypoint: the `api` service in the root vercel.json runs this.
// There is no standalone production server — the API ships inside the app's
// Vercel project and is reached same-origin at /api/*.
export { app as default } from './app'
