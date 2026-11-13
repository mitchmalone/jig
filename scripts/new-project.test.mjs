// Generator tests: stamp into a temp dir without installing anything.
// The slow stamp-install-verify pass lives in smoke.mjs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const jigRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(join(tmpdir(), 'jig-test-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const isMac = process.platform === 'darwin'
const PNPM = ['--flavors', 'www-next,api-hono,web-vite', '--layers', 'ci,public']
const BUN = ['--flavors', 'tui-bun', '--layers', 'ci,public']
const SWIFT = ['--flavors', 'desktop-swift', '--layers', 'public']

let counter = 0
function stamp(name, extra = [], { root = jigRoot } = {}) {
  const dir = join(scratch, `stamp-${counter++}`)
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'scripts', 'new-project.mjs'),
      '--name',
      name,
      '--dir',
      dir,
      '--no-git',
      ...extra,
    ],
    { encoding: 'utf8' },
  )
  return { dir, status: result.status, stderr: result.stderr }
}

function stampOk(name, extra, options) {
  const result = stamp(name, extra, options)
  assert.equal(result.status, 0, result.stderr)
  return result.dir
}

function files(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8')
const TOKEN = /\{\{\s*[A-Z][A-Z0-9_]*\s*\}\}/

describe('placeholders', () => {
  const compositions = { pnpm: PNPM, bun: BUN, ...(isMac && { swift: SWIFT }) }
  for (const [label, extra] of Object.entries(compositions)) {
    it(`leaves no placeholder in a ${label} stamp`, () => {
      const dir = stampOk('my-thing', extra)
      const leftovers = files(dir).filter(
        (path) => TOKEN.test(path) || TOKEN.test(readFileSync(path, 'utf8')),
      )
      assert.deepEqual(leftovers, [])
    })
  }

  it('fails the stamp when a template placeholder cannot be substituted', () => {
    // The original bug: a formatter reshaped the token inside JSX.
    const root = join(scratch, 'jig-copy')
    for (const part of ['scripts', 'template', 'AGENTS.md'])
      cpSync(join(jigRoot, part), join(root, part), { recursive: true })
    writeFileSync(
      join(root, 'template/flavors/web-vite/apps/web/src/app.tsx'),
      'export const App = () => <h1>{{ PROJECT_NAME }}</h1>\n',
    )
    const result = stamp('my-thing', ['--flavors', 'web-vite'], { root })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /unsubstituted placeholder/)
    assert.match(result.stderr, /apps\/web\/src\/app\.tsx/)
  })

  it('vendors the standard verbatim', () => {
    const dir = stampOk('my-thing')
    const standard = readFileSync(join(jigRoot, 'AGENTS.md'), 'utf8')
    assert.ok(read(dir, 'docs/STANDARDS.md').endsWith(standard))
  })
})

describe('project name', () => {
  for (const name of ['my-', 'a--b', '-a', 'My-Thing', '1st'])
    it(`rejects "${name}" before writing anything`, () => {
      const result = stamp(name)
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /kebab-case/)
      assert.equal(existsSync(result.dir), false)
    })

  it('derives a human title from the kebab name', () => {
    const dir = stampOk('my-thing', PNPM)
    assert.match(read(dir, 'apps/web/index.html'), /<title>My Thing<\/title>/)
    assert.match(read(dir, 'apps/web/src/app.tsx'), /'My Thing'/)
    assert.match(read(dir, 'apps/www/src/app/layout.tsx'), /title: 'My Thing'/)
    assert.match(read(dir, 'apps/www/src/app/page.tsx'), /'My Thing'/)
    assert.match(read(dir, 'AGENTS.md'), /^# AGENTS\.md — My Thing$/m)
    assert.match(read(dir, 'package.json'), /"name": "my-thing"/)
  })

  it('takes an explicit --title', () => {
    const dir = stampOk('my-thing', [...PNPM, '--title', 'MyThing 2.0'])
    assert.match(read(dir, 'apps/web/index.html'), /<title>MyThing 2\.0</)
  })

  it('rejects a title that would break out of a string or tag', () => {
    const result = stamp('my-thing', ['--title', "Mitch's <App>"])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /--title/)
  })
})

describe('composition', () => {
  it('keeps the Bun hooks when the public layer is added', () => {
    const dir = stampOk('my-thing', BUN)
    const hooks = read(dir, 'lefthook.yml')
    assert.match(hooks, /bunx eslint/)
    assert.doesNotMatch(hooks, /pnpm/)
    assert.match(read(dir, '.lefthook/gitleaks.yml'), /gitleaks/)
    assert.deepEqual(readdirSync(join(dir, '.github/workflows')).sort(), [
      'release.yml',
      'verify.yml',
    ])
    assert.match(read(dir, '.github/workflows/verify.yml'), /setup-bun/)
  })

  it('only adds gitleaks with the public layer', () => {
    const dir = stampOk('my-thing', ['--flavors', 'web-vite'])
    assert.equal(existsSync(join(dir, '.lefthook')), false)
  })

  it('stamps desktop-swift with the public layer', { skip: !isMac }, () => {
    const dir = stampOk('my-thing', SWIFT)
    assert.match(read(dir, 'lefthook.yml'), /swift-format/)
    assert.match(read(dir, '.lefthook/gitleaks.yml'), /gitleaks/)
    assert.deepEqual(readdirSync(join(dir, '.github/workflows')), [
      'release.yml',
    ])
  })

  it('refuses the ci layer on desktop-swift before writing anything', () => {
    const result = stamp('my-thing', [
      '--flavors',
      'desktop-swift',
      '--layers',
      'ci',
    ])
    assert.notEqual(result.status, 0)
    assert.equal(existsSync(result.dir), false)
  })
})

describe('deploy topology', () => {
  it('stamps web and api as services of one Vercel project', () => {
    const dir = stampOk('my-thing', PNPM)
    const config = JSON.parse(read(dir, 'vercel.json'))
    assert.deepEqual(Object.keys(config.services).sort(), ['api', 'web'])
    assert.equal(config.services.api.root, 'apps/api')
    assert.ok(existsSync(join(dir, 'apps/api', config.services.api.entrypoint)))
    assert.deepEqual(config.rewrites[0], {
      source: '/api/(.*)',
      destination: { service: 'api' },
    })
    assert.equal(existsSync(join(dir, 'apps/api/vercel.json')), false)
    assert.ok(existsSync(join(dir, 'apps/api/src/deploy.test.ts')))
  })

  it('gives every Vercel build an ignore step', () => {
    const dir = stampOk('my-thing', PNPM)
    const app = JSON.parse(read(dir, 'vercel.json'))
    for (const service of Object.values(app.services))
      assert.match(service.ignoreCommand, /git diff --quiet/)
    const www = JSON.parse(read(dir, 'apps/www/vercel.json'))
    assert.match(www.ignoreCommand, /:\/apps\/www/)
  })

  it('leaves the deploy wiring out of an API-only stamp', () => {
    const dir = stampOk('my-thing', ['--flavors', 'api-hono'])
    assert.equal(existsSync(join(dir, 'vercel.json')), false)
    assert.equal(existsSync(join(dir, 'apps/api/src/deploy.test.ts')), false)
    assert.ok(existsSync(join(dir, 'apps/api/src/index.ts')))
  })
})

describe('stamped docs and env', () => {
  it('names the gate with the pnpm toolchain', () => {
    const dir = stampOk('my-thing', PNPM)
    assert.match(read(dir, 'AGENTS.md'), /`pnpm verify`/)
    assert.match(read(dir, 'CONTRIBUTING.md'), /`pnpm install`/)
  })

  it('names the gate with the Bun toolchain', () => {
    const dir = stampOk('my-thing', BUN)
    assert.match(read(dir, 'AGENTS.md'), /`bun run verify`/)
    assert.doesNotMatch(read(dir, 'AGENTS.md'), /pnpm/)
    assert.match(read(dir, 'CONTRIBUTING.md'), /`bun install`/)
  })

  it('ships the Infisical recipe, not dotenv examples', () => {
    const dir = stampOk('my-thing', PNPM)
    assert.match(read(dir, '.envrc.example'), /infisical export/)
    assert.equal(existsSync(join(dir, '.env.api.example')), false)
    assert.match(read(dir, '.gitignore'), /^\.envrc$/m)
  })
})
