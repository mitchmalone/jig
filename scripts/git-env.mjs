// The environment for a child that runs git in a repo of its own.
//
// A git hook runs with GIT_DIR exported, and in a linked worktree with
// GIT_WORK_TREE and GIT_INDEX_FILE too. A child that inherits them and runs
// `git init` or `git commit` in a temp dir acts on the hook's repo instead:
// junk commits, and `core.bare = true` in its shared config. These are the
// variables `git rev-parse --local-env-vars` lists, the ones git itself clears
// before running in another repo; identity (GIT_AUTHOR_*, GIT_COMMITTER_*)
// is kept.
const REPO_LOCAL = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CONFIG',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_OBJECT_DIRECTORY',
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_IMPLICIT_WORK_TREE',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NO_REPLACE_OBJECTS',
  'GIT_REPLACE_REF_BASE',
  'GIT_PREFIX',
  'GIT_SHALLOW_FILE',
  'GIT_COMMON_DIR',
])

export const withoutRepoGitEnv = (env = process.env) =>
  Object.fromEntries(
    Object.entries(env).filter(
      ([key]) =>
        !REPO_LOCAL.has(key) &&
        !key.startsWith('GIT_CONFIG_KEY_') &&
        !key.startsWith('GIT_CONFIG_VALUE_'),
    ),
  )
