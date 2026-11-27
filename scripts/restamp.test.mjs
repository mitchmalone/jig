// Re-stamp tests: stamp into a temp dir, change the stamp the way a project
// would, and re-stamp over it. Nothing is installed.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { MIGRATIONS, OWNED, PROJECT, SHARED, classify } from './restamp-rules.mjs'

const jigRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(join(tmpdir(), 'jig-restamp-test-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

// GIT_* is exported to hooks (GIT_DIR in a worktree) and would point the
// children's git at the jig instead of the stamp.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
)
const node = (script, args) =>
  spawnSync(process.execPath, [join(jigRoot, 'scripts', script), ...args], {
    encoding: 'utf8',
    env,
  })

const isMac = process.platform === 'darwin'
const PNPM = ['--flavors', 'www-next,api-hono,web-vite', '--layers', 'ci,public']
const BUN = ['--flavors', 'tui-bun', '--layers', 'ci,public']
const SWIFT = ['--flavors', 'desktop-swift', '--layers', 'public']
const COMPOSITIONS = { pnpm: PNPM, bun: BUN, ...(isMac && { swift: SWIFT }) }

let counter = 0
function stamp(extra = [], name = 'my-thing') {
  const dir = join(scratch, `stamp-${counter++}`)
  const result = node('new-project.mjs', [
    '--name',
    name,
    '--dir',
    dir,
    '--no-git',
    ...extra,
  ])
  assert.equal(result.status, 0, result.stderr)
  return dir
}

function restamp(dir, extra = []) {
  const result = node('restamp.mjs', [dir, ...extra])
  return { ...result, out: result.stdout + result.stderr }
}

function restampOk(dir, extra) {
  const result = restamp(dir, extra)
  assert.equal(result.status, 0, result.out)
  return result.stdout
}

// --apply on a project as it would be: everything committed to git, so
// nothing it overwrites is lost.
function applyOk(dir, extra = []) {
  const gitIn = (...args) =>
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...args], {
      cwd: dir,
      env,
    })
  if (!existsSync(join(dir, '.git'))) gitIn('init', '-q', '-b', 'main')
  gitIn('add', '-A')
  gitIn('commit', '-q', '--allow-empty', '--no-verify', '-m', 'chore: before re-stamp')
  return restampOk(dir, [...extra, '--apply'])
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8')
const write = (dir, path, content) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), content)
}
const edit = (dir, path, change) => write(dir, path, change(read(dir, path)))

function snapshot(dir) {
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true, recursive: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((path) => !relative(dir, path).startsWith('.git/'))
      .map((path) => [relative(dir, path), readFileSync(path, 'utf8')])
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

// What an older stamp looked like: no record, a dated standard, the Board
// profile still in the session config.
function age(dir) {
  rmSync(join(dir, '.jig.json'))
  write(dir, 'docs/STANDARDS.md', '<!-- vendored from the jig on 2026-01-01 -->\n\nold\n')
  write(dir, 'scripts/session.mjs', '// old session script\n')
  edit(dir, 'session.config.json', (text) => {
    const config = JSON.parse(text)
    config.board.profile = 'claude'
    return `${JSON.stringify(config, null, 2)}\n`
  })
}

describe('the stamp record', () => {
  it('records the jig version and the composition in .jig.json', () => {
    const dir = stamp([...PNPM, '--title', 'MyThing'])
    const record = JSON.parse(read(dir, '.jig.json'))
    const head = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: jigRoot,
      encoding: 'utf8',
      env,
    }).stdout.trim()
    assert.equal(record.jig.commit, head)
    assert.match(record.jig.date, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(record.name, 'my-thing')
    assert.equal(record.title, 'MyThing')
    assert.deepEqual(record.flavors, ['www-next', 'api-hono', 'web-vite'])
    assert.deepEqual(record.layers, ['ci', 'public'])
  })

  it('names the jig commit in the vendored standard, not the day', () => {
    const dir = stamp()
    const { commit } = JSON.parse(read(dir, '.jig.json')).jig
    assert.ok(
      read(dir, 'docs/STANDARDS.md').startsWith(
        `<!-- vendored from the jig at ${commit.slice(0, 12)} (`,
      ),
    )
  })

  it('writes the record the way Prettier would', () => {
    assert.match(read(stamp(PNPM), '.jig.json'), /^ {2}"layers": \["ci", "public"\]$/m)
    assert.match(read(stamp(), '.jig.json'), /^ {2}"flavors": \[\],$/m)
    // Too long for one line: one entry per line.
    const long = read(
      stamp([
        '--flavors',
        'www-next,api-hono,web-vite,desktop-tauri,tui-bun,desktop-swift',
      ]),
      '.jig.json',
    )
    assert.match(long, /"flavors": \[\n {4}"www-next",\n/)
    for (const line of long.split('\n')) assert.ok(line.length <= 80, line)
  })

  // A record names the commit the files came from. A jig with uncommitted
  // changes to what it stamps did not stamp that commit, and says so.
  it('marks a record stamped from a jig with uncommitted changes', () => {
    const root = join(scratch, `jig-copy-${counter++}`)
    for (const part of ['scripts', 'template', 'AGENTS.md'])
      cpSync(join(jigRoot, part), join(root, part), { recursive: true })
    const gitIn = (...args) =>
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...args], {
        cwd: root,
        env,
        encoding: 'utf8',
      })
    gitIn('init', '-q', '-b', 'main')
    gitIn('add', '-A')
    gitIn('commit', '-q', '--no-verify', '-m', 'jig')
    const stampFrom = () => {
      const dir = join(scratch, `stamp-${counter++}`)
      const result = spawnSync(
        process.execPath,
        [join(root, 'scripts/new-project.mjs'), '--name', 'my-thing', '--dir', dir, '--no-git'],
        { encoding: 'utf8', env },
      )
      assert.equal(result.status, 0, result.stderr)
      return JSON.parse(read(dir, '.jig.json')).jig
    }
    assert.equal(stampFrom().dirty, undefined)
    write(root, 'template/base/CLAUDE.md', '@AGENTS.md\nchanged\n')
    const record = stampFrom()
    assert.equal(record.dirty, true)
    assert.equal(record.commit, gitIn('rev-parse', 'HEAD').stdout.trim())
  })

  it('records the bundle id of a Swift stamp', { skip: !isMac }, () => {
    const dir = stamp([...SWIFT, '--bundle-id', 'au.example.my-thing'])
    assert.equal(JSON.parse(read(dir, '.jig.json')).bundleId, 'au.example.my-thing')
  })
})

describe('ownership', () => {
  for (const [label, extra] of Object.entries(COMPOSITIONS))
    it(`classifies every file of a ${label} stamp exactly once`, () => {
      const dir = stamp(extra)
      const all = [...OWNED, ...SHARED, ...PROJECT]
      for (const path of Object.keys(snapshot(dir))) {
        // An exact path carves one file out of a directory pattern.
        const exact = all.filter((pattern) => pattern === path).length
        const under = all.filter(
          (pattern) => pattern.endsWith('/') && path.startsWith(pattern),
        ).length
        const hits = exact > 0 ? exact : under
        assert.equal(hits, 1, `${path} matches ${hits} ownership patterns`)
        assert.notEqual(classify(path), 'unclassified', path)
      }
    })

  it('covers the tauri flavor too', () => {
    const dir = stamp(['--flavors', 'desktop-tauri'])
    for (const path of Object.keys(snapshot(dir)))
      assert.notEqual(classify(path), 'unclassified', path)
  })

  it('owns the standard, the session script and commands; not project files', () => {
    for (const path of [
      '.jig.json',
      'docs/STANDARDS.md',
      'scripts/session.mjs',
      '.claude/skills/session-start/SKILL.md',
      '.claude/skills/session-end/SKILL.md',
    ])
      assert.equal(classify(path), 'owned', path)
    for (const path of [
      'package.json',
      'lefthook.yml',
      'tsconfig.base.json',
      'eslint.config.js',
      '.gitignore',
      'commitlint.config.js',
      '.github/workflows/verify.yml',
    ])
      assert.equal(classify(path), 'shared', path)
    for (const path of [
      'AGENTS.md',
      'DEVIATIONS.md',
      'docs/DECISIONS.md',
      'session.config.json',
      'apps/web/src/app.tsx',
      'packages/db/package.json',
    ])
      assert.equal(classify(path), 'project', path)
    assert.equal(classify('something/new.txt'), 'unclassified')
  })
})

describe('re-stamp', () => {
  for (const [label, extra] of Object.entries(COMPOSITIONS))
    it(`reports a fresh ${label} stamp as current and --apply changes nothing`, () => {
      const dir = stamp(extra)
      const before = snapshot(dir)
      const report = restampOk(dir)
      assert.match(report, /nothing to do/)
      applyOk(dir)
      assert.deepEqual(snapshot(dir), before)
    })

  it('is a dry run by default: reports, writes nothing', () => {
    const dir = stamp(PNPM)
    age(dir)
    const before = snapshot(dir)
    const report = restampOk(dir, PNPM)
    assert.deepEqual(snapshot(dir), before)
    assert.match(report, /dry run/)
    assert.match(report, /update +docs\/STANDARDS\.md/)
    assert.match(report, /update +scripts\/session\.mjs/)
    assert.match(report, /create +\.jig\.json/)
    assert.match(report, /--apply/)
  })

  it('replaces jig-owned files whole with --apply', () => {
    const fresh = snapshot(stamp(PNPM))
    const dir = stamp(PNPM)
    age(dir)
    write(dir, '.claude/skills/session-start/SKILL.md', 'stale\n')
    write(dir, '.claude/skills/session-start/extra.md', 'left by an old jig\n')
    rmSync(join(dir, 'local/README.md'))
    applyOk(dir, [...PNPM])
    const now = snapshot(dir)
    for (const path of Object.keys(fresh).filter(
      (path) => classify(path) === 'owned',
    ))
      assert.equal(now[path], fresh[path], path)
    assert.equal(existsSync(join(dir, '.claude/skills/session-start/extra.md')), false)
  })

  it('never touches project-owned files', () => {
    const dir = stamp(PNPM)
    age(dir)
    applyOk(dir, [...PNPM]) // settles the migrations
    write(dir, 'AGENTS.md', '# mine\n')
    write(dir, 'DEVIATIONS.md', '# mine\n')
    write(dir, 'docs/DECISIONS.md', '# mine\n')
    write(dir, 'apps/web/src/app.tsx', 'export const mine = 1\n')
    write(dir, 'packages/db/src/schema.ts', 'export const mine = 1\n')
    rmSync(join(dir, 'apps/www'), { recursive: true })
    edit(dir, 'session.config.json', (text) => text.replace('ramenamok', 'acme'))
    write(dir, 'docs/STANDARDS.md', 'drifted\n')
    const before = snapshot(dir)
    applyOk(dir)
    const now = snapshot(dir)
    delete before['docs/STANDARDS.md']
    delete now['docs/STANDARDS.md']
    assert.deepEqual(now, before)
  })

  it('reports shared files that differ and leaves them alone', () => {
    const dir = stamp(PNPM)
    edit(dir, 'package.json', (text) => {
      const pkg = JSON.parse(text)
      pkg.scripts.verify = 'pnpm test'
      pkg.scripts.mine = 'echo mine'
      delete pkg.devDependencies.lefthook
      pkg.devDependencies.prettier = '^2.0.0'
      pkg.devDependencies.zod = '^4.0.0'
      return `${JSON.stringify(pkg, null, 2)}\n`
    })
    edit(dir, '.gitignore', (text) => text.replace('.vercel/\n', 'mine/\n'))
    edit(dir, 'lefthook.yml', (text) => text.replace('pnpm verify', 'pnpm test'))
    rmSync(join(dir, 'commitlint.config.js'))
    const before = snapshot(dir)
    const report = applyOk(dir)
    assert.deepEqual(snapshot(dir), before)

    assert.match(report, /scripts\.verify/)
    assert.match(report, /devDependencies\.lefthook: missing/)
    assert.match(report, /devDependencies\.prettier.*\^2\.0\.0/)
    // What the project added is its own business.
    assert.doesNotMatch(report, /scripts\.mine|zod/)
    assert.match(report, / \.gitignore\n.*lacks:\n +\.vercel\//)
    assert.doesNotMatch(report, /mine\//)
    assert.match(report, /^-\s+run: pnpm test$/m)
    assert.match(report, /^\+\s+run: pnpm verify$/m)
    assert.match(report, /missing +commitlint\.config\.js/)
    assert.doesNotMatch(report, /tsconfig\.base\.json/)
  })

  it('names stamp-once files the project lacks, outside apps and packages', () => {
    const dir = stamp(PNPM)
    rmSync(join(dir, 'DEVIATIONS.md'))
    rmSync(join(dir, 'apps/www'), { recursive: true })
    const report = applyOk(dir)
    assert.match(report, /absent +DEVIATIONS\.md/)
    assert.doesNotMatch(report, /apps\/www/)
    assert.equal(existsSync(join(dir, 'DEVIATIONS.md')), false)
  })

  it('updates the record on a re-stamp', () => {
    const dir = stamp(PNPM)
    edit(dir, '.jig.json', (text) =>
      text.replace(/"commit": "[0-9a-f]+"/, '"commit": "0000000"'),
    )
    const report = applyOk(dir)
    assert.match(report, /0000000/)
    const record = JSON.parse(read(dir, '.jig.json'))
    assert.match(record.jig.commit, /^[0-9a-f]{40}$/)
    assert.deepEqual(record.flavors, ['www-next', 'api-hono', 'web-vite'])
  })

  it('needs the flavors named when the repo has no record', () => {
    const dir = stamp(PNPM)
    age(dir)
    const result = restamp(dir)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /--flavors/)
  })

  it('re-stamps a repo with no record from explicit flavors, and records them', () => {
    const dir = stamp([...BUN, '--title', 'MyThing'])
    age(dir)
    applyOk(dir, [...BUN])
    const record = JSON.parse(read(dir, '.jig.json'))
    assert.equal(record.name, 'my-thing')
    assert.equal(record.title, 'MyThing') // read back from session.config.json
    assert.deepEqual(record.flavors, ['tui-bun'])
    assert.deepEqual(record.layers, ['ci', 'public'])
    assert.match(restampOk(dir), /nothing to do/)
  })

  it('lets explicit flags change a recorded composition', () => {
    const dir = stamp(['--flavors', 'web-vite'])
    const report = applyOk(dir, ['--layers', 'public'])
    assert.match(report, /create +\.lefthook\/gitleaks\.yml/)
    assert.match(report, /missing +CONTRIBUTING\.md/)
    assert.deepEqual(JSON.parse(read(dir, '.jig.json')).layers, ['public'])
  })

  it('re-stamps a Swift repo', { skip: !isMac }, () => {
    const dir = stamp([...SWIFT, '--bundle-id', 'au.example.my-thing'])
    age(dir)
    write(dir, 'docs/SWIFT.md', 'old\n')
    const sources = read(dir, 'apps/app/Sources/MyThingApp.swift')
    applyOk(dir, [...SWIFT, '--bundle-id', 'au.example.my-thing'])
    assert.notEqual(read(dir, 'docs/SWIFT.md'), 'old\n')
    assert.equal(read(dir, 'apps/app/Sources/MyThingApp.swift'), sources)
    assert.equal(JSON.parse(read(dir, '.jig.json')).bundleId, 'au.example.my-thing')
    assert.match(restampOk(dir), /nothing to do/)
  })

  it('keeps the reference stamp when asked', () => {
    const dir = stamp(PNPM)
    const reference = join(scratch, 'reference')
    restampOk(dir, ['--reference', reference])
    assert.ok(existsSync(join(reference, 'package.json')))
    assert.equal(read(reference, '.jig.json'), read(dir, '.jig.json'))
  })

  it('refuses a directory that is not a project', () => {
    const result = restamp(join(scratch, 'nowhere'))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /not a directory/)
  })

  it('refuses to overwrite uncommitted changes to a jig-owned file', () => {
    const dir = stamp(PNPM)
    const git = (...args) =>
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...args], {
        cwd: dir,
        env,
      })
    git('init', '-q', '-b', 'main')
    git('add', '-A')
    git('commit', '-q', '-m', 'chore: stamp', '--no-verify')
    write(dir, 'scripts/session.mjs', '// hand-edited\n')
    const result = restamp(dir, ['--apply'])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /uncommitted/)
    assert.equal(read(dir, 'scripts/session.mjs'), '// hand-edited\n')
    restampOk(dir, ['--apply', '--force'])
    assert.notEqual(read(dir, 'scripts/session.mjs'), '// hand-edited\n')
  })

  // Run from a git hook, GIT_DIR (and more, in a worktree) points at the
  // hook's repo: the dirty check must still read the project's.
  it("checks the project's repo, not the one a calling git hook points at", () => {
    const identity = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid']
    const gitIn = (cwd, ...args) =>
      spawnSync('git', [...identity, ...args], { cwd, env, encoding: 'utf8' })
    const sentinel = join(scratch, `sentinel-${counter++}`)
    mkdirSync(sentinel)
    gitIn(sentinel, 'init', '-q', '-b', 'main')
    gitIn(sentinel, 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'sentinel')
    const head = gitIn(sentinel, 'rev-parse', 'HEAD').stdout.trim()
    const config = read(sentinel, '.git/config')

    const dir = stamp(PNPM)
    gitIn(dir, 'init', '-q', '-b', 'main')
    gitIn(dir, 'add', '-A')
    gitIn(dir, 'commit', '-q', '--no-verify', '-m', 'chore: stamp')
    write(dir, 'scripts/session.mjs', '// hand-edited\n')
    const result = spawnSync(
      process.execPath,
      [join(jigRoot, 'scripts', 'restamp.mjs'), dir, '--apply'],
      {
        encoding: 'utf8',
        env: {
          ...env,
          GIT_DIR: join(sentinel, '.git'),
          GIT_WORK_TREE: sentinel,
          GIT_INDEX_FILE: join(sentinel, '.git', 'index'),
          GIT_COMMON_DIR: join(sentinel, '.git'),
        },
      },
    )
    assert.notEqual(result.status, 0, result.stdout)
    assert.match(result.stderr, /uncommitted/)
    assert.equal(read(dir, 'scripts/session.mjs'), '// hand-edited\n')
    assert.equal(gitIn(sentinel, 'rev-parse', 'HEAD').stdout.trim(), head)
    assert.equal(read(sentinel, '.git/config'), config)
  })
})

describe('migrations', () => {
  it('removes board.profile from session.config.json and keeps the rest', () => {
    const dir = stamp(PNPM)
    age(dir)
    edit(dir, 'session.config.json', (text) => text.replace('ramenamok', 'acme'))
    const dry = restampOk(dir, PNPM)
    assert.match(dry, /migrate +session\.config\.json.*board\.profile/)
    assert.equal(JSON.parse(read(dir, 'session.config.json')).board.profile, 'claude')

    applyOk(dir, [...PNPM])
    assert.deepEqual(JSON.parse(read(dir, 'session.config.json')), {
      board: { scope: 'acme', channel: 'my-thing' },
      backlog: {
        dataSource: '41f3d7d1-79ad-8045-a361-000b56ae7f12',
        project: 'My Thing',
      },
    })
    assert.match(restampOk(dir), /nothing to do/)
  })

  it('leaves a config that needs no migration byte for byte', () => {
    const migration = MIGRATIONS.find(({ file }) => file === 'session.config.json')
    const text = '{"board":{"scope":"acme","channel":"x"},"backlog":{}}'
    assert.equal(migration.migrate(text), null)
    assert.equal(migration.migrate('not json'), null)
  })
})

describe('apply safety', () => {
  const identity = ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid']
  const gitIn = (cwd, ...args) =>
    spawnSync('git', [...identity, ...args], { cwd, env, encoding: 'utf8' })
  const committed = (dir) => {
    gitIn(dir, 'init', '-q', '-b', 'main')
    gitIn(dir, 'add', '-A')
    gitIn(dir, 'commit', '-q', '--no-verify', '-m', 'chore: stamp')
    return dir
  }

  it('never writes through a symlinked jig-owned file', () => {
    const dir = stamp(PNPM)
    rmSync(join(dir, 'CLAUDE.md'))
    symlinkSync('AGENTS.md', join(dir, 'CLAUDE.md'))
    committed(dir)
    const agents = read(dir, 'AGENTS.md')
    const result = restamp(dir, ['--apply'])
    assert.notEqual(result.status, 0, result.out)
    assert.match(result.stderr, /symlink/)
    assert.equal(read(dir, 'AGENTS.md'), agents)
    assert.ok(lstatSync(join(dir, 'CLAUDE.md')).isSymbolicLink())
  })

  it('refuses --apply outside a git work tree unless forced', () => {
    const dir = stamp(PNPM)
    edit(dir, 'CLAUDE.md', (text) => `${text}mine\n`)
    const result = restamp(dir, ['--apply'])
    assert.notEqual(result.status, 0, result.out)
    assert.match(result.stderr, /not a git work tree/)
    assert.match(read(dir, 'CLAUDE.md'), /mine/)
    restampOk(dir, ['--apply', '--force'])
    assert.doesNotMatch(read(dir, 'CLAUDE.md'), /mine/)
  })

  it('refuses to remove or overwrite a gitignored file in a jig-owned path', () => {
    const dir = stamp(PNPM)
    edit(dir, '.gitignore', (text) => `${text}.claude/\n`)
    committed(dir)
    write(dir, '.claude/skills/session-start/mine.md', 'mine\n')
    const result = restamp(dir, ['--apply'])
    assert.notEqual(result.status, 0, result.out)
    assert.match(result.stderr, /mine\.md/)
    assert.equal(read(dir, '.claude/skills/session-start/mine.md'), 'mine\n')
  })

  it('refuses to recreate a tracked jig-owned file deleted in the work tree', () => {
    const dir = stamp(PNPM)
    write(dir, 'docs/STANDARDS.md', 'old, but committed\n')
    committed(dir)
    rmSync(join(dir, 'scripts/session.mjs'))
    const result = restamp(dir, ['--apply'])
    assert.notEqual(result.status, 0, result.out)
    assert.match(result.stderr, /scripts\/session\.mjs/)
  })
})

describe('read-back and report', () => {
  it('reads the bundle id back from project.yml when there is no record', { skip: !isMac }, () => {
    const dir = stamp([...SWIFT, '--bundle-id', 'com.acme.swifty'])
    age(dir)
    applyOk(dir, [...SWIFT])
    assert.equal(JSON.parse(read(dir, '.jig.json')).bundleId, 'com.acme.swifty')
  })

  it("reports the www app's ignore step when it differs from the jig", () => {
    const dir = stamp(PNPM)
    edit(dir, 'apps/www/vercel.json', (text) =>
      text.replace(/"ignoreCommand": ".*"/, '"ignoreCommand": "git diff --quiet HEAD^ HEAD"'),
    )
    const before = snapshot(dir)
    const report = applyOk(dir)
    assert.match(report, /apps\/www\/vercel\.json/)
    assert.match(report, /HEAD\^/)
    assert.deepEqual(snapshot(dir), before)
  })

  it('says nothing of the www ignore step when the project has no www app', () => {
    const dir = stamp(PNPM)
    rmSync(join(dir, 'apps/www'), { recursive: true })
    assert.doesNotMatch(restampOk(dir), /apps\/www/)
  })

  it('reports a root package.json that lost its workspaces', () => {
    const dir = stamp(BUN)
    edit(dir, 'package.json', (text) => {
      const pkg = JSON.parse(text)
      delete pkg.workspaces
      return `${JSON.stringify(pkg, null, 2)}\n`
    })
    assert.match(restampOk(dir), /workspaces/)
  })
})
