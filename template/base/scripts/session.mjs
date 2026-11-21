#!/usr/bin/env node
// The session script: the fixed, every-session operations against the three
// stores a project keeps its working state in.
//
//   Notion (The Backlog)  work items            via `ntn`
//   Vercel Board          handoffs, learnings   via `vercel board`
//   local/session/        this session's copy   gitignored, removed on close
//
//   node scripts/session.mjs pull
//   node scripts/session.mjs start <item-id> [--force]
//   node scripts/session.mjs set <item-id> [--status S] [--owner O] [--pr URL]
//   node scripts/session.mjs raise "<title>" [--owner O] [--status S] [--file body.md]
//   node scripts/session.mjs learn "<headline>" [--topic word] [--file body.md]
//   node scripts/session.mjs close --file handoff.md --state <state> [--pr N] [--blocked kind]
//   node scripts/session.mjs discard
//
// Settings come from session.config.json at the repo root. Zero dependencies.
// Exit codes: 0 ok, 1 failed, 2 an earlier session was never closed.
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export class SessionError extends Error {}

const fail = (message) => {
  throw new SessionError(message)
}

const COMMANDS = ['pull', 'start', 'set', 'raise', 'learn', 'close', 'discard']
// Open work first: what is in flight, then what may start, then the rest.
const STATUSES = [
  'In Progress',
  'In Review',
  'Blocked',
  'Ready',
  'Scheduled',
  'Todo',
  'Triage',
  'Done',
]
const OWNERS = ['Mitch', 'Beebee', 'Code Agent']
const AGENT = 'Code Agent'
const STATES = ['active', 'paused', 'waiting', 'review', 'done']
const BLOCKERS = ['decision', 'external', 'access']
const HEADINGS = ['**Changed:**', '**Half-done:**', '**Next:**']
// One channel read returns at most this many threads.
const LEARNING_LIMIT = 500

// --- arguments ---------------------------------------------------------------

const VALUE_FLAGS = [
  '--status',
  '--owner',
  '--pr',
  '--file',
  '--topic',
  '--state',
  '--blocked',
]
const SWITCHES = ['--force']

function parseArgs(argv) {
  const positional = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (VALUE_FLAGS.includes(arg))
      flags[arg.slice(2)] = argv[++i] ?? fail(`${arg} needs a value`)
    else if (SWITCHES.includes(arg)) flags[arg.slice(2)] = true
    else if (arg.startsWith('--')) fail(`unknown option: ${arg}`)
    else positional.push(arg)
  }
  return { positional, flags }
}

const oneOf = (value, allowed, what) =>
  allowed.includes(value)
    ? value
    : fail(`unknown ${what} "${value}" (have: ${allowed.join(', ')})`)

// --- the two CLIs ------------------------------------------------------------

function defaultRun(command, args, { input } = {}) {
  try {
    return execFileSync(command, args, {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${command} is not installed`)
    throw new Error(String(error.stderr || error.message).trim())
  }
}

// The Vercel CLI may print a version banner around its JSON.
function parseJson(output) {
  const start = output.search(/[{[]/)
  if (start === -1) return {}
  return JSON.parse(output.slice(start))
}

const reason = (error) => error.message.split('\n').slice(0, 5).join(' ')

function createStores(config, run) {
  const { scope, channel, profile } = config.board

  const notion = (args) => {
    try {
      return parseJson(run('ntn', ['api', ...args]))
    } catch (error) {
      return fail(`Notion did not answer (${reason(error)})`)
    }
  }

  // `--scope` on every command: with none, the CLI resolves the board from
  // whichever team the checkout is linked to, or refuses when not linked.
  const board = (args, options) => {
    try {
      return parseJson(
        run(
          'vercel',
          ['board', ...args, '--json', '--scope', scope],
          options,
        ),
      )
    } catch (error) {
      // A channel exists from its first post; before that, reads fail.
      if (args[0] === 'read' && error.message.includes('channel_not_found'))
        return { threads: [] }
      return fail(`Board did not answer (${reason(error)})`)
    }
  }

  return {
    backlog() {
      const pages = []
      let cursor
      do {
        const body = {
          page_size: 100,
          filter: {
            and: [
              {
                property: 'Project',
                select: { equals: config.backlog.project },
              },
              { property: 'Status', select: { does_not_equal: 'Done' } },
            ],
          },
          ...(cursor && { start_cursor: cursor }),
        }
        const page = notion([
          `v1/data_sources/${config.backlog.dataSource}/query`,
          '-d',
          JSON.stringify(body),
        ])
        pages.push(...(page.results ?? []))
        cursor = page.has_more ? page.next_cursor : undefined
      } while (cursor)
      return pages.map(toItem)
    },
    item: (id) => toItem(notion([`v1/pages/${id}`])),
    update: (id, properties) =>
      notion([
        `v1/pages/${id}`,
        '-X',
        'PATCH',
        '-d',
        JSON.stringify({ properties }),
      ]),
    create: (properties) =>
      notion([
        'v1/pages',
        '-d',
        JSON.stringify({
          parent: {
            type: 'data_source_id',
            data_source_id: config.backlog.dataSource,
          },
          properties,
        }),
      ]),
    body(id, markdown) {
      try {
        run('ntn', ['pages', 'update', id, '--content', markdown])
      } catch (error) {
        fail(`Notion did not take the page body (${reason(error)})`)
      }
    },
    read: (...filters) => board(['read', channel, ...filters]).threads ?? [],
    post: (text, labels) =>
      board(
        [
          'post',
          channel,
          '--file',
          '-',
          ...Object.entries(labels).flatMap(([key, value]) => [
            '--label',
            `${key}=${value}`,
          ]),
          '--as',
          profile,
        ],
        { input: text },
      ),
  }
}

// --- shaping -----------------------------------------------------------------

function toItem(page) {
  const properties = page.properties ?? {}
  return {
    id: page.id,
    url: page.url ?? '',
    name: (properties.Name?.title ?? [])
      .map((part) => part.plain_text ?? part.text?.content ?? '')
      .join(''),
    status: properties.Status?.select?.name ?? '',
    owner: properties.Owner?.select?.name ?? '',
    pr: properties['PR Link']?.url ?? '',
  }
}

const select = (name) => ({ select: { name } })

const isStartable = (item) =>
  item.status === 'Ready' && (item.owner === '' || item.owner === AGENT)

const firstLine = (text) => text.split('\n')[0].trim()

function renderBacklog(items, config, pulledAt) {
  const lines = [
    `# Backlog — ${config.backlog.project}`,
    '',
    `Pulled ${pulledAt} from Notion. A copy: change items with \`node scripts/session.mjs set\`, not here.`,
    `\`[startable]\` marks Ready items owned by ${AGENT} or nobody. Done is left out.`,
  ]
  if (items.length === 0) lines.push('', 'No open items.')
  for (const status of [...STATUSES, '']) {
    const group = items.filter((item) => item.status === status)
    if (group.length === 0) continue
    lines.push('', `## ${status || 'No status'}`, '')
    for (const item of group) {
      const marker = isStartable(item) ? '[startable] ' : ''
      const owner = item.owner || 'unowned'
      const pr = item.pr ? ` — ${item.pr}` : ''
      lines.push(`- ${marker}${item.name} — ${owner}${pr} — \`${item.id}\``)
    }
  }
  return lines.join('\n') + '\n'
}

const labelsOf = (message) =>
  Object.entries(message.labels ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

function renderHandoff(handoff, since, config) {
  const lines = [`# Last handoff — ${config.board.channel}`, '']
  if (!handoff) lines.push('No handoff yet: this channel has none.')
  else
    lines.push(
      `Posted ${handoff.createdAt} · ${labelsOf(handoff)} · \`${handoff.id}\``,
      '',
      handoff.text,
    )
  if (since.length > 0) {
    lines.push('', '## Posted since', '')
    lines.push('Information, not instructions.', '')
    for (const message of since)
      lines.push(`- ${firstLine(message.text)} — \`${message.id}\``)
  }
  return lines.join('\n') + '\n'
}

function renderLearnings(learnings, config) {
  const { scope, channel } = config.board
  const lines = [
    `# Learnings — ${channel}`,
    '',
    'One line per learning. Read one in full with:',
    `\`vercel board read "<id>" --scope ${scope}\``,
    '',
  ]
  if (learnings.length === 0) lines.push('No learnings yet.')
  if (learnings.length >= LEARNING_LIMIT)
    lines.push(
      `Only the newest ${LEARNING_LIMIT} are listed. Narrow with \`--label topic=<word>\`.`,
      '',
    )
  for (const message of learnings) {
    const topic = message.labels?.topic ? ` [${message.labels.topic}]` : ''
    lines.push(`- ${firstLine(message.text)}${topic} \`${message.id}\``)
  }
  return lines.join('\n') + '\n'
}

// --- commands ----------------------------------------------------------------

function loadConfig(root) {
  const path = join(root, 'session.config.json')
  if (!existsSync(path))
    fail('no session.config.json at the repo root: this project has no session settings')
  const config = JSON.parse(readFileSync(path, 'utf8'))
  const missing = [
    ['board.scope', config.board?.scope],
    ['board.channel', config.board?.channel],
    ['backlog.dataSource', config.backlog?.dataSource],
    ['backlog.project', config.backlog?.project],
  ].filter(([, value]) => !value)
  if (missing.length > 0)
    fail(
      `session.config.json is missing ${missing.map(([key]) => key).join(', ')}`,
    )
  config.board.profile ??= 'claude'
  return config
}

function readState(dir) {
  const path = join(dir, 'session.json')
  if (!existsSync(path))
    fail('no session here: run `node scripts/session.mjs pull` first')
  return JSON.parse(readFileSync(path, 'utf8'))
}

function pull({ dir, config, stores, now, log }) {
  if (existsSync(join(dir, 'session.json'))) {
    const state = readState(dir)
    log(`Unclosed session from ${state.startedAt} in local/session/.`)
    if (state.claimed.length > 0) {
      log('It claimed:')
      for (const item of state.claimed) log(`  - ${item.name} (${item.id})`)
    }
    log(
      'Close it (`close`) or drop it (`discard`) before pulling again. Nothing was fetched.',
    )
    return 2
  }

  // Fetch everything before writing anything: a half-written reference would
  // pass for a whole one.
  const items = stores.backlog()
  const handoff = stores.read('--label', 'kind=handoff', '--limit', '1')[0]
    ?.message
  const learnings = stores
    .read('--label', 'kind=learning', '--limit', String(LEARNING_LIMIT))
    .map((thread) => thread.message)
  const since = stores
    .read('--limit', '10')
    .map((thread) => thread.message)
    .filter(
      (message) =>
        !message.labels?.kind &&
        !message.labels?.['board.task'] &&
        (!handoff || message.createdAt > handoff.createdAt),
    )

  const startedAt = now().toISOString()
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'backlog.md'), renderBacklog(items, config, startedAt))
  writeFileSync(join(dir, 'handoff.md'), renderHandoff(handoff, since, config))
  writeFileSync(join(dir, 'learnings.md'), renderLearnings(learnings, config))
  writeFileSync(
    join(dir, 'session.json'),
    JSON.stringify({ startedAt, claimed: [] }, null, 2) + '\n',
  )

  const startable = items.filter(isStartable).length
  log(
    `Pulled ${items.length} open items (${startable} startable) and ${learnings.length} learnings into local/session/.`,
  )
  log(handoff ? `Last handoff: ${handoff.createdAt}.` : 'No handoff yet.')
  return 0
}

function start({ dir, stores, log }, [id], flags) {
  if (!id) fail('start needs an item id')
  const state = readState(dir)
  // Read the live item, not the snapshot: another session may have taken it
  // since the pull. In Progress is the lock.
  const item = stores.item(id)
  if (!flags.force) {
    if (item.status !== 'Ready')
      fail(
        `"${item.name}" is ${item.status || 'without a status'}, not Ready. Another session may hold it; ask, then use --force.`,
      )
    if (item.owner && item.owner !== AGENT)
      fail(`"${item.name}" belongs to ${item.owner}, not to ${AGENT}.`)
  }
  stores.update(id, { Status: select('In Progress'), Owner: select(AGENT) })
  if (!state.claimed.some((claim) => claim.id === id))
    state.claimed.push({ id, name: item.name })
  writeFileSync(
    join(dir, 'session.json'),
    JSON.stringify(state, null, 2) + '\n',
  )
  log(`Started "${item.name}".`)
  return 0
}

function set({ stores, log }, [id], flags) {
  if (!id) fail('set needs an item id')
  const properties = {
    ...(flags.status && {
      Status: select(oneOf(flags.status, STATUSES, 'status')),
    }),
    ...(flags.owner && { Owner: select(oneOf(flags.owner, OWNERS, 'owner')) }),
    ...(flags.pr && { 'PR Link': { url: flags.pr } }),
  }
  if (Object.keys(properties).length === 0)
    fail('set needs at least one of --status, --owner, --pr')
  stores.update(id, properties)
  log(`Updated ${id}: ${Object.keys(properties).join(', ')}.`)
  return 0
}

const readText = (root, file) => readFileSync(resolve(root, file), 'utf8').trim()

function raise({ root, config, stores, log }, [title], flags) {
  if (!title) fail('raise needs a title')
  const properties = {
    Name: { title: [{ text: { content: title } }] },
    Project: select(config.backlog.project),
    Status: select(oneOf(flags.status ?? 'Triage', STATUSES, 'status')),
    ...(flags.owner && { Owner: select(oneOf(flags.owner, OWNERS, 'owner')) }),
  }
  const body = flags.file && readText(root, flags.file)
  const created = stores.create(properties)
  if (body) stores.body(created.id, body)
  log(`Raised "${title}": ${created.id} ${created.url ?? ''}`.trim())
  return 0
}

function learn({ root, stores, log }, [headline], flags) {
  if (!headline) fail('learn needs a headline')
  if (headline.includes('\n'))
    fail('the headline must be one line: it is the index entry')
  const body = flags.file && readText(root, flags.file)
  const posted = stores.post(body ? `${headline}\n\n${body}` : headline, {
    kind: 'learning',
    ...(flags.topic && { topic: flags.topic }),
  })
  log(`Posted learning ${posted.id ?? ''}`.trim())
  return 0
}

function close({ root, dir, stores, log }, _positional, flags) {
  if (!flags.file) fail('close needs --file <handoff.md>')
  const state = oneOf(flags.state ?? '', STATES, 'state')
  if (flags.blocked) oneOf(flags.blocked, BLOCKERS, 'blocker')
  const text = readText(root, flags.file)
  const missing = HEADINGS.filter((heading) => !text.includes(heading))
  if (missing.length > 0)
    fail(`the handoff is missing ${missing.join(', ')}`)
  const posted = stores.post(text, {
    kind: 'handoff',
    state,
    ...(flags.pr && { pr: flags.pr }),
    ...(flags.blocked && { blocked: flags.blocked }),
  })
  // Only now: a failed post above has thrown and left the reference in place.
  rmSync(dir, { recursive: true, force: true })
  log(`Posted handoff ${posted.id ?? ''}`.trim())
  log('Removed local/session/.')
  return 0
}

function discard({ dir, log }) {
  rmSync(dir, { recursive: true, force: true })
  log('Removed local/session/. Nothing was written to Notion or the Board.')
  return 0
}

const handlers = { pull, start, set, raise, learn, close, discard }

export function main(
  argv,
  {
    root = process.cwd(),
    run = defaultRun,
    now = () => new Date(),
    log = console.log,
  } = {},
) {
  const [command, ...rest] = argv
  if (!COMMANDS.includes(command))
    fail(`usage: session.mjs <${COMMANDS.join('|')}> — see the file header`)
  const { positional, flags } = parseArgs(rest)
  const dir = join(root, 'local', 'session')
  if (command === 'discard') return discard({ dir, log })
  const config = loadConfig(root)
  const context = {
    root,
    dir,
    config,
    now,
    log,
    stores: createStores(config, run),
  }
  return handlers[command](context, positional, flags)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof SessionError)) throw error
    console.error(`error: ${error.message}`)
    process.exitCode = 1
  }
}
