#!/usr/bin/env node
// Thin wrapper so the gate is one command everywhere:
//   node scripts/xcode.mjs generate | build | run | open
//
// Signing follows the environment: DEVELOPMENT_TEAM set → automatic signing
// (local dev); unset → unsigned build (CI, fresh clones). Zero dependencies.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const APP_DIR = resolve('apps/app')
const PROJECT = '{{PROJECT_PASCAL}}'
const DERIVED = resolve('.build/xcode')
const project = join(APP_DIR, `${PROJECT}.xcodeproj`)

function fail(message) {
  console.error(`error: ${message}`)
  process.exit(1)
}

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })

function generate() {
  sh('xcodegen generate --quiet', { cwd: APP_DIR })
}

function build() {
  if (!existsSync(project)) generate()
  const team = process.env.DEVELOPMENT_TEAM
  const signing = team
    ? `DEVELOPMENT_TEAM=${team} -allowProvisioningUpdates`
    : 'CODE_SIGNING_ALLOWED=NO'
  sh(
    `xcodebuild -project "${project}" -scheme ${PROJECT} -configuration Debug -destination generic/platform=macOS ` +
      `-derivedDataPath "${DERIVED}" ${signing} -quiet build`,
  )
}

function run() {
  build()
  sh(`open "${join(DERIVED, 'Build/Products/Debug', `${PROJECT}.app`)}"`)
}

function open() {
  if (!existsSync(project)) generate()
  sh(`open "${project}"`)
}

const commands = { generate, build, run, open }
const command = commands[process.argv[2]]
if (!command) fail(`usage: xcode.mjs <${Object.keys(commands).join('|')}>`)
command()
