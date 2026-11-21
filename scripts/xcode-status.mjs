// Is Xcode usable? Shared by the generator (Swift `--verify` preflight) and
// the smoke runner. The stamp's verify runs `pnpm build` → xcodebuild, which
// needs a selected Xcode; the Command Line Tools alone are not enough.
// Zero dependencies; bare Node.
import { spawnSync } from 'node:child_process'

// Pure: turn a `spawnSync('xcodebuild', ['-version'])` result into
// { ok, reason }. With only the Command Line Tools, /usr/bin/xcodebuild is a
// shim that exits 1; the same exit covers an Xcode that isn't selected, an
// unaccepted license or a bad DEVELOPER_DIR, so the reason quotes stderr.
export function parseXcodeProbe({ status, error, stderr } = {}) {
  if (status === 0) return { ok: true, reason: '' }
  if (error?.code === 'ENOENT') return { ok: false, reason: 'xcodebuild not found' }
  const detail =
    String(stderr ?? '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ??
    (error ? error.message : `xcodebuild -version exited ${status}`)
  return {
    ok: false,
    reason: `Xcode not usable: ${detail} (check xcode-select -p and xcodebuild -license)`,
  }
}

export const xcodeStatus = () =>
  parseXcodeProbe(
    spawnSync('xcodebuild', ['-version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 10000,
    }),
  )
