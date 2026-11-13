#!/usr/bin/env node
// Stamp-and-verify: stamp each supported composition into a temp dir, install,
// and run the stamp's own `verify` gate and build. Slow (network installs) —
// this is the jig's integration test, run by `pnpm verify`.
//
//   node scripts/smoke.mjs [pnpm|bun|swift ...]   # default: all available
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const generator = join(
  dirname(fileURLToPath(import.meta.url)),
  'new-project.mjs',
)

const has = (command) =>
  spawnSync('sh', ['-c', `command -v ${command}`]).status === 0

// Proves the deploy topology with a real, offline `vercel build`: a project
// rooted at the repo must produce the web and api services, and a project
// rooted at apps/www must build only the site. Project settings normally come
// from `vercel pull`; a hand-written stand-in keeps this offline and unlinked.
const VERCEL = 'npx -y vercel@65 build'
function vercelBuild(dir, settings, expected) {
  rmSync(join(dir, '.vercel'), { recursive: true, force: true })
  mkdirSync(join(dir, '.vercel'))
  writeFileSync(
    join(dir, '.vercel', 'project.json'),
    JSON.stringify({ projectId: 'prj_smoke', orgId: 'team_smoke', settings }),
  )
  const built =
    spawnSync('sh', ['-c', VERCEL], {
      cwd: dir,
      stdio: 'inherit',
      env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
    }).status === 0
  const missing = expected.filter(
    (path) => !existsSync(join(dir, '.vercel', 'output', path)),
  )
  for (const path of missing)
    console.error(`error: vercel build did not produce ${path}`)
  return built && missing.length === 0
}

const deployTopology = (dir) =>
  vercelBuild(dir, {}, [
    'services/web/static/index.html',
    'services/api/functions/index.func',
  ]) &&
  vercelBuild(dir, { rootDirectory: 'apps/www', framework: 'nextjs' }, [
    'static/index.html',
  ])

const compositions = {
  pnpm: {
    args: ['--flavors', 'www-next,api-hono,web-vite', '--layers', 'ci,public'],
    build: 'pnpm build',
    after: deployTopology,
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

// The stamp makes an initial commit; CI runners have no git identity. These
// only fill the gap — a configured identity or existing env still wins.
const hasGitIdentity =
  spawnSync('git', ['config', 'user.name']).status === 0 &&
  spawnSync('git', ['config', 'user.email']).status === 0
const env = hasGitIdentity
  ? process.env
  : {
      GIT_AUTHOR_NAME: 'jig smoke',
      GIT_AUTHOR_EMAIL: 'smoke@jig.invalid',
      GIT_COMMITTER_NAME: 'jig smoke',
      GIT_COMMITTER_EMAIL: 'smoke@jig.invalid',
      ...process.env,
    }

const scratch = mkdtempSync(join(tmpdir(), 'jig-smoke-'))
const results = []

for (const name of selected) {
  const { args, build, after, unavailable } = compositions[name]
  if (unavailable) {
    results.push([name, `skipped (${unavailable})`])
    continue
  }
  console.log(`\n=== smoke: ${name} ===`)
  const dir = join(scratch, name)
  const run = (command, commandArgs, cwd) =>
    spawnSync(command, commandArgs, { cwd, stdio: 'inherit', env }).status === 0
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
    (!build || run('sh', ['-c', build], dir)) &&
    (!after || after(dir))
  results.push([name, passed ? 'ok' : 'FAILED'])
}

console.log('\nsmoke results:')
for (const [name, outcome] of results) console.log(`  ${name}: ${outcome}`)

const failed = results.some(([, outcome]) => outcome === 'FAILED')
// Keep a failed stamp around for inspection.
if (failed) console.log(`\nstamps kept at ${scratch}`)
else rmSync(scratch, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
