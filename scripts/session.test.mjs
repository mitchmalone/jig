// Tests for the stamped session script. It lives in the template (every
// project gets a copy); its tests live here, where the jig's gate runs them.
// No network: `ntn` and `vercel board` are replaced by a recording fake.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { SessionError, main } from '../template/base/scripts/session.mjs'

const scratch = mkdtempSync(join(tmpdir(), 'jig-session-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const CONFIG = {
  board: { scope: 'acme', channel: 'my-thing', profile: 'claude' },
  backlog: { dataSource: 'ds-1', project: 'My Thing' },
}
const NOW = () => new Date('2026-11-21T03:00:00.000Z')

const page = (id, name, status, owner = null, pr = null) => ({
  id,
  url: `https://notion.test/${id}`,
  created_time: '2026-11-20T00:00:00.000Z',
  properties: {
    Name: { title: [{ plain_text: name }] },
    Status: { select: status ? { name: status } : null },
    Owner: { select: owner ? { name: owner } : null },
    Project: { select: { name: 'My Thing' } },
    'PR Link': { url: pr },
  },
})

const thread = (id, text, labels = {}, createdAt = '2026-11-20T10:00:00Z') => ({
  message: { id, text, labels, createdAt },
  replies: 0,
})

let root
let calls
let counter = 0

// A fake for the two CLIs. `routes` maps a matcher on the joined command line
// to a JSON-able result, or to an Error to throw.
function fakeRun(routes) {
  return (command, args, options = {}) => {
    const line = [command, ...args].join(' ')
    calls.push({ command, args, line, input: options.input })
    for (const [match, result] of routes) {
      if (!line.includes(match)) continue
      const value = typeof result === 'function' ? result(line) : result
      if (value instanceof Error) throw value
      return JSON.stringify(value)
    }
    throw new Error(`unexpected command: ${line}`)
  }
}

const BOARD_EMPTY = new Error('{"reason":"channel_not_found"}')

const project = (id, name) => ({
  id,
  properties: { Name: { type: 'title', title: [{ plain_text: name }] } },
})

// The backlog's schema and the projects database its Project relates to.
// Listed after the query route: the fake matches on substrings, first wins.
const projectRoutes = (schema = RELATION_SCHEMA) => [
  [
    'data_sources/ds-projects/query',
    { has_more: false, results: [project('proj-1', 'My Thing')] },
  ],
  ['v1/data_sources/ds-1', schema],
]

const RELATION_SCHEMA = {
  properties: {
    Project: { type: 'relation', relation: { data_source_id: 'ds-projects' } },
  },
}
const SELECT_SCHEMA = { properties: { Project: { type: 'select', select: {} } } }

const happyRoutes = (overrides = [], schema) => [
  ...overrides,
  [
    'data_sources/ds-1/query',
    {
      has_more: false,
      results: [
        page('p-ready', 'Add the revoke button', 'Ready', 'Code Agent'),
        page('p-free', 'Show who is online', 'Ready'),
        page('p-mitch', 'Test on a real iPhone', 'Ready', 'Mitch'),
        page('p-prog', 'Status history view', 'In Progress', 'Code Agent'),
        page('p-triage', 'PR Assistant', 'Triage', 'Mitch'),
      ],
    },
  ],
  [
    'kind=handoff',
    {
      threads: [
        thread(
          'msg_h1',
          '**Changed:** shipped the live layer\n**Half-done:** nothing\n**Next:** the revoke button',
          { kind: 'handoff', state: 'paused' },
        ),
      ],
    },
  ],
  [
    'kind=learning',
    {
      threads: [
        thread(
          'msg_l1',
          'Vercel WebSockets drop at 60s → no ping → send one every 30s\n\nLong body.',
          { kind: 'learning', topic: 'realtime' },
        ),
      ],
    },
  ],
  [
    'board read my-thing --limit',
    {
      threads: [
        thread('msg_h1', 'handoff', { kind: 'handoff' }),
        thread(
          'msg_n1',
          'Mitch: please look at the flaky gate first',
          {},
          '2026-11-20T12:00:00Z',
        ),
      ],
    },
  ],
  ...projectRoutes(schema),
]

function session(argv, routes = happyRoutes()) {
  const out = []
  const code = main(argv, {
    root,
    now: NOW,
    run: fakeRun(routes),
    log: (line) => out.push(line),
  })
  return { code, out: out.join('\n') }
}

const backlogFilter = () => {
  const query = calls.find((call) => call.line.includes('ds-1/query'))
  return JSON.parse(query.args[query.args.indexOf('-d') + 1]).filter
}

const local = (file) => join(root, 'local', 'session', file)
const readLocal = (file) => readFileSync(local(file), 'utf8')

beforeEach(() => {
  root = join(scratch, `project-${counter++}`)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'session.config.json'), JSON.stringify(CONFIG))
  calls = []
})

describe('pull', () => {
  it('asks Notion only for this project and leaves Done out', () => {
    session(['pull'])
    assert.deepEqual(backlogFilter(), {
      and: [
        { property: 'Project', relation: { contains: 'proj-1' } },
        { property: 'Status', select: { does_not_equal: 'Done' } },
      ],
    })
  })

  it('filters by name when the backlog keeps Project as a select', () => {
    session(['pull'], happyRoutes([], SELECT_SCHEMA))
    assert.deepEqual(backlogFilter().and[0], {
      property: 'Project',
      select: { equals: 'My Thing' },
    })
  })

  it('says how to fix a project the projects database does not have', () => {
    assert.throws(
      () =>
        session(
          ['pull'],
          happyRoutes([
            [
              'data_sources/ds-projects/query',
              { has_more: false, results: [project('proj-9', 'Other')] },
            ],
          ]),
        ),
      (error) =>
        error instanceof SessionError &&
        /"My Thing".*add it/s.test(error.message),
    )
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('pins every board command to the configured team and channel', () => {
    session(['pull'])
    const board = calls.filter((call) => call.command === 'vercel')
    assert.ok(board.length >= 3)
    for (const call of board) {
      assert.ok(call.line.includes('--scope acme'), call.line)
      assert.ok(call.line.includes('board read my-thing'), call.line)
    }
  })

  it('writes the backlog grouped by status and marks what a session may start', () => {
    session(['pull'])
    const backlog = readLocal('backlog.md')
    assert.match(backlog, /## In Progress\n\n- Status history view/)
    assert.match(backlog, /## Ready\n/)
    assert.match(backlog, /- \[startable\] Add the revoke button .*`p-ready`/)
    assert.match(backlog, /- \[startable\] Show who is online .*`p-free`/)
    // Ready but a person's: listed, never startable.
    assert.match(backlog, /- Test on a real iPhone .*Mitch.*`p-mitch`/)
    assert.ok(backlog.indexOf('## In Progress') < backlog.indexOf('## Ready'))
    assert.ok(backlog.indexOf('## Ready') < backlog.indexOf('## Triage'))
  })

  it('writes the last handoff in full, with threads posted since', () => {
    session(['pull'])
    const handoff = readLocal('handoff.md')
    assert.match(handoff, /state=paused/)
    assert.match(handoff, /\*\*Next:\*\* the revoke button/)
    assert.match(handoff, /please look at the flaky gate first/)
  })

  it('indexes learnings by headline and thread id, not full text', () => {
    session(['pull'])
    const learnings = readLocal('learnings.md')
    assert.match(
      learnings,
      /- Vercel WebSockets drop at 60s → no ping → send one every 30s \[realtime\] `msg_l1`/,
    )
    assert.doesNotMatch(learnings, /Long body/)
  })

  it('follows Notion pagination', () => {
    let asked = 0
    session(
      ['pull'],
      happyRoutes([
        [
          'data_sources/ds-1/query',
          () =>
            asked++ === 0
              ? {
                  has_more: true,
                  next_cursor: 'c2',
                  results: [page('p-1', 'First', 'Ready')],
                }
              : { has_more: false, results: [page('p-2', 'Second', 'Todo')] },
        ],
      ]),
    )
    const backlog = readLocal('backlog.md')
    assert.match(backlog, /First/)
    assert.match(backlog, /Second/)
    const second = calls.filter((call) => call.line.includes('ds-1/query'))[1]
    assert.match(second.line, /"start_cursor":"c2"/)
  })

  it('treats a channel with no posts as empty, not as a failure', () => {
    const { code } = session(
      ['pull'],
      happyRoutes([['board read', BOARD_EMPTY]]),
    )
    assert.equal(code, 0)
    assert.match(readLocal('handoff.md'), /No handoff yet/)
    assert.match(readLocal('learnings.md'), /No learnings yet/)
  })

  it('records when the session started', () => {
    session(['pull'])
    const state = JSON.parse(readLocal('session.json'))
    assert.equal(state.startedAt, '2026-11-21T03:00:00.000Z')
    assert.deepEqual(state.claimed, [])
  })

  it('fails and writes nothing when Notion is unreachable', () => {
    assert.throws(
      () =>
        session(
          ['pull'],
          happyRoutes([['data_sources', new Error('connect ETIMEDOUT')]]),
        ),
      (error) =>
        error instanceof SessionError && /Notion.*ETIMEDOUT/.test(error.message),
    )
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('fails and writes nothing when the board is unreachable', () => {
    assert.throws(
      () =>
        session(
          ['pull'],
          happyRoutes([['board read', new Error('rate_limited')]]),
        ),
      (error) =>
        error instanceof SessionError && /Board.*rate_limited/.test(error.message),
    )
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('refuses to overwrite an unclosed session and says what it held', () => {
    session(['pull'])
    session(['start', 'p-ready'], [
      ['pages/p-ready -X PATCH', {}],
      ['pages/p-ready', page('p-ready', 'Add the revoke button', 'Ready')],
    ])
    writeFileSync(local('plan.md'), '# plan')
    calls = []
    const { code, out } = session(['pull'])
    assert.equal(code, 2)
    assert.match(out, /unclosed session/i)
    assert.match(out, /2026-11-21T03:00:00.000Z/)
    assert.match(out, /Add the revoke button/)
    assert.equal(calls.length, 0)
    assert.equal(readLocal('plan.md'), '# plan')
  })
})

describe('start', () => {
  const live = (status, owner) => [
    ['pages/p-ready -X PATCH', {}],
    ['pages/p-ready', page('p-ready', 'Add the revoke button', status, owner)],
  ]

  it('claims a Ready item for the code agent and records the claim', () => {
    session(['pull'])
    session(['start', 'p-ready'], live('Ready', 'Code Agent'))
    const patch = calls.find((call) => call.line.includes('-X PATCH'))
    assert.deepEqual(JSON.parse(patch.args[patch.args.indexOf('-d') + 1]), {
      properties: {
        Status: { select: { name: 'In Progress' } },
        Owner: { select: { name: 'Code Agent' } },
      },
    })
    assert.deepEqual(JSON.parse(readLocal('session.json')).claimed, [
      { id: 'p-ready', name: 'Add the revoke button' },
    ])
  })

  it('checks the live status, so an item another session took is refused', () => {
    session(['pull'])
    assert.throws(
      () => session(['start', 'p-ready'], live('In Progress', 'Code Agent')),
      /In Progress/,
    )
    assert.equal(
      calls.some((call) => call.line.includes('-X PATCH')),
      false,
    )
  })

  it("refuses a person's item", () => {
    session(['pull'])
    assert.throws(
      () => session(['start', 'p-ready'], live('Ready', 'Mitch')),
      /Mitch/,
    )
  })

  it('takes over an item when forced', () => {
    session(['pull'])
    session(['start', 'p-ready', '--force'], live('In Progress', 'Code Agent'))
    assert.ok(calls.some((call) => call.line.includes('-X PATCH')))
  })

  it('needs a session', () => {
    assert.throws(() => session(['start', 'p-ready']), /pull/)
  })
})

describe('set', () => {
  it('moves an item to review with its PR link', () => {
    session(
      ['set', 'p-1', '--status', 'In Review', '--pr', 'https://gh.test/pr/4'],
      [['pages/p-1 -X PATCH', {}]],
    )
    const patch = calls[0]
    assert.deepEqual(JSON.parse(patch.args[patch.args.indexOf('-d') + 1]), {
      properties: {
        Status: { select: { name: 'In Review' } },
        'PR Link': { url: 'https://gh.test/pr/4' },
      },
    })
  })

  it('rejects a status the backlog does not have', () => {
    assert.throws(
      () => session(['set', 'p-1', '--status', 'Shipped'], []),
      /Shipped/,
    )
  })

  it('rejects an owner the backlog does not have', () => {
    assert.throws(() => session(['set', 'p-1', '--owner', 'Bob'], []), /Bob/)
  })
})

describe('raise', () => {
  it('creates a Triage item for this project with no owner', () => {
    const { out } = session(
      ['raise', 'Signed-out /api/me logs a 401'],
      [
        ['v1/pages', { id: 'p-new', url: 'https://notion.test/p-new' }],
        ...projectRoutes(),
      ],
    )
    const create = calls.find((call) => call.line.includes('v1/pages'))
    assert.deepEqual(JSON.parse(create.args[create.args.indexOf('-d') + 1]), {
      parent: { type: 'data_source_id', data_source_id: 'ds-1' },
      properties: {
        Name: { title: [{ text: { content: 'Signed-out /api/me logs a 401' } }] },
        Project: { relation: [{ id: 'proj-1' }] },
        Status: { select: { name: 'Triage' } },
      },
    })
    assert.match(out, /p-new/)
  })

  it("files something that waits on a person as theirs, with the reason in the body", () => {
    writeFileSync(join(root, 'why.md'), 'Needs a real device.')
    session(
      [
        'raise',
        'Test on a real iPhone',
        '--owner',
        'Mitch',
        '--status',
        'Blocked',
        '--file',
        'why.md',
      ],
      [
        ['pages update p-new', {}],
        ['v1/pages', { id: 'p-new', url: 'https://notion.test/p-new' }],
        ...projectRoutes(),
      ],
    )
    const create = calls.find((call) => call.line.includes('v1/pages'))
    const properties = JSON.parse(
      create.args[create.args.indexOf('-d') + 1],
    ).properties
    assert.deepEqual(properties.Owner, { select: { name: 'Mitch' } })
    assert.deepEqual(properties.Status, { select: { name: 'Blocked' } })
    const body = calls.find((call) => call.line.includes('pages update'))
    assert.equal(
      body.args[body.args.indexOf('--content') + 1],
      'Needs a real device.',
    )
  })
})

describe('learn', () => {
  it('posts one labelled thread whose first line is the headline', () => {
    writeFileSync(join(root, 'fix.md'), 'Send a ping every 30s.')
    session(
      [
        'learn',
        'WebSockets drop at 60s → no ping',
        '--topic',
        'realtime',
        '--file',
        'fix.md',
      ],
      [['board post my-thing', { id: 'msg_new' }]],
    )
    const post = calls[0]
    assert.equal(
      post.input,
      'WebSockets drop at 60s → no ping\n\nSend a ping every 30s.',
    )
    assert.match(post.line, /--label kind=learning/)
    assert.match(post.line, /--label topic=realtime/)
    assert.match(post.line, /--as claude/)
    assert.match(post.line, /--scope acme/)
  })

  it('refuses a headline that would not fit an index line', () => {
    assert.throws(() => session(['learn', 'a\nb'], []), /one line/)
  })
})

describe('close', () => {
  const HANDOFF = '**Changed:** x\n**Half-done:** y\n**Next:** z'
  beforeEach(() => {
    session(['pull'])
    writeFileSync(local('close.md'), HANDOFF)
    calls = []
  })

  it('posts the handoff with its state, then removes the local reference', () => {
    session(
      [
        'close',
        '--file',
        'local/session/close.md',
        '--state',
        'review',
        '--pr',
        '12',
      ],
      [['board post my-thing', { id: 'msg_h2' }]],
    )
    const post = calls[0]
    assert.equal(post.input, HANDOFF)
    assert.match(post.line, /--label kind=handoff/)
    assert.match(post.line, /--label state=review/)
    assert.match(post.line, /--label pr=12/)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('keeps the local reference when the post fails', () => {
    assert.throws(
      () =>
        session(
          ['close', '--file', 'local/session/close.md', '--state', 'paused'],
          [['board post', new Error('rate_limited')]],
        ),
      /Board/,
    )
    assert.equal(readLocal('close.md'), HANDOFF)
    assert.ok(existsSync(local('session.json')))
  })

  it('rejects a state the board convention does not have', () => {
    assert.throws(
      () =>
        session(
          ['close', '--file', 'local/session/close.md', '--state', 'finished'],
          [],
        ),
      /finished/,
    )
    assert.ok(existsSync(local('session.json')))
  })

  it('refuses a handoff missing one of its three headings', () => {
    writeFileSync(local('close.md'), '**Changed:** x')
    assert.throws(
      () =>
        session(
          ['close', '--file', 'local/session/close.md', '--state', 'paused'],
          [],
        ),
      /Half-done/,
    )
  })
})

describe('discard', () => {
  it('removes the local reference without writing anywhere', () => {
    session(['pull'])
    calls = []
    session(['discard'], [])
    assert.equal(calls.length, 0)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })
})

describe('configuration', () => {
  it('names the missing file when the project has no session settings', () => {
    rmSync(join(root, 'session.config.json'))
    assert.throws(() => session(['pull']), /session\.config\.json/)
  })

  it('lists the commands when given one it does not know', () => {
    assert.throws(() => session(['sync']), /pull.*start.*set/s)
  })
})

describe('as a command', () => {
  const script = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../template/base/scripts/session.mjs',
  )

  it('reports a failure on stderr and exits 1', () => {
    rmSync(join(root, 'session.config.json'))
    const result = spawnSync(process.execPath, [script, 'pull'], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /^error: no session\.config\.json/)
  })

  it('runs when reached through a symlink', () => {
    // The jig reaches the template's copy this way.
    const link = join(root, 'session.mjs')
    symlinkSync(script, link)
    const result = spawnSync(process.execPath, [link, 'nonsense'], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /usage: session\.mjs/)
  })
})
