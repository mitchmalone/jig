#!/usr/bin/env node
// Bring an existing project to this jig.
//
//   node scripts/restamp.mjs <project-dir>            # report only (dry run)
//   node scripts/restamp.mjs <project-dir> --apply    # write what the jig owns
//     [--flavors a,b] [--layers c,d]   # required when the repo has no .jig.json;
//                                      # otherwise they change the composition
//     [--name n] [--title "T"] [--bundle-id id]   # when they can't be read back
//     [--reference <dir>]   # keep the fresh stamp it compares against
//     [--force]             # overwrite uncommitted changes to jig-owned files
//
// It stamps the project's composition afresh into a scratch directory and
// compares, by owner (scripts/restamp-rules.mjs):
//   jig-owned      replaced whole with --apply
//   shared         never written; how each differs from the jig is reported
//   project-owned  never touched, except by the listed migrations
// Zero dependencies; bare Node and git.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withoutRepoGitEnv } from './git-env.mjs'
import { MIGRATIONS, classify, ownedDirectories } from './restamp-rules.mjs'

const generator = join(
  dirname(fileURLToPath(import.meta.url)),
  'new-project.mjs',
)

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

// --- arguments ---------------------------------------------------------------

const args = { apply: false, force: false }
{
  const argv = process.argv.slice(2)
  const list = (text) => text.split(',').filter(Boolean)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => argv[++i] ?? fail(`${arg} needs a value`)
    if (arg === '--apply') args.apply = true
    else if (arg === '--force') args.force = true
    else if (arg === '--flavors') args.flavors = list(value())
    else if (arg === '--layers') args.layers = list(value())
    else if (arg === '--name') args.name = value()
    else if (arg === '--title') args.title = value()
    else if (arg === '--bundle-id') args.bundleId = value()
    else if (arg === '--reference') args.reference = value()
    else if (arg.startsWith('--')) fail(`unknown argument: ${arg}`)
    else if (args.dir) fail(`one project directory at a time (got ${arg} too)`)
    else args.dir = arg
  }
}
if (!args.dir) fail('usage: restamp.mjs <project-dir> [--apply]')
const target = resolve(args.dir)
if (!existsSync(target) || !statSync(target).isDirectory())
  fail(`not a directory: ${target}`)

// --- what the project is -----------------------------------------------------

const readJson = (path) => {
  if (!existsSync(join(target, path))) return null
  try {
    return JSON.parse(readFileSync(join(target, path), 'utf8'))
  } catch (cause) {
    return fail(`${path} is not valid JSON: ${cause.message}`)
  }
}

const record = readJson('.jig.json')
const sessionConfig = readJson('session.config.json')

const flavors = args.flavors ?? record?.flavors
if (!flavors)
  fail(
    `${target} has no .jig.json (it was stamped before the jig recorded its composition). Name what it was stamped with: --flavors a,b [--layers c,d]. Pass --flavors '' for a base-only repo`,
  )
const layers = args.layers ?? record?.layers ?? []
const name = args.name ?? record?.name ?? readJson('package.json')?.name
if (!name) fail('cannot tell the project name: no .jig.json or package.json name. Pass --name')
const title = args.title ?? record?.title ?? sessionConfig?.backlog?.project
const bundleId = args.bundleId ?? record?.bundleId

// --- the reference: today's stamp of the same composition --------------------

const scratch = args.reference
  ? null
  : mkdtempSync(join(tmpdir(), 'jig-restamp-'))
const reference = args.reference ? resolve(args.reference) : join(scratch, name)
const cleanUp = () => scratch && rmSync(scratch, { recursive: true, force: true })

{
  const optional = (flag, value) => (value ? [flag, value] : [])
  const stamped = spawnSync(
    process.execPath,
    [
      generator,
      '--name',
      name,
      '--dir',
      reference,
      '--no-git',
      '--flavors',
      flavors.join(','),
      '--layers',
      layers.join(','),
      ...optional('--title', title),
      ...optional('--bundle-id', bundleId),
      ...optional('--board-scope', sessionConfig?.board?.scope),
      ...optional('--backlog', sessionConfig?.backlog?.dataSource),
    ],
    { encoding: 'utf8', env: withoutRepoGitEnv() },
  )
  if (stamped.status !== 0) {
    cleanUp()
    fail(`could not stamp the reference:\n${stamped.stderr.trim()}`)
  }
}

// --- compare ----------------------------------------------------------------

const filesUnder = (root, dir = '') => {
  if (!existsSync(join(root, dir))) return []
  return readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
}
const text = (root, path) => readFileSync(join(root, path), 'utf8')
const here = (path) => existsSync(join(target, path))

// A calling git hook exports GIT_DIR (and more in a worktree), which would
// point git at the hook's repo instead of the project.
const git = (gitArgs, cwd) =>
  spawnSync('git', gitArgs, { cwd, env: withoutRepoGitEnv(), encoding: 'utf8' })

const writes = [] // { path, action: 'create' | 'update' | 'remove' | 'migrate', content?, note? }
const shared = [] // { path, lines: [] }
const missingShared = []
const absentProject = []
const unclassified = []
let ownedCurrent = 0

// package.json: only what the jig asks for. What the project added is its own.
function packageDrift(path) {
  const jig = JSON.parse(text(reference, path))
  let mine
  try {
    mine = JSON.parse(text(target, path))
  } catch {
    return ['not valid JSON here']
  }
  const lines = []
  const show = (value) => JSON.stringify(value)
  for (const key of ['type', 'packageManager', 'engines'])
    if (show(jig[key]) !== show(mine[key]))
      lines.push(`${key}: jig ${show(jig[key])} · here ${show(mine[key])}`)
  for (const group of ['scripts', 'dependencies', 'devDependencies'])
    for (const [key, value] of Object.entries(jig[group] ?? {})) {
      const current = mine[group]?.[key]
      if (current === undefined)
        lines.push(`${group}.${key}: missing here (jig ${show(value)})`)
      else if (current !== value)
        lines.push(`${group}.${key}: jig ${show(value)} · here ${show(current)}`)
    }
  return lines
}

// Ignore files: only the jig's entries the project lacks.
function ignoreDrift(path) {
  const entries = (root) =>
    text(root, path)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  const mine = new Set(entries(target))
  const lacking = entries(reference).filter((line) => !mine.has(line))
  return lacking.length > 0
    ? ['entries the jig has and this repo lacks:', ...lacking.map((line) => `  ${line}`)]
    : []
}

// Everything else: a unified diff, from this repo (-) to the jig (+).
function textDrift(path) {
  if (text(target, path) === text(reference, path)) return []
  const diff = git(
    ['diff', '--no-index', '--no-color', join(target, path), join(reference, path)],
    tmpdir(),
  ).stdout
  const body = diff.split('\n').filter((line) => !/^(diff --git|index |--- |\+\+\+ )/.test(line))
  return [`--- ${path} (here)`, `+++ ${path} (jig)`, ...body].filter(
    (line, index, all) => line !== '' || index < all.length - 1,
  )
}

// Summaries are indented under the file; a diff keeps column 0 so the report
// can be read as a patch.
const indent = (lines) => lines.map((line) => `    ${line}`)
const drift = (path) =>
  path === 'package.json'
    ? indent(packageDrift(path))
    : /(^|\/)\.(git|prettier)ignore$/.test(path)
      ? indent(ignoreDrift(path))
      : textDrift(path)

for (const path of filesUnder(reference).sort()) {
  const owner = classify(path)
  if (owner === 'owned') {
    const content = text(reference, path)
    if (!here(path)) writes.push({ path, action: 'create', content })
    else if (text(target, path) !== content)
      writes.push({ path, action: 'update', content })
    else ownedCurrent++
  } else if (owner === 'shared' || owner === 'unclassified') {
    if (owner === 'unclassified') unclassified.push(path)
    if (!here(path)) missingShared.push(path)
    else {
      const lines = drift(path)
      if (lines.length > 0) shared.push({ path, lines })
    }
  } else if (!here(path) && !/^(apps|packages)\//.test(path)) {
    absentProject.push(path)
  }
}

// A jig-owned directory is replaced whole: what the jig no longer ships goes.
for (const dir of ownedDirectories)
  for (const path of filesUnder(target, dir))
    if (!existsSync(join(reference, path))) writes.push({ path, action: 'remove' })

for (const { file, summary, migrate } of MIGRATIONS) {
  if (!here(file)) continue
  const content = migrate(text(target, file))
  if (content !== null)
    writes.push({ path: file, action: 'migrate', content, note: summary })
}

// --- report -----------------------------------------------------------------

const out = []
const version = ({ commit, date } = {}) =>
  commit ? `${commit.slice(0, 12)} (${String(date).slice(0, 10)})` : 'an unrecorded jig'
const jigNow = JSON.parse(text(reference, '.jig.json')).jig

out.push(`re-stamp ${name} at ${target}${args.apply ? '' : ' (dry run)'}`)
out.push(`  stamped from: ${record ? version(record.jig) : 'no record (.jig.json absent)'}`)
out.push(`  this jig:     ${version(jigNow)}`)
out.push(`  flavors:      ${flavors.join(', ') || '(none)'}`)
out.push(`  layers:       ${layers.join(', ') || '(none)'}`)

out.push('', `jig-owned: replaced whole${args.apply ? '' : ' with --apply'}`)
for (const { path, action } of writes.filter((write) => write.action !== 'migrate'))
  out.push(`  ${action.padEnd(8)}${path}`)
out.push(`  ${ownedCurrent} already current`)

const migrations = writes.filter((write) => write.action === 'migrate')
if (migrations.length > 0) {
  out.push('', `migrations: the one change the new jig needs in a project file${args.apply ? '' : ', made with --apply'}`)
  for (const { path, note } of migrations) out.push(`  migrate ${path}: ${note}`)
}

if (shared.length > 0 || missingShared.length > 0) {
  out.push('', 'shared: never written. Merge what you want by hand')
  for (const path of missingShared) out.push(`  missing ${path}`)
  for (const { path, lines } of shared) {
    out.push('', `  ${path}`)
    out.push(...lines)
  }
}

if (absentProject.length > 0) {
  out.push('', 'project-owned: never touched. The jig stamps these once and this repo has none')
  for (const path of absentProject) out.push(`  absent  ${path}`)
}

if (unclassified.length > 0) {
  out.push('', 'unclassified (a jig bug: add them to scripts/restamp-rules.mjs); treated as shared')
  for (const path of unclassified) out.push(`  ${path}`)
}

const clean =
  writes.length === 0 &&
  shared.length === 0 &&
  missingShared.length === 0 &&
  absentProject.length === 0

// --- apply ------------------------------------------------------------------

if (args.apply && writes.length > 0 && !args.force) {
  const inRepo = git(['rev-parse', '--is-inside-work-tree'], target).status === 0
  const dirty = inRepo
    ? git(
        ['status', '--porcelain', '--', ...writes.filter(({ path }) => here(path)).map(({ path }) => path)],
        target,
      ).stdout.trim()
    : ''
  if (dirty) {
    cleanUp()
    fail(
      `these files have uncommitted changes that --apply would overwrite; commit or stash them, or pass --force:\n${dirty}`,
    )
  }
}

if (args.apply)
  for (const { path, action, content } of writes) {
    const file = join(target, path)
    if (action === 'remove') rmSync(file)
    else {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    }
  }

out.push('')
if (clean) out.push('nothing to do: this repo matches the jig')
else if (args.apply && writes.length > 0)
  out.push(
    `applied ${writes.length} change${writes.length === 1 ? '' : 's'}. Merge the shared files, run the project's verify, and commit`,
  )
else if (writes.length > 0)
  out.push(`dry run: nothing written. Re-run with --apply to make the ${writes.length} jig-owned change${writes.length === 1 ? '' : 's'}`)
else
  out.push(
    `${args.apply ? 'nothing written' : 'dry run'}: the jig-owned files are current; what is listed above is for you to merge`,
  )

if (args.reference) out.push(`reference stamp kept at ${reference}`)
console.log(out.join('\n'))
cleanUp()
