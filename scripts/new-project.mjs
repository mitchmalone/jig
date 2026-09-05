#!/usr/bin/env node
// Stamp a new project from the jig.
//
//   node scripts/new-project.mjs --name my-thing [--dir path] \
//     [--flavors www-next,api-hono] [--layers ci,public] \
//     [--author "Name"] [--bundle-id com.example.my-thing] [--no-git] [--verify]
//
// Compose order: base → flavors → layers (later files overwrite earlier).
// Zero dependencies; bare Node.
import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const jigRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const templateRoot = join(jigRoot, 'template')

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { flavors: [], layers: [], git: true, verify: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--name') args.name = argv[++i]
    else if (arg === '--dir') args.dir = argv[++i]
    else if (arg === '--flavors')
      args.flavors = argv[++i].split(',').filter(Boolean)
    else if (arg === '--layers')
      args.layers = argv[++i].split(',').filter(Boolean)
    else if (arg === '--author') args.author = argv[++i]
    else if (arg === '--bundle-id') args.bundleId = argv[++i]
    else if (arg === '--no-git') args.git = false
    else if (arg === '--verify') args.verify = true
    else fail(`unknown argument: ${arg}`)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))

if (!args.name) fail('--name is required')
if (!/^[a-z][a-z0-9-]*$/.test(args.name))
  fail('--name must be kebab-case: lowercase letters, digits, hyphens')

const available = (kind) =>
  readdirSync(join(templateRoot, kind), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

for (const flavor of args.flavors)
  if (!available('flavors').includes(flavor))
    fail(
      `unknown flavor "${flavor}" (have: ${available('flavors').join(', ')})`,
    )
for (const layer of args.layers)
  if (!available('layers').includes(layer))
    fail(`unknown layer "${layer}" (have: ${available('layers').join(', ')})`)

const target = resolve(args.dir ?? args.name)
if (existsSync(target) && readdirSync(target).length > 0)
  fail(`target directory is not empty: ${target}`)

const author =
  args.author ??
  (() => {
    try {
      return execSync('git config user.name', { encoding: 'utf8' }).trim()
    } catch {
      return 'the author'
    }
  })()

// Swift module names and Xcode targets need PascalCase: my-thing → MyThing.
const pascalName = args.name
  .split('-')
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join('')
const bundleId = args.bundleId ?? `com.example.${args.name}`
if (!/^[A-Za-z0-9.-]+\.[A-Za-z0-9-]+$/.test(bundleId))
  fail('--bundle-id must be reverse-DNS, e.g. com.example.my-thing')
const bundleIdPrefix = bundleId.slice(0, bundleId.lastIndexOf('.'))

// One toolchain per repo. Flavors that swap it are named here; the CI layer
// ships one `verify-<toolchain>.yml` per entry (`verify.yml` is pnpm's).
const toolchain = args.flavors.includes('tui-bun')
  ? 'bun'
  : args.flavors.includes('desktop-swift')
    ? 'swift'
    : 'pnpm'
const pm = toolchain === 'bun' ? 'bun' : 'pnpm'

// Swift repos verify on the developer's Mac via the pre-push hook; macOS runners
// are reserved for release builds (2026-09-05 decision).
if (toolchain === 'swift' && args.layers.includes('ci'))
  fail('the ci layer does not apply to desktop-swift — the pre-push hook is the gate; runners are for releases')

// --- compose ---------------------------------------------------------------

const skipNames = new Set(['FLAVOR.md', 'LAYER.md'])
const renameExceptions = new Set(['_TEMPLATE.md'])

function copyLayer(from) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (skipNames.has(entry.name)) continue
    const src = join(from, entry.name)
    const dest = join(target, entry.name)
    cpSync(src, dest, { recursive: true, force: true })
  }
}

mkdirSync(target, { recursive: true })
copyLayer(join(templateRoot, 'base'))
for (const flavor of args.flavors)
  copyLayer(join(templateRoot, 'flavors', flavor))
for (const layer of args.layers) copyLayer(join(templateRoot, 'layers', layer))

// --- post-compose fixups ---------------------------------------------------

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, visit)
    visit(path, entry)
  }
}

const substitutions = [
  ['{{PROJECT_NAME}}', args.name],
  ['{{PROJECT_PASCAL}}', pascalName],
  ['{{BUNDLE_ID_PREFIX}}', bundleIdPrefix],
  ['{{BUNDLE_ID}}', bundleId],
  ['{{AUTHOR}}', author],
  ['{{YEAR}}', String(new Date().getFullYear())],
]
const substitute = (text) =>
  substitutions.reduce(
    (acc, [token, value]) => acc.replaceAll(token, value),
    text,
  )

// 1. Path fixups, deepest first so parent renames don't orphan children:
//    `_name` → `.name`, and `{{TOKEN}}` in file/directory names.
const isDotfileAlias = (name) =>
  name.startsWith('_') && !renameExceptions.has(name)
const renames = []
walk(target, (path, entry) => {
  if (isDotfileAlias(entry.name) || entry.name.includes('{{'))
    renames.push(path)
})
renames
  .sort((a, b) => b.length - a.length)
  .forEach((path) => {
    const dir = dirname(path)
    const name = path.slice(dir.length + 1)
    const renamed = isDotfileAlias(name)
      ? `.${name.slice(1)}`
      : substitute(name)
    renameSync(path, join(dir, renamed))
  })

// 2. Toolchain-dependent CI workflow: keep the matching variant.
const workflows = join(target, '.github', 'workflows')
if (existsSync(workflows)) {
  const wanted =
    toolchain === 'pnpm' ? 'verify.yml' : `verify-${toolchain}.yml`
  const variants = readdirSync(workflows).filter((file) =>
    /^verify(-[a-z]+)?\.yml$/.test(file),
  )
  if (!variants.includes(wanted))
    fail(`ci layer has no workflow for the ${toolchain} toolchain`)
  // Delete the losers before renaming the winner, or `verify.yml` gets
  // renamed over and then removed as the stale pnpm variant.
  for (const file of variants)
    if (file !== wanted) rmSync(join(workflows, file))
  renameSync(join(workflows, wanted), join(workflows, 'verify.yml'))
}

// 3. Toolchain swaps drop the base files that no longer apply.
const dropped = {
  pnpm: [],
  bun: ['pnpm-workspace.yaml'],
  swift: ['tsconfig.base.json', 'eslint.config.js'],
}
for (const file of dropped[toolchain])
  rmSync(join(target, file), { force: true })

// 4. Every stamp vendors the standard — the jig is a stamp, not a runtime
// dependency; the in-repo copy governs from here on.
{
  const standard = readFileSync(join(jigRoot, 'AGENTS.md'), 'utf8')
  const stamp = `<!-- vendored from the jig on ${new Date().toISOString().slice(0, 10)} -->\n\n`
  mkdirSync(join(target, 'docs'), { recursive: true })
  writeFileSync(join(target, 'docs', 'STANDARDS.md'), stamp + standard)
}

// 5. Placeholder substitution in file contents.
walk(target, (path, entry) => {
  if (!entry.isFile()) return
  if (statSync(path).size > 512 * 1024) return
  const content = readFileSync(path, 'utf8')
  const replaced = substitute(content)
  if (replaced !== content) writeFileSync(path, replaced)
})

// --- git + verify ----------------------------------------------------------

const run = (cmd) => execSync(cmd, { cwd: target, stdio: 'inherit' })

// 6. Swift import order depends on the project name (`<Name>Core` sorts
// either side of `SwiftUI`), so the stamp is formatted, not hand-sorted.
if (toolchain === 'swift')
  run('xcrun swift-format format -i --recursive apps packages')

if (args.git) {
  run('git init -q -b main')
  run('git add -A')
  run(`git commit -q -m "chore: stamp project from the jig" --no-verify`)
}

if (args.verify) {
  if (toolchain === 'swift') run('brew bundle --no-upgrade')
  run(`${pm} install`)
  run(`${pm} run verify`)
}

console.log(`\nstamped ${args.name} at ${target}`)
console.log(`  flavors: ${args.flavors.join(', ') || '(none)'}`)
console.log(`  layers:  ${args.layers.join(', ') || '(none)'}`)
console.log(`\nnext steps:`)
if (toolchain === 'swift')
  console.log(`  0. brew bundle   # XcodeGen; swift-format ships with Xcode`)
console.log(`  1. ${pm} install   # also installs git hooks`)
console.log(`  2. fill in AGENTS.md (identity, stack, invariants)`)
console.log(`  3. write your first plan in docs/plans/active/`)
