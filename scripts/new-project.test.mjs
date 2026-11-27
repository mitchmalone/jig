// Generator tests: stamp into a temp dir without installing anything.
// The slow stamp-install-verify pass lives in smoke.mjs.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseXcodeProbe } from './xcode-status.mjs'

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

describe('session system', () => {
  it('stamps the two session commands and the script they drive', () => {
    const dir = stampOk('my-thing')
    for (const skill of ['session-start', 'session-end'])
      assert.match(
        read(dir, `.claude/skills/${skill}/SKILL.md`),
        new RegExp(`^---\\nname: ${skill}\\n`),
      )
    assert.match(read(dir, 'scripts/session.mjs'), /^#!\/usr\/bin\/env node/)
  })

  it('points the project at its own channel and backlog entries', () => {
    const dir = stampOk('my-thing', ['--title', 'MyThing'])
    assert.deepEqual(JSON.parse(read(dir, 'session.config.json')), {
      board: { scope: 'ramenamok', channel: 'my-thing' },
      backlog: {
        dataSource: '41f3d7d1-79ad-8045-a361-000b56ae7f12',
        project: 'MyThing',
      },
    })
  })

  it("takes another owner's team and backlog", () => {
    const dir = stampOk('my-thing', [
      '--board-scope',
      'acme',
      '--backlog',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    ])
    const config = JSON.parse(read(dir, 'session.config.json'))
    assert.equal(config.board.scope, 'acme')
    assert.equal(
      config.backlog.dataSource,
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
  })

  it('rejects settings that would break the stamped JSON', () => {
    for (const flag of ['--board-scope', '--backlog']) {
      const result = stamp('my-thing', [flag, 'a"b'])
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, new RegExp(flag))
    }
  })

  it('keeps decisions in the repo and nothing else of the old docs system', () => {
    const dir = stampOk('my-thing', PNPM)
    assert.ok(existsSync(join(dir, 'docs/DECISIONS.md')))
    for (const retired of ['STATUS.md', 'ROADMAP.md', 'JOURNAL.md', 'plans'])
      assert.equal(existsSync(join(dir, 'docs', retired)), false, retired)
  })

  it('leaves no pointer to a retired doc anywhere in a stamp', () => {
    const dir = stampOk('my-thing', PNPM)
    const stale = files(dir).filter((path) =>
      /docs\/(STATUS|ROADMAP|JOURNAL)\.md|docs\/plans|plans\/active/.test(
        readFileSync(path, 'utf8'),
      ),
    )
    assert.deepEqual(stale, [])
  })

  it('names the session commands in the stamped AGENTS.md', () => {
    const agents = read(stampOk('my-thing'), 'AGENTS.md')
    assert.match(agents, /\/session-start/)
    assert.match(agents, /\/session-end/)
    assert.match(agents, /`my-thing`/)
  })

  it('gives public repos a curated learnings file, private repos none', () => {
    assert.ok(existsSync(join(stampOk('my-thing', PNPM), 'docs/LEARNINGS.md')))
    assert.equal(
      existsSync(join(stampOk('my-thing'), 'docs/LEARNINGS.md')),
      false,
    )
  })

  // Stamping Swift runs swift-format, which only a Mac has.
  it(
    'keeps the session script beside the Swift flavor scripts',
    { skip: !isMac },
    () => {
    const dir = stampOk('my-thing', ['--flavors', 'desktop-swift'])
    assert.ok(existsSync(join(dir, 'scripts/session.mjs')))
    assert.ok(existsSync(join(dir, 'scripts/xcode.mjs')))
    },
  )
})

describe('parseXcodeProbe', () => {
  it('accepts a working xcodebuild', () => {
    assert.deepEqual(parseXcodeProbe({ status: 0, stderr: '' }), {
      ok: true,
      reason: '',
    })
  })

  it('quotes the first stderr line when Xcode is not usable', () => {
    const { ok, reason } = parseXcodeProbe({
      status: 1,
      stderr:
        "\nxcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance\nmore\n",
    })
    assert.equal(ok, false)
    assert.match(reason, /^Xcode not usable: xcode-select: error: tool 'xcodebuild' requires Xcode/)
    assert.doesNotMatch(reason, /more/)
    assert.match(reason, /xcode-select -p and xcodebuild -license/)
  })

  it('names a missing binary and a timeout', () => {
    const missing = parseXcodeProbe({ status: null, error: { code: 'ENOENT' } })
    assert.deepEqual(missing, { ok: false, reason: 'xcodebuild not found' })
    const timedOut = parseXcodeProbe({
      status: null,
      stderr: '',
      error: { code: 'ETIMEDOUT', message: 'spawnSync xcodebuild ETIMEDOUT' },
    })
    assert.match(timedOut.reason, /ETIMEDOUT/)
  })
})

describe('git environment', () => {
  // A git hook (lefthook pre-push → pnpm verify) exports GIT_DIR, and in a
  // linked worktree GIT_WORK_TREE and GIT_INDEX_FILE too. A stamp that
  // inherited them ran `git init` and its commit against the hook's repo.
  it('stamps its own repo and leaves the repo a hook points at untouched', () => {
    const base = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
    )
    const identity = {
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@jig.invalid',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@jig.invalid',
    }
    const sentinel = join(scratch, `sentinel-${counter++}`)
    mkdirSync(sentinel)
    const git = (args, cwd = sentinel) =>
      spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: { ...base, ...identity },
      })
    git(['init', '-q', '-b', 'main'])
    git(['commit', '-q', '--allow-empty', '--no-verify', '-m', 'sentinel'])
    const head = git(['rev-parse', 'HEAD']).stdout.trim()
    const config = readFileSync(join(sentinel, '.git', 'config'), 'utf8')

    const dir = join(scratch, `stamp-${counter++}`)
    const result = spawnSync(
      process.execPath,
      [
        join(jigRoot, 'scripts', 'new-project.mjs'),
        '--name',
        'hooked',
        '--dir',
        dir,
        ...PNPM,
      ],
      {
        encoding: 'utf8',
        env: {
          ...base,
          ...identity,
          GIT_DIR: join(sentinel, '.git'),
          GIT_WORK_TREE: sentinel,
          GIT_INDEX_FILE: join(sentinel, '.git', 'index'),
          GIT_PREFIX: '',
          GIT_OBJECT_DIRECTORY: join(sentinel, '.git', 'objects'),
          GIT_COMMON_DIR: join(sentinel, '.git'),
        },
      },
    )
    assert.equal(result.status, 0, result.stderr)

    assert.equal(git(['rev-parse', 'HEAD']).stdout.trim(), head)
    assert.equal(git(['log', '--oneline']).stdout.trim().split('\n').length, 1)
    assert.equal(readFileSync(join(sentinel, '.git', 'config'), 'utf8'), config)
    assert.equal(git(['status', '--porcelain']).stdout, '')

    assert.ok(existsSync(join(dir, '.git')), 'the stamp has its own repo')
    assert.match(
      git(['log', '--oneline'], dir).stdout,
      /chore: stamp project from the jig/,
    )
  })
})
