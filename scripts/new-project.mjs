#!/usr/bin/env node
// Stamp a new project from the jig.
//
//   node scripts/new-project.mjs --name my-thing [--dir path] \
//     [--flavors www-next,api-hono] [--layers ci,public] \
//     [--author "Name"] [--no-git] [--verify]
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

const isBun = args.flavors.includes('tui-bun')

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

// 1. `_name` → `.name` (deepest first so parent renames don't orphan paths)
const renames = []
walk(target, (path, entry) => {
  if (entry.name.startsWith('_') && !renameExceptions.has(entry.name))
    renames.push(path)
})
renames
  .sort((a, b) => b.length - a.length)
  .forEach((path) => {
    const dir = dirname(path)
    const name = path.slice(dir.length + 1)
    renameSync(path, join(dir, `.${name.slice(1)}`))
  })

// 2. Toolchain-dependent CI workflow: keep the matching variant.
const workflows = join(target, '.github', 'workflows')
const bunVariant = join(workflows, 'verify-bun.yml')
if (existsSync(bunVariant)) {
  if (isBun) renameSync(bunVariant, join(workflows, 'verify.yml'))
  else rmSync(bunVariant)
}

// 3. Bun repos have no pnpm workspace file.
if (isBun) rmSync(join(target, 'pnpm-workspace.yaml'), { force: true })

// 4. Every stamp vendors the standard — the jig is a stamp, not a runtime
// dependency; the in-repo copy governs from here on.
{
  const standard = readFileSync(join(jigRoot, 'AGENTS.md'), 'utf8')
  const stamp = `<!-- vendored from the jig on ${new Date().toISOString().slice(0, 10)} -->\n\n`
  mkdirSync(join(target, 'docs'), { recursive: true })
  writeFileSync(join(target, 'docs', 'STANDARDS.md'), stamp + standard)
}

// 5. Placeholder substitution.
const substitutions = [
  ['{{PROJECT_NAME}}', args.name],
  ['{{AUTHOR}}', author],
  ['{{YEAR}}', String(new Date().getFullYear())],
]
walk(target, (path, entry) => {
  if (!entry.isFile()) return
  if (statSync(path).size > 512 * 1024) return
  const content = readFileSync(path, 'utf8')
  let replaced = content
  for (const [token, value] of substitutions)
    replaced = replaced.replaceAll(token, value)
  if (replaced !== content) writeFileSync(path, replaced)
})

// --- git + verify ----------------------------------------------------------

const run = (cmd) => execSync(cmd, { cwd: target, stdio: 'inherit' })

if (args.git) {
  run('git init -q -b main')
  run('git add -A')
  run(`git commit -q -m "chore: stamp project from the jig" --no-verify`)
}

if (args.verify) {
  run(isBun ? 'bun install' : 'pnpm install')
  run(isBun ? 'bun run verify' : 'pnpm verify')
}

console.log(`\nstamped ${args.name} at ${target}`)
console.log(`  flavors: ${args.flavors.join(', ') || '(none)'}`)
console.log(`  layers:  ${args.layers.join(', ') || '(none)'}`)
console.log(`\nnext steps:`)
console.log(
  `  1. ${isBun ? 'bun' : 'pnpm'} install   # also installs git hooks`,
)
console.log(`  2. fill in AGENTS.md (identity, stack, invariants)`)
console.log(`  3. write your first plan in docs/plans/active/`)
