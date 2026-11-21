// The smoke run's own checks: only the ones that stamp nothing.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = join(dirname(fileURLToPath(import.meta.url)), 'smoke.mjs')

describe('smoke', () => {
  it('enforces a required composition even when it was not named', () => {
    // A PATH with node and the system tools, but no pnpm or bun: both skip.
    const bin = mkdtempSync(join(tmpdir(), 'jig-smoke-bin-'))
    symlinkSync(process.execPath, join(bin, 'node'))
    const result = spawnSync(process.execPath, [script, 'bun'], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, JIG_SMOKE_REQUIRE: 'pnpm' },
    })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /pnpm: FAILED \(required/)
  })
})
