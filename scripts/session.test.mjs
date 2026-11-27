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

import { SessionError, defaultRun, main } from '../template/base/scripts/session.mjs'

const scratch = mkdtempSync(join(tmpdir(), 'jig-session-'))

// The environment for a script run as a child: it names an agent, and drops
// GIT_*, which git exports to hooks (GIT_DIR in a worktree) and which would
// point the child's git at the jig instead of its temp repo.
const childEnv = Object.fromEntries([
  ...Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  ['JIG_AGENT', 'kaytoo'],
])
after(() => rmSync(scratch, { recursive: true, force: true }))

const CONFIG = {
  board: { scope: 'acme', channel: 'my-thing' },
  backlog: { dataSource: 'ds-1', project: 'My Thing' },
}
const NOW = () => new Date('2026-11-21T03:00:00.000Z')

// Owner is a rollup of Project → Droid, shaped the way the Notion API returns
// it: an array holding one relation per project, each listing droid page ids.
const ownerRollup = (droid) => ({
  type: 'rollup',
  rollup: {
    type: 'array',
    function: 'show_original',
    array: droid ? [{ type: 'relation', relation: [{ id: droid }] }] : [],
  },
})

const page = (id, name, status, droid = null, pr = null) => ({
  id,
  url: `https://notion.test/${id}`,
  created_time: '2026-11-20T00:00:00.000Z',
  parent: { type: 'data_source_id', data_source_id: 'ds-1' },
  properties: {
    Name: { title: [{ plain_text: name }] },
    Status: { select: status ? { name: status } : null },
    Owner: ownerRollup(droid),
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
      if (value?.raw !== undefined) return value.raw
      return JSON.stringify(value)
    }
    throw new Error(`unexpected command: ${line}`)
  }
}

const RAW = (raw) => ({ raw })
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
    Owner: {
      type: 'rollup',
      rollup: {
        function: 'show_original',
        relation_property_name: 'Project',
        rollup_property_name: 'Droid',
      },
    },
  },
}
const SELECT_SCHEMA = { properties: { Project: { type: 'select', select: {} } } }

// The project's droid, a page in the droids database the Owner rollup reads.
const DROID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const droidPage = (id, name) => ({
  id,
  properties: { Name: { type: 'title', title: [{ plain_text: name }] } },
})

const happyRoutes = (overrides = [], schema) => [
  ...overrides,
  [
    'data_sources/ds-1/query',
    {
      has_more: false,
      results: [
        page('11111111-1111-4111-8111-111111111111', 'Add the revoke button', 'Ready', DROID),
        page('22222222-2222-4222-8222-222222222222', 'Show who is online', 'Ready', DROID),
        page('33333333-3333-4333-8333-333333333333', 'Test on a real iPhone', 'Blocked', DROID),
        page('44444444-4444-4444-8444-444444444444', 'Status history view', 'In Progress', DROID),
        page('55555555-5555-4555-8555-555555555555', 'PR Assistant', 'Triage', DROID),
      ],
    },
  ],
  [`v1/pages/${DROID}`, droidPage(DROID, 'Kaytoo')],
  [
    'kind=handoff',
    {
      threads: [
        // A listing may cut a long message short; the thread has all of it.
        thread('msg_h1', '**Changed:** shipped the live la…', {
          kind: 'handoff',
          state: 'paused',
        }),
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
    'board read msg_h1',
    {
      message: {
        id: 'msg_h1',
        text: '**Changed:** shipped the live layer\n**Half-done:** nothing\n**Next:** the revoke button',
      },
      replies: [
        {
          id: 'msg_h1_2',
          text: 'Mitch: the Google app is published now',
          createdAt: '2026-11-20T11:00:00Z',
        },
      ],
    },
  ],
  [
    'board read my-thing --after msg_h1',
    {
      threads: [
        thread('msg_h1', 'handoff', { kind: 'handoff' }),
        thread(
          'msg_n1',
          'Mitch: please look at the flaky gate first',
          {},
          '2026-11-20T12:00:00Z',
        ),
        thread('msg_t1', 'a task', { 'board.task': 'ready' }),
        thread('msg_l9', 'a learning', { kind: 'learning' }),
      ],
    },
  ],
  ...projectRoutes(schema),
]

function session(argv, routes = happyRoutes(), env = { JIG_AGENT: 'kaytoo' }) {
  const out = []
  const code = main(argv, {
    root,
    now: NOW,
    run: fakeRun(routes),
    log: (line) => out.push(line),
    env,
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
    for (const call of board)
      assert.ok(call.line.includes('--scope acme'), call.line)
    // Every read is of this project's channel or of one thread found in it.
    for (const call of board)
      assert.match(call.line, /board read (my-thing|msg_h1) /)
  })

  it('writes the backlog grouped by status and marks what a session may start', () => {
    session(['pull'])
    const backlog = readLocal('backlog.md')
    assert.match(backlog, /## In Progress\n\n- Status history view/)
    assert.match(backlog, /## Ready\n/)
    assert.match(backlog, /- \[startable\] Add the revoke button .*`11111111-1111-4111-8111-111111111111`/)
    assert.match(backlog, /- \[startable\] Show who is online .*`22222222-2222-4222-8222-222222222222`/)
    // Waiting on a person: listed, never startable.
    assert.match(backlog, /## Blocked\n\n- Test on a real iPhone — `33333333-3333-4333-8333-333333333333`/)
    assert.ok(backlog.indexOf('## In Progress') < backlog.indexOf('## Ready'))
    assert.ok(backlog.indexOf('## Ready') < backlog.indexOf('## Triage'))
  })

  it("names the project's droid from the Owner rollup, looked up once", () => {
    const { out } = session(['pull'])
    assert.match(readLocal('backlog.md'), /^Droid: Kaytoo \(Owner, a read-only rollup/m)
    assert.match(out, /2 startable, droid: Kaytoo/)
    const lookups = calls.filter((call) => call.line.includes(`v1/pages/${DROID}`))
    assert.equal(lookups.length, 1)
  })

  it('marks a Ready item startable when the project has no droid', () => {
    session(
      ['pull'],
      happyRoutes([
        [
          'data_sources/ds-1/query',
          { has_more: false, results: [page('77777777-7777-4777-8777-777777777777', 'No droid yet', 'Ready')] },
        ],
      ]),
    )
    assert.match(readLocal('backlog.md'), /- \[startable\] No droid yet/)
    assert.match(readLocal('backlog.md'), /^Droid: no droid/m)
    // No droid ids, so no lookup.
    assert.equal(calls.some((call) => call.line.includes(`v1/pages/${DROID}`)), false)
  })

  it('still pulls when the droid page cannot be read, and says so', () => {
    const { code, out } = session(
      ['pull'],
      happyRoutes([[`v1/pages/${DROID}`, new Error('{"code":"object_not_found"}')]]),
    )
    assert.equal(code, 0)
    assert.equal(calls.filter((call) => call.line.includes(`v1/pages/${DROID}`)).length, 1)
    assert.match(out, /droid: no droid/)
    assert.match(out, /Could not read 1 droid page\(s\).*object_not_found/)
    assert.match(readLocal('backlog.md'), /\[startable\] Add the revoke button/)
  })

  it("finds the droid on the project page when the project has no open items", () => {
    const { out } = session(
      ['pull'],
      happyRoutes([
        ['data_sources/ds-1/query', { has_more: false, results: [] }],
        [
          'data_sources/ds-projects/query',
          {
            has_more: false,
            results: [
              {
                ...project('proj-1', 'My Thing'),
                properties: {
                  ...project('proj-1', 'My Thing').properties,
                  Droid: { type: 'relation', relation: [{ id: DROID }] },
                },
              },
            ],
          },
        ],
      ]),
    )
    assert.match(out, /0 startable, droid: Kaytoo/)
  })

  it('ignores an Owner rollup that does not follow Project', () => {
    const elsewhere = {
      properties: {
        ...RELATION_SCHEMA.properties,
        Owner: {
          type: 'rollup',
          rollup: {
            function: 'show_original',
            relation_property_name: 'Reviewer',
            rollup_property_name: 'Droid',
          },
        },
      },
    }
    const { out } = session(
      ['pull'],
      happyRoutes(
        [
          ['data_sources/ds-1/query', { has_more: false, results: [] }],
          [
            'data_sources/ds-projects/query',
            {
              has_more: false,
              results: [
                {
                  ...project('proj-1', 'My Thing'),
                  properties: {
                    ...project('proj-1', 'My Thing').properties,
                    Droid: { type: 'relation', relation: [{ id: DROID }] },
                  },
                },
              ],
            },
          ],
        ],
        elsewhere,
      ),
    )
    assert.match(out, /0 startable, droid: no droid/)
  })

  it('names every droid once and skips a rollup id that is not an id', () => {
    const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const odd = page('77777777-7777-4777-8777-777777777777', 'Two droids', 'Ready')
    odd.properties.Owner.rollup.array = [
      { type: 'relation', relation: [{ id: DROID }, { id: OTHER }] },
      { type: 'relation', relation: [] },
      { type: 'relation', relation: [{ id: '../v1/users' }] },
    ]
    session(
      ['pull'],
      happyRoutes([
        ['data_sources/ds-1/query', { has_more: false, results: [odd, page('88888888-8888-4888-8888-888888888888', 'One', 'Todo', DROID)] }],
        [`v1/pages/${OTHER}`, droidPage(OTHER, 'Artoo')],
      ]),
    )
    assert.match(readLocal('backlog.md'), /^Droid: Kaytoo, Artoo /m)
    assert.equal(calls.filter((call) => call.line.includes(`v1/pages/${DROID}`)).length, 1)
    assert.equal(calls.some((call) => call.line.includes('users')), false)
  })

  it('writes the last handoff in full, with threads posted since', () => {
    session(['pull'])
    const handoff = readLocal('handoff.md')
    assert.match(handoff, /state=paused/)
    assert.match(handoff, /\*\*Next:\*\* the revoke button/)
    assert.match(handoff, /please look at the flaky gate first/)
  })

  it('shows replies on the handoff thread itself', () => {
    session(['pull'])
    assert.match(readLocal('handoff.md'), /the Google app is published now/)
  })

  it('leaves tasks, learnings and the handoff out of "posted since"', () => {
    session(['pull'])
    const since = readLocal('handoff.md').split('## Posted since')[1]
    assert.doesNotMatch(since, /a task|a learning|msg_h1`/)
  })

  it('takes the newest handoff, whatever order the board lists them in', () => {
    session(
      ['pull'],
      happyRoutes([
        [
          'kind=handoff',
          {
            threads: [
              thread(
                'msg_h1',
                '**Changed:** newest\n**Half-done:** -\n**Next:** -',
                { kind: 'handoff', state: 'review' },
                '2026-11-20T21:00:00Z',
              ),
              thread(
                'msg_h0',
                '**Changed:** older, but replied to later',
                { kind: 'handoff', state: 'paused' },
                '2026-11-20T05:00:00Z',
              ),
            ],
          },
        ],
      ]),
    )
    assert.match(readLocal('handoff.md'), /Posted 2026-11-20T21:00:00Z/)
    assert.ok(
      calls.some((call) => call.line.includes('kind=handoff --limit 100')),
    )
  })

  it('says a silent channel may be a wrong name', () => {
    const { out } = session(
      ['pull'],
      happyRoutes([['board read', BOARD_EMPTY]]),
    )
    assert.match(out, /my-thing.*session\.config\.json/s)
  })

  it('fails when a later board read fails, and writes nothing', () => {
    assert.throws(
      () =>
        session(
          ['pull'],
          happyRoutes([['kind=learning', new Error('rate_limited')]]),
        ),
      /Board/,
    )
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('fails on a read that is not JSON rather than treating it as empty', () => {
    assert.throws(
      () => session(['pull'], happyRoutes([['kind=handoff', () => RAW('oops')]])),
      /Board.*not JSON/s,
    )
  })

  it('treats leftover files without a session record as unclosed', () => {
    mkdirSync(join(root, 'local', 'session'), { recursive: true })
    writeFileSync(local('plan.md'), '# old plan')
    const { code, out } = session(['pull'])
    assert.equal(code, 2)
    assert.match(out, /no readable session\.json/)
    assert.equal(readLocal('plan.md'), '# old plan')
  })

  it('refuses two projects with the same name', () => {
    assert.throws(
      () =>
        session(
          ['pull'],
          happyRoutes([
            [
              'data_sources/ds-projects/query',
              {
                results: [
                  project('proj-1', 'my thing'),
                  project('proj-2', 'MY THING'),
                ],
              },
            ],
          ]),
        ),
      /more than one/,
    )
  })

  it('prefers the exact name over one that differs only in case', () => {
    session(
      ['pull'],
      happyRoutes([
        [
          'data_sources/ds-projects/query',
          {
            results: [
              project('proj-lower', 'my thing'),
              project('proj-1', ' My Thing '),
            ],
          },
        ],
      ]),
    )
    assert.deepEqual(backlogFilter().and[0].relation, { contains: 'proj-1' })
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
                  results: [page('77777777-7777-4777-8777-777777777777', 'First', 'Ready')],
                }
              : { has_more: false, results: [page('88888888-8888-4888-8888-888888888888', 'Second', 'Todo')] },
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
    session(['start', '11111111-1111-4111-8111-111111111111'], [
      ['pages/11111111-1111-4111-8111-111111111111 -X PATCH', {}],
      ['pages/11111111-1111-4111-8111-111111111111', page('11111111-1111-4111-8111-111111111111', 'Add the revoke button', 'Ready')],
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
    ['pages/11111111-1111-4111-8111-111111111111 -X PATCH', {}],
    ['pages/11111111-1111-4111-8111-111111111111', page('11111111-1111-4111-8111-111111111111', 'Add the revoke button', status, owner)],
  ]

  it('claims a Ready item, writes only its status, and records the claim', () => {
    session(['pull'])
    session(['start', '11111111-1111-4111-8111-111111111111'], live('Ready', DROID))
    const patch = calls.find((call) => call.line.includes('-X PATCH'))
    // Owner is a rollup: Notion would take the write and silently drop it.
    assert.deepEqual(JSON.parse(patch.args[patch.args.indexOf('-d') + 1]), {
      properties: { Status: { select: { name: 'In Progress' } } },
    })
    assert.deepEqual(JSON.parse(readLocal('session.json')).claimed, [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Add the revoke button' },
    ])
  })

  it('checks the live status, so an item another session took is refused', () => {
    session(['pull'])
    assert.throws(
      () => session(['start', '11111111-1111-4111-8111-111111111111'], live('In Progress')),
      /In Progress/,
    )
    assert.equal(
      calls.some((call) => call.line.includes('-X PATCH')),
      false,
    )
  })

  it('takes over an item when forced', () => {
    session(['pull'])
    session(['start', '11111111-1111-4111-8111-111111111111', '--force'], live('In Progress', DROID))
    assert.ok(calls.some((call) => call.line.includes('-X PATCH')))
  })

  it("refuses an item that waits on a person, even when forced: it is made Ready first", () => {
    session(['pull'])
    for (const status of ['Blocked', 'In Review', 'Triage', 'Todo', 'Done']) {
      for (const force of [[], ['--force']]) {
        assert.throws(
          () => session(['start', '11111111-1111-4111-8111-111111111111', ...force], live(status, DROID)),
          (error) =>
            error instanceof SessionError &&
            error.message.includes(`${status}, not Ready`) &&
            error.message.includes('set <id> --status Ready') &&
            !error.message.includes('start --force'),
        )
      }
    }
    assert.equal(
      calls.some((call) => call.line.includes('-X PATCH')),
      false,
    )
  })

  it('starts a Ready item whatever droid the project has, or none', () => {
    for (const droid of [DROID, null]) {
      session(['pull'])
      session(['start', '11111111-1111-4111-8111-111111111111'], live('Ready', droid))
      assert.ok(calls.some((call) => call.line.includes('-X PATCH')))
      session(['discard', '--force'], live('In Progress', droid))
      calls = []
    }
  })

  it('needs a session', () => {
    assert.throws(() => session(['start', '11111111-1111-4111-8111-111111111111']), /pull/)
  })
})

describe('set', () => {
  const ITEM = '77777777-7777-4777-8777-777777777777'
  const live = (status, owner) => [
    [`pages/${ITEM} -X PATCH`, {}],
    [`pages/${ITEM}`, page(ITEM, 'An item', status, owner)],
  ]
  const patched = () => calls.some((call) => call.line.includes('-X PATCH'))

  it('moves an item to review with its PR link', () => {
    session(['pull'])
    session(['start', ITEM], live('Ready'))
    calls = []
    session(
      ['set', '77777777-7777-4777-8777-777777777777', '--status', 'In Review', '--pr', 'https://gh.test/pr/4'],
      [
        ['pages/77777777-7777-4777-8777-777777777777 -X PATCH', {}],
        [
          'pages/77777777-7777-4777-8777-777777777777',
          page('77777777-7777-4777-8777-777777777777', 'An item', 'In Progress'),
        ],
      ],
    )
    const patch = calls.find((call) => call.line.includes('-X PATCH'))
    assert.deepEqual(JSON.parse(patch.args[patch.args.indexOf('-d') + 1]), {
      properties: {
        Status: { select: { name: 'In Review' } },
        'PR Link': { url: 'https://gh.test/pr/4' },
      },
    })
  })

  it("refuses to change the status of an In Progress item another session holds", () => {
    assert.throws(
      () => session(['set', ITEM, '--status', 'Ready'], live('In Progress')),
      /In Progress.*--force/s,
    )
    assert.equal(patched(), false)
  })

  it('refuses it inside a session that did not claim the item', () => {
    session(['pull'])
    assert.throws(
      () => session(['set', ITEM, '--status', 'Ready'], live('In Progress')),
      /In Progress/,
    )
    assert.equal(patched(), false)
  })

  it('changes it when forced, after asking', () => {
    session(['set', ITEM, '--status', 'Ready', '--force'], live('In Progress'))
    assert.ok(patched())
  })

  it('makes an agreed Todo item Ready without touching Owner', () => {
    session(['set', ITEM, '--status', 'Ready'], live('Todo', DROID))
    const patch = calls.find((call) => call.line.includes('-X PATCH'))
    assert.deepEqual(JSON.parse(patch.args[patch.args.indexOf('-d') + 1]), {
      properties: { Status: { select: { name: 'Ready' } } },
    })
  })

  it('rejects a status the backlog does not have', () => {
    assert.throws(
      () => session(['set', '77777777-7777-4777-8777-777777777777', '--status', 'Shipped'], []),
      /Shipped/,
    )
  })

  it("refuses --owner: Owner is the project's droid and read-only", () => {
    for (const args of [['--owner', 'Mitch'], ['--owner=Code Agent']]) {
      assert.throws(
        () => session(['set', ITEM, ...args, '--status', 'Ready'], live('Todo')),
        (error) =>
          error instanceof SessionError &&
          /Owner is the project's droid, a read-only rollup/.test(error.message),
      )
    }
    assert.equal(calls.length, 0)
  })

  it('says what set can change when given nothing', () => {
    assert.throws(() => session(['set', ITEM], []), /--status, --pr$/)
  })
})

describe('raise', () => {
  it('creates a Triage item for this project with no owner', () => {
    const { out } = session(
      ['raise', 'Signed-out /api/me logs a 401'],
      [
        ['v1/pages', { id: '66666666-6666-4666-8666-666666666666', url: 'https://notion.test/66666666-6666-4666-8666-666666666666' }],
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
    assert.match(out, /66666666-6666-4666-8666-666666666666/)
  })

  it("refuses --owner and creates nothing", () => {
    for (const args of [['--owner', 'Mitch'], ['--owner=Mitch'], ['--file', '--owner']]) {
      assert.throws(
        () => session(['raise', 'Something', ...args], projectRoutes()),
        /read-only rollup.*--status Blocked/s,
      )
    }
    assert.equal(calls.length, 0)
  })

  it("files something that waits on a person as Blocked, with the reason in the body", () => {
    writeFileSync(join(root, 'why.md'), 'Needs a real device.')
    session(
      [
        'raise',
        'Test on a real iPhone',
        '--status',
        'Blocked',
        '--file',
        'why.md',
      ],
      [
        ['pages update 66666666-6666-4666-8666-666666666666', {}],
        ['v1/pages', { id: '66666666-6666-4666-8666-666666666666', url: 'https://notion.test/66666666-6666-4666-8666-666666666666' }],
        ...projectRoutes(),
      ],
    )
    const create = calls.find((call) => call.line.includes('v1/pages'))
    const properties = JSON.parse(
      create.args[create.args.indexOf('-d') + 1],
    ).properties
    assert.equal(properties.Owner, undefined)
    assert.deepEqual(properties.Status, { select: { name: 'Blocked' } })
    const body = calls.find((call) => call.line.includes('pages update'))
    // One argument, so a body that starts with a dash is not read as a flag.
    assert.ok(body.args.includes('--content=Needs a real device.'))
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
    assert.match(post.line, /--as kaytoo/)
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
  const READY = '11111111-1111-4111-8111-111111111111'
  const claim = () =>
    session(['start', READY], [
      [`pages/${READY} -X PATCH`, {}],
      [`pages/${READY}`, page(READY, 'Add the revoke button', 'Ready')],
    ])

  it('removes the local reference without writing anywhere', () => {
    session(['pull'])
    calls = []
    session(['discard'], [])
    assert.equal(calls.length, 0)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('refuses while the session still holds items, and names them', () => {
    session(['pull'])
    claim()
    assert.throws(() => session(['discard'], []), /Add the revoke button/)
    assert.ok(existsSync(local('session.json')))
  })

  it('drops a session that holds items when forced', () => {
    session(['pull'])
    claim()
    const { out } = session(['discard', '--force'], [])
    assert.equal(existsSync(join(root, 'local', 'session')), false)
    assert.match(out, /In Progress.*Add the revoke button/s)
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
      env: childEnv,
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
      env: childEnv,
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /usage: session\.mjs/)
  })
})

describe('what a session wrote', () => {
  const READY = '11111111-1111-4111-8111-111111111111'
  const NEW = '66666666-6666-4666-8666-666666666666'
  const writes = () => JSON.parse(readLocal('session.json')).written

  it('is recorded, so an interrupted close can be finished without repeats', () => {
    session(['pull'])
    session(['start', READY], [
      [`pages/${READY} -X PATCH`, {}],
      [`pages/${READY}`, page(READY, 'Add the revoke button', 'Ready')],
    ])
    session(['set', READY, '--status', 'In Review', '--pr', 'https://gh.test/4'], [
      [`pages/${READY} -X PATCH`, {}],
      [`pages/${READY}`, page(READY, 'Add the revoke button', 'In Progress')],
    ])
    session(['raise', 'A new bug'], [
      ['v1/pages', { id: NEW }],
      ...projectRoutes(),
    ])
    session(['learn', 'Sockets drop at 60s'], [
      ['board post', { id: 'msg_new' }],
    ])
    const written = writes()
    assert.equal(written.length, 4)
    assert.match(written[0], /start.*Add the revoke button/)
    assert.match(written[1], /set.*In Review/)
    assert.match(written[2], /raise.*A new bug/)
    assert.match(written[3], /learn.*Sockets drop at 60s/)
  })

  it('is listed when the next pull finds the session unclosed', () => {
    session(['pull'])
    session(['learn', 'Sockets drop at 60s'], [
      ['board post', { id: 'msg_new' }],
    ])
    const { code, out } = session(['pull'])
    assert.equal(code, 2)
    assert.match(out, /already wrote.*learn.*Sockets drop at 60s/s)
  })

  it('works outside a session, recording nothing', () => {
    session(['learn', 'Sockets drop at 60s'], [
      ['board post', { id: 'msg_new' }],
    ])
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })
})

describe('a write whose answer cannot be read', () => {
  const HANDOFF = '**Changed:** x\n**Half-done:** y\n**Next:** z'

  it('still counts as written: the handoff is not left to be posted twice', () => {
    session(['pull'])
    writeFileSync(local('close.md'), HANDOFF)
    const { code } = session(
      ['close', '--file', 'local/session/close.md', '--state', 'paused'],
      [['board post', RAW('Vercel CLI 66.2.0 [beta]\nposted')]],
    )
    assert.equal(code, 0)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('reads JSON that follows a banner line', () => {
    const { out } = session(['learn', 'x'], [
      ['board post', RAW('Vercel CLI 66.2.0 [beta]\n{"id":"msg_9"}\n')],
    ])
    assert.match(out, /msg_9/)
  })

  it('gives every post a key, so a retry of the same text posts once', () => {
    const key = (text) => {
      calls = []
      session(['learn', text], [['board post', { id: 'm' }]])
      const { args } = calls[0]
      return args[args.indexOf('--idempotency-key') + 1]
    }
    assert.match(key('one'), /^[0-9a-f]{32,}$/)
    assert.equal(key('one'), key('one'))
    assert.notEqual(key('one'), key('two'))
  })

  it('says so when Notion created an item but returned no id', () => {
    const { out } = session(['raise', 'A new bug'], [
      ['v1/pages', RAW('')],
      ...projectRoutes(),
    ])
    assert.match(out, /check the backlog before raising it again/i)
  })
})

describe('arguments', () => {
  const READY = '11111111-1111-4111-8111-111111111111'

  it('does not take the next flag as a value', () => {
    assert.throws(
      () => session(['set', READY, '--pr', '--status', 'Done'], []),
      /--pr needs a value/,
    )
    assert.equal(calls.length, 0)
  })

  it('rejects an unknown option', () => {
    assert.throws(() => session(['pull', '--fast'], []), /unknown option/)
  })

  it('rejects an item id that is not a Notion id', () => {
    for (const command of ['set', 'start'])
      assert.throws(
        () => session([command, '../databases/abc', '--status', 'Done'], []),
        /not a Notion page id/,
      )
    assert.equal(calls.length, 0)
  })

  it('reads --file only from inside the repo', () => {
    assert.throws(
      () => session(['learn', 'x', '--file', '/etc/hosts'], []),
      /inside the repo/,
    )
    assert.throws(
      () => session(['learn', 'x', '--file', '../outside.md'], []),
      /inside the repo/,
    )
  })

  it('names a --file that does not exist', () => {
    assert.throws(
      () => session(['learn', 'x', '--file', 'missing.md'], []),
      (error) => error instanceof SessionError && /missing\.md/.test(error.message),
    )
  })

  it('labels a blocked handoff', () => {
    session(['pull'])
    writeFileSync(
      local('close.md'),
      '**Changed:** x\n**Half-done:** y\n**Next:** z',
    )
    calls = []
    session(
      [
        'close',
        '--file',
        'local/session/close.md',
        '--state',
        'waiting',
        '--blocked',
        'decision',
      ],
      [['board post', { id: 'm' }]],
    )
    assert.match(calls.at(-1).line, /--label blocked=decision/)
  })
})

describe('the lock', () => {
  const READY = '11111111-1111-4111-8111-111111111111'

  it('cannot be taken with set: In Progress goes through start', () => {
    assert.throws(
      () => session(['set', READY, '--status', 'In Progress'], []),
      /start/,
    )
    assert.equal(calls.length, 0)
  })

  it("refuses an item from another project's backlog", () => {
    session(['pull'])
    const foreign = {
      ...page(READY, 'Someone else', 'Ready'),
      parent: { type: 'data_source_id', data_source_id: 'ds-other' },
    }
    assert.throws(
      () => session(['start', READY], [[`pages/${READY}`, foreign]]),
      /not in this project's backlog/,
    )
  })

  it('refuses when the item cannot be read', () => {
    session(['pull'])
    assert.throws(
      () => session(['start', READY], [[`pages/${READY}`, RAW('')]]),
      /Notion.*not JSON/s,
    )
  })
})

describe('closing', () => {
  const READY = '11111111-1111-4111-8111-111111111111'
  const HANDOFF = '**Changed:** x\n**Half-done:** y\n**Next:** z'

  it('needs a session: there is nothing to hand off without one', () => {
    writeFileSync(join(root, 'h.md'), HANDOFF)
    assert.throws(
      () =>
        session(['close', '--file', 'h.md', '--state', 'done'], [
          ['board post', { id: 'm' }],
        ]),
      /pull/,
    )
    assert.equal(calls.length, 0)
  })

  it('warns about items it is leaving locked', () => {
    session(['pull'])
    session(['start', READY], [
      [`pages/${READY} -X PATCH`, {}],
      [`pages/${READY}`, page(READY, 'Add the revoke button', 'Ready')],
    ])
    writeFileSync(local('close.md'), HANDOFF)
    const { out } = session(
      ['close', '--file', 'local/session/close.md', '--state', 'paused'],
      [
        ['board post', { id: 'm' }],
        [
          `pages/${READY}`,
          page(READY, 'Add the revoke button', 'In Progress'),
        ],
      ],
    )
    assert.match(out, /still In Progress.*Add the revoke button/s)
  })

  it('finishes an unclosed session: close, then pull again', () => {
    session(['pull'])
    writeFileSync(local('close.md'), HANDOFF)
    assert.equal(session(['pull']).code, 2)
    session(
      ['close', '--file', 'local/session/close.md', '--state', 'paused'],
      [['board post', { id: 'm' }]],
    )
    assert.equal(session(['pull']).code, 0)
  })
})

describe('settings and state files', () => {
  it('says which settings are missing', () => {
    writeFileSync(
      join(root, 'session.config.json'),
      JSON.stringify({ board: { scope: 'acme' }, backlog: {} }),
    )
    assert.throws(
      () => session(['pull']),
      /board\.channel, backlog\.dataSource, backlog\.project/,
    )
  })

  it('reports a settings file that is not JSON', () => {
    writeFileSync(join(root, 'session.config.json'), '{ nope')
    assert.throws(
      () => session(['pull']),
      (error) =>
        error instanceof SessionError &&
        /session\.config\.json is not valid JSON/.test(error.message),
    )
  })

  it('posts as the agent JIG_AGENT names', () => {
    session(['learn', 'x'], [['board post', { id: 'm' }]], { JIG_AGENT: 'artoo' })
    assert.match(calls[0].line, /--as artoo(\s|$)/)
  })

  it('says in pull who its posts go out as', () => {
    const { out } = session(['pull'], happyRoutes(), { JIG_AGENT: 'beebee' })
    assert.match(out, /Board posts go out as beebee/)
  })

  it('runs nothing when JIG_AGENT is unset, so nobody posts as a default', () => {
    for (const env of [{}, { JIG_AGENT: '' }])
      assert.throws(
        () => session(['learn', 'x'], [['board post', { id: 'm' }]], env),
        (error) =>
          error instanceof SessionError && /JIG_AGENT is not set/.test(error.message),
      )
    assert.throws(() => session(['pull'], happyRoutes(), {}), /JIG_AGENT is not set/)
    assert.equal(calls.length, 0)
  })

  it('refuses a JIG_AGENT that is not a plain agent name', () => {
    for (const agent of [
      'Beebee',
      'bee bee',
      '--label',
      'a/b',
      '1droid',
      'bee-',
      'a--b',
      'beebee\n',
      'a'.repeat(33),
    ])
      assert.throws(
        () => session(['learn', 'x'], [['board post', { id: 'm' }]], { JIG_AGENT: agent }),
        /is not an agent name/,
      )
    assert.equal(calls.length, 0)
  })

  it('refuses a settings file that still names a board.profile', () => {
    writeFileSync(
      join(root, 'session.config.json'),
      JSON.stringify({ ...CONFIG, board: { ...CONFIG.board, profile: 'claude' } }),
    )
    assert.throws(() => session(['pull']), /board\.profile, which is gone/)
    assert.equal(calls.length, 0)
  })

  it('reports an unclosed session without JIG_AGENT, so recovery can start', () => {
    session(['pull'])
    calls = []
    const { code, out } = session(['pull'], happyRoutes(), {})
    assert.equal(code, 2)
    assert.match(out, /Unclosed session/)
    assert.equal(calls.length, 0)
  })

  it('runs the Notion-only commands recovery needs without JIG_AGENT', () => {
    session(['raise', 'A new bug'], [
      ['v1/pages', { id: '66666666-6666-4666-8666-666666666666' }],
      ...projectRoutes(),
    ], {})
    assert.ok(calls.some((call) => call.line.includes('v1/pages')))
  })

  it('refuses to close without JIG_AGENT: a handoff must name its author', () => {
    session(['pull'])
    writeFileSync(local('close.md'), '**Changed:** x\n**Half-done:** y\n**Next:** z')
    calls = []
    assert.throws(
      () => session(['close', '--file', local('close.md'), '--state', 'done'], [], {}),
      /JIG_AGENT is not set/,
    )
    assert.equal(calls.length, 0)
  })

  it('reports a damaged session record instead of crashing', () => {
    session(['pull'])
    writeFileSync(local('session.json'), '')
    const { code, out } = session(['pull'])
    assert.equal(code, 2)
    assert.match(out, /no readable session\.json/)
  })

  it('files under a select Project by name', () => {
    session(['raise', 'A new bug'], [
      ['v1/pages', { id: '66666666-6666-4666-8666-666666666666' }],
      ...projectRoutes(SELECT_SCHEMA),
    ])
    const create = calls.find((call) => call.line.includes('v1/pages'))
    assert.deepEqual(
      JSON.parse(create.args[create.args.indexOf('-d') + 1]).properties.Project,
      { select: { name: 'My Thing' } },
    )
  })
})

describe('running a real command', () => {
  // The Board CLI reports failures as JSON on stdout with nothing on stderr.
  const node = (source) => defaultRun(process.execPath, ['-e', source])

  it('returns stdout', () => {
    assert.equal(node('console.log("hi")').trim(), 'hi')
  })

  it('keeps what a failing command printed to stdout', () => {
    assert.throws(
      () => node('console.log(\'{"reason":"channel_not_found"}\'); process.exit(1)'),
      /channel_not_found/,
    )
  })

  it('keeps stderr too', () => {
    assert.throws(
      () => node('console.error("bad token"); process.exit(1)'),
      /bad token/,
    )
  })

  it('says when the command is not installed', () => {
    assert.throws(
      () => defaultRun('definitely-not-a-command-xyz', []),
      /not installed/,
    )
  })
})

describe('review round two', () => {
  const READY = '11111111-1111-4111-8111-111111111111'
  const item = (status, owner) => [
    [`pages/${READY} -X PATCH`, {}],
    [`pages/${READY}`, page(READY, 'Add the revoke button', status, owner)],
  ]
  const claim = () => {
    session(['pull'])
    session(['start', READY], item('Ready'))
  }
  const claimed = () => JSON.parse(readLocal('session.json')).claimed

  it('releases a claim when the item is set to anything else', () => {
    claim()
    session(['set', READY, '--status', 'Ready'], item('In Progress'))
    assert.deepEqual(claimed(), [])
    assert.equal(session(['discard'], []).code, 0)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('lets a session go when its items are no longer In Progress', () => {
    claim()
    // Someone moved it in Notion; the local record still lists the claim.
    const { code } = session(['discard'], item('In Review'))
    assert.equal(code, 0)
    assert.equal(existsSync(join(root, 'local', 'session')), false)
  })

  it('still refuses to drop a session whose item is In Progress', () => {
    claim()
    assert.throws(
      () => session(['discard'], item('In Progress')),
      /Add the revoke button/,
    )
  })

  it('says there is nothing to discard when there is no session', () => {
    const { out } = session(['discard'], [])
    assert.match(out, /no session/i)
    assert.doesNotMatch(out, /Removed/)
  })

  it("will not change an item in another project's backlog", () => {
    const foreign = {
      ...page(READY, 'Someone else', 'In Progress'),
      parent: { type: 'data_source_id', data_source_id: 'ds-other' },
    }
    assert.throws(
      () =>
        session(['set', READY, '--status', 'Done'], [
          [`pages/${READY} -X PATCH`, {}],
          [`pages/${READY}`, foreign],
        ]),
      /not in this project's backlog/,
    )
    assert.equal(
      calls.some((call) => call.line.includes('-X PATCH')),
      false,
    )
  })

  it('posts a corrected label as a new post, not a repeat of the old one', () => {
    const key = (topic) => {
      calls = []
      session(['learn', 'same text', '--topic', topic], [
        ['board post', { id: 'm' }],
      ])
      const { args } = calls[0]
      return args[args.indexOf('--idempotency-key') + 1]
    }
    assert.notEqual(key('vercel'), key('pnpm'))
    assert.equal(key('vercel'), key('vercel'))
  })

  it('reports the thread it posted, whatever shape the answer takes', () => {
    for (const answer of [
      { id: 'msg_abc_1' },
      { message: { id: 'msg_abc_1', text: 'x' } },
      RAW('Vercel CLI 66.2.0\nmsg_abc_1\n'),
    ]) {
      session(['pull'])
      const { out } = session(['learn', 'a headline'], [['board post', answer]])
      assert.match(out, /msg_abc_1/)
      assert.match(
        JSON.parse(readLocal('session.json')).written[0],
        /msg_abc_1/,
      )
      session(['discard'], [])
    }
  })

  describe('--file', () => {
    it('will not post env or credential files', () => {
      for (const name of ['.envrc', '.env.local', '.vercel/project.json', 'id.pem']) {
        mkdirSync(dirname(join(root, name)), { recursive: true })
        writeFileSync(join(root, name), 'SECRET=1')
        assert.throws(
          () => session(['learn', 'x', '--file', name], []),
          /will not be posted/,
          name,
        )
      }
      assert.equal(calls.length, 0)
    })

    it('follows a symlink before deciding a file is inside the repo', () => {
      const outside = join(scratch, `outside-${counter}.md`)
      writeFileSync(outside, 'not ours')
      mkdirSync(join(root, 'local'), { recursive: true })
      symlinkSync(outside, join(root, 'local', 'link.md'))
      assert.throws(
        () => session(['learn', 'x', '--file', 'local/link.md'], []),
        /inside the repo/,
      )
    })

    it('accepts a file whose name merely starts with two dots', () => {
      writeFileSync(join(root, '..notes.md'), 'fine')
      session(['learn', 'x', '--file', '..notes.md'], [
        ['board post', { id: 'm' }],
      ])
      assert.equal(calls[0].input, 'x\n\nfine')
    })
  })

  describe('from a subdirectory', () => {
    const script = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../template/base/scripts/session.mjs',
    )
    const inSubdirectory = (...args) => {
      spawnSync('git', ['init', '-q'], { cwd: root, env: childEnv })
      mkdirSync(join(root, 'apps', 'web'), { recursive: true })
      return spawnSync(process.execPath, [script, ...args], {
        cwd: join(root, 'apps', 'web'),
        encoding: 'utf8',
        env: childEnv,
      })
    }

    it('works on the repo, not on the directory it was run from', () => {
      mkdirSync(join(root, 'local', 'session'), { recursive: true })
      writeFileSync(
        local('session.json'),
        JSON.stringify({ startedAt: 'x', claimed: [], written: [] }),
      )
      const result = inSubdirectory('discard')
      assert.equal(result.status, 0, result.stderr)
      assert.equal(existsSync(join(root, 'local', 'session')), false)
    })

    it('finds the settings at the repo root', () => {
      const result = inSubdirectory('set', 'not-an-id', '--status', 'Done')
      // Past the settings and on to the argument: the settings were found.
      assert.match(result.stderr, /not a Notion page id/)
    })
  })
})

describe('review round three', () => {
  const READY = '11111111-1111-4111-8111-111111111111'
  const HANDOFF = '**Changed:** x\n**Half-done:** y\n**Next:** z'
  const item = (status, owner) => [
    [`pages/${READY} -X PATCH`, {}],
    [`pages/${READY}`, page(READY, 'Add the revoke button', status, owner)],
  ]
  const patched = () => calls.some((call) => call.line.includes('-X PATCH'))

  it('gives the forced set for each claimed item close leaves In Progress', () => {
    session(['pull'])
    session(['start', READY], item('Ready'))
    writeFileSync(local('close.md'), HANDOFF)
    const { out } = session(
      ['close', '--file', 'local/session/close.md', '--state', 'paused'],
      [['board post', { id: 'm' }], ...item('In Progress')],
    )
    assert.ok(
      out.includes(
        `node scripts/session.mjs set ${READY} --status <Ready|Blocked|In Review> --force`,
      ),
      out,
    )
    assert.match(out, /this session's own claims/)
  })

  it('refuses to release an In Progress item this session does not hold', () => {
    session(['pull'])
    assert.throws(
      () => session(['set', READY, '--status', 'Blocked'], item('In Progress')),
      /In Progress.*--force/s,
    )
    assert.equal(patched(), false)
  })

  it('refuses a PR link on an In Progress item this session does not hold', () => {
    assert.throws(
      () => session(['set', READY, '--pr', 'https://gh.test/pr/1'], item('In Progress')),
      /In Progress/,
    )
    assert.equal(patched(), false)
  })

  it('releases it when forced', () => {
    session(['pull'])
    session(['set', READY, '--status', 'Blocked', '--force'], item('In Progress'))
    assert.ok(patched())
  })

  it("says set's refusal needs the owner of the backlog's word, and start --force takes over", () => {
    assert.throws(
      () => session(['set', READY, '--status', 'Ready'], item('In Progress')),
      /owner of the backlog.*start --force/s,
    )
  })

  it("tells how to release a dead session's items when its record is unreadable", () => {
    mkdirSync(join(root, 'local', 'session'), { recursive: true })
    writeFileSync(local('session.json'), '{not json')
    const { code, out } = session(['pull'], [])
    assert.equal(code, 2)
    assert.match(out, /set <id> --status Ready --force/)
    assert.match(out, /user's word/)
  })
})
