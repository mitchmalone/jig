import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { withoutRepoGitEnv } from './git-env.mjs'

describe('withoutRepoGitEnv', () => {
  it('drops the variables a git hook exports, and keeps identity and the rest', () => {
    const env = withoutRepoGitEnv({
      GIT_DIR: '/repo/.git/worktrees/x',
      GIT_WORK_TREE: '/repo',
      GIT_INDEX_FILE: '/repo/.git/index',
      GIT_PREFIX: 'sub/',
      GIT_OBJECT_DIRECTORY: '/repo/.git/objects',
      GIT_COMMON_DIR: '/repo/.git',
      GIT_AUTHOR_NAME: 'jig smoke',
      GIT_COMMITTER_EMAIL: 'smoke@jig.invalid',
      PATH: '/usr/bin',
    })
    assert.deepEqual(env, {
      GIT_AUTHOR_NAME: 'jig smoke',
      GIT_COMMITTER_EMAIL: 'smoke@jig.invalid',
      PATH: '/usr/bin',
    })
  })
})
