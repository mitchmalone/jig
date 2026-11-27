// Who owns each file of a stamp. The one place a re-stamp looks to decide
// what it may write (scripts/restamp.mjs). Paths are as stamped (`.gitignore`,
// not `_gitignore`); a pattern ending in `/` covers the whole directory.
//
// Every file the template ships must have exactly one owner: a test stamps
// each composition and fails on a file that matches none, or two. An exact
// path listed under OWNED or SHARED carves that one file out of a PROJECT
// directory (apps/www/vercel.json). Adding a template file means deciding
// here who owns it.

// The jig's: tested in the jig, copied unchanged, replaced whole on a
// re-stamp. An owned directory is replaced whole too: a file in it that the
// jig no longer ships is removed. Fix these in the jig, never in a project.
export const OWNED = [
  '.jig.json',
  'CLAUDE.md',
  'docs/STANDARDS.md',
  'docs/SWIFT.md',
  'docs/RUST.md',
  'scripts/session.mjs',
  'scripts/xcode.mjs',
  '.claude/skills/session-start/',
  '.claude/skills/session-end/',
  '.lefthook/gitleaks.yml',
  'local/README.md',
]

// Started by the jig, then changed by the project (its scripts, dependencies,
// hooks, ignores, workflows). Never written by a re-stamp: it reports how the
// file differs from today's jig, and a person or an agent merges.
export const SHARED = [
  'package.json',
  'pnpm-workspace.yaml',
  'lefthook.yml',
  'tsconfig.base.json',
  'eslint.config.js',
  'commitlint.config.js',
  '.gitignore',
  '.prettierrc',
  '.prettierignore',
  '.envrc.example',
  '.bun-version',
  '.swift-format',
  'Brewfile',
  'rust-toolchain.toml',
  'vercel.json',
  'apps/www/vercel.json',
  '.github/',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'docs/releases/_TEMPLATE.md',
]

// The project's: stamped once as a starting point, never read or written
// again. A re-stamp only says when one outside apps/ and packages/ is absent.
export const PROJECT = [
  'AGENTS.md',
  'DEVIATIONS.md',
  'LICENSE',
  'docs/DECISIONS.md',
  'docs/LEARNINGS.md',
  'session.config.json',
  'apps/',
  'packages/',
]

const matches = (patterns, path) =>
  patterns.some((pattern) =>
    pattern.endsWith('/') ? path.startsWith(pattern) : path === pattern,
  )

export function classify(path) {
  if (matches(OWNED, path)) return 'owned'
  if (matches(SHARED, path)) return 'shared'
  if (matches(PROJECT, path)) return 'project'
  return 'unclassified'
}

export const ownedDirectories = OWNED.filter((pattern) => pattern.endsWith('/'))

// The exception to "project files are never touched": when the jig's own
// script stops accepting something a project file holds, the re-stamp that
// brings the new script makes the one change the script demands, and nothing
// else in the file. `migrate` returns the new text, or null when there is
// nothing to do (including a file it cannot parse: that is the project's).
export const MIGRATIONS = [
  {
    file: 'session.config.json',
    summary:
      'remove board.profile (Board posts are written as JIG_AGENT; the session script refuses a config that sets it)',
    migrate(text) {
      let config
      try {
        config = JSON.parse(text)
      } catch {
        return null
      }
      if (config?.board?.profile === undefined) return null
      delete config.board.profile
      return `${JSON.stringify(config, null, 2)}\n`
    },
  },
]
