#!/usr/bin/env node
// Stamp-and-verify: stamp each supported composition into a temp dir, install,
// and run the stamp's own `verify` gate and build. Slow (network installs) —
// this is the jig's integration test, run by `pnpm verify`.
//
//   node scripts/smoke.mjs [pnpm|bun|swift ...]   # default: all available
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const generator = join(
  dirname(fileURLToPath(import.meta.url)),
  'new-project.mjs',
)

const has = (command) =>
  spawnSync('sh', ['-c', `command -v ${command}`]).status === 0

const compositions = {
  pnpm: {
    args: ['--flavors', 'www-next,api-hono,web-vite', '--layers', 'ci,public'],
    build: 'pnpm build',
    unavailable: !has('pnpm') && 'pnpm not installed',
  },
  bun: {
    args: ['--flavors', 'tui-bun,www-next', '--layers', 'ci,public'],
    build: 'bun run build',
    unavailable: !has('bun') && 'bun not installed',
  },
  swift: {
    // `verify` already builds the app.
    args: ['--flavors', 'desktop-swift', '--layers', 'public'],
    unavailable:
      (process.platform !== 'darwin' && 'needs macOS') ||
      (!has('xcodebuild') && 'Xcode not installed'),
  },
}

const requested = process.argv.slice(2)
for (const name of requested)
  if (!compositions[name]) {
    console.error(`error: unknown composition "${name}"`)
    process.exit(1)
  }
const selected = requested.length > 0 ? requested : Object.keys(compositions)

const scratch = mkdtempSync(join(tmpdir(), 'jig-smoke-'))
const results = []

for (const name of selected) {
  const { args, build, unavailable } = compositions[name]
  if (unavailable) {
    results.push([name, `skipped (${unavailable})`])
    continue
  }
  console.log(`\n=== smoke: ${name} ===`)
  const dir = join(scratch, name)
  const run = (command, commandArgs, cwd) =>
    spawnSync(command, commandArgs, { cwd, stdio: 'inherit' }).status === 0
  const passed =
    run(process.execPath, [
      generator,
      '--name',
      `smoke-${name}`,
      '--dir',
      dir,
      '--verify',
      ...args,
    ]) &&
    (!build || run('sh', ['-c', build], dir))
  results.push([name, passed ? 'ok' : 'FAILED'])
}

console.log('\nsmoke results:')
for (const [name, outcome] of results) console.log(`  ${name}: ${outcome}`)

const failed = results.some(([, outcome]) => outcome === 'FAILED')
// Keep a failed stamp around for inspection.
if (failed) console.log(`\nstamps kept at ${scratch}`)
else rmSync(scratch, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
