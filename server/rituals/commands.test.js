const test = require('node:test')
const assert = require('node:assert/strict')
const { commands, routes, parseCommand } = require('./command-catalog')
const { registerCommands } = require('./commands-slack')
const { ui } = require('./slack')
const { registerProductivity } = require('./productivity-slack')
const { alert, sendView, restoreInputs, actionTable, fallbackView } = require('./presentation')

test('14 commands have consistent help; new commands use exact names and staging isolation', () => {
  assert.equal(commands.length, 14)
  for (const c of commands) {
    for (const h of ['help', '-h', '--help', ' HELP ']) assert.equal(parseCommand(`/${c.name}`, h).help, true)
    assert.equal(parseCommand(`/t${c.name}`, 'help'), null)
    assert.equal(parseCommand(`/${c.name}`, 'help', true), null)
    assert.equal(parseCommand(`/t${c.name}`, 'help', true).name, c.name)
    if (!c.legacy) {
      for (const sub of Object.keys(routes[c.name])) assert.ok(parseCommand(`/${c.name}`, sub).tool)
      for (const text of ['delete everything', '__proto__', 'constructor', 'mine extra', '<!channel>']) assert.equal(parseCommand(`/${c.name}`, text).invalid, true)
    }
  }
  assert.equal(parseCommand('/sync', '-r 7'), null)
  assert.equal(parseCommand('/pick', 'rotate'), null)
  assert.equal(parseCommand('/unknown', 'help'), null)
  assert.equal(parseCommand('/leave', 'help'), null) // Slack's built-in channel-exit command.
  assert.equal(parseCommand('/timeoff', 'coverage').action, 'coverage')
})
function fixture(configs = []) {
  const calls = [], pending = [], views = [], handlers = {}
  const client = { views: { open: async ({ view }) => { views.push(view) } } }
  const renderer = { apiFor: () => ({}), render: async (_api, ctx, action, data) => { calls.push({ ctx, action, data }); return ui.modal('Test', 'test', '', [ui.section('Content')], null) } }
  const api = registerCommands({
    app: { use: fn => { handlers.use = fn }, view: (id, fn) => { handlers[id] = fn }, action: (id, fn) => { handlers[id] = fn } },
    store: { list: async () => { calls.push('db'); return configs } },
    member: async () => { calls.push('member') },
    tools: Object.fromEntries(['work', 'collab', 'plan', 'coord', 'integ'].map(k => [k, renderer])), ui,
    modalClient: async () => { calls.push('loading'); return client }, background: fn => pending.push(fn()), test: false,
  })
  const body = { command: '/todo', text: 'mine', team_id: 'T1', user_id: 'U1', channel_id: 'C1', trigger_id: 'TR' }
  return { ...api, calls, views, handlers, body, client, async run(b = body) {
    await handlers.use({ body: b, client, ack: async () => calls.push('ack'), next: async () => calls.push('next') })
    await Promise.all(pending.splice(0))
  } }
}
test('personal tasks acknowledge first and never require a workflow or channel access', async () => {
  const f = fixture(); await f.run()
  assert.deepEqual(f.calls.slice(0, 2), ['ack', 'loading'])
  assert.ok(!f.calls.includes('db') && !f.calls.includes('member'))
  assert.equal(f.calls[2].action, 'todos')
  assert.equal(f.calls[2].ctx.user, 'U1')
})
test('unknown options and all help views are private, bounded and perform no lookups', async () => {
  const f = fixture(); await f.run({ ...f.body, command: '/poll', text: 'publish immediately' })
  assert.match(JSON.stringify(f.views[0]), /Nothing was changed/)
  assert.ok(!f.calls.includes('db'))
  for (const c of commands) {
    const v = f.help(c.name)
    assert.ok(v.blocks.length <= 100 && v.title.text.length <= 24)
    assert.ok(v.blocks.every(b => b.type !== 'section' || b.text.text.length <= 3000))
  }
})
test('single workflows auto-select; missing workflows explain setup without enabling anything', async () => {
  for (const count of [0, 1]) {
    const f = fixture(count ? [{ id: 'A', name: 'Team', team: 'T1' }] : [])
    await f.run({ ...f.body, command: '/plan', text: 'goals' })
    assert.deepEqual(f.calls.slice(0, 4), ['ack', 'loading', 'member', 'db'])
    if (count) assert.equal(f.calls[4].ctx.config, 'A')
    else assert.match(JSON.stringify(f.views[0]), /Paused/)
  }
})
test('workflow picker excludes other tenants and rejects stale or forged selections', async () => {
  const configs = [{ id: 'A', name: 'Alpha', team: 'T1' }, { id: 'B', name: 'Beta', team: 'T1' }, { id: 'X', name: 'Secret', team: 'T2' }]
  const f = fixture(configs); const body = { ...f.body, command: '/report', text: 'month' }
  await f.run(body)
  const v = f.views[0]; assert.equal(v.callback_id, 'kick_command_choose'); assert.ok(!JSON.stringify(v).includes('Secret'))
  const parsed = parseCommand(body.command, body.text)
  await assert.rejects(f.show(f.client, body, parsed, 'X'))
  await f.show(f.client, body, parsed, 'B')
  assert.equal(f.calls.at(-1).ctx.config, 'B'); assert.equal(f.calls.at(-1).data.days, 30)
  const replies = []
  await f.handlers.kick_command_choose({ body: { team: { id: 'T1' }, user: { id: 'U1' } }, client: f.client, view: { ...v, state: { values: { workflow: { value: { selected_option: { value: 'X' } } } } } }, ack: async r => replies.push(r) })
  assert.equal(replies[0].view.title.text, 'Unable to open tool')
})
test('every shortcut resolves to the correct tool and old command operations pass through', async () => {
  for (const [name, subs] of Object.entries(routes)) for (const [sub, expected] of Object.entries(subs)) {
    const f = fixture([{ id: 'A', name: 'Team', team: 'T1' }])
    await f.run({ ...f.body, command: `/${name}`, text: sub })
    const r = f.calls.find(x => x?.action)
    assert.equal(r.action, expected.action); assert.deepEqual(r.data, { ...expected.data, c: name === 'todo' && sub !== 'channel' ? undefined : 'A' })
  }
  const f = fixture(); await f.run({ ...f.body, command: '/sync', text: '-r 7' }); assert.deepEqual(f.calls, ['next'])
})
test('report presets use inclusive trailing 7 and 30 day UTC ranges', async () => {
  const { render } = registerProductivity({ app: { action() {}, view() {} }, ui })
  for (const days of [7, 30]) {
    const v = await render({ channel: async () => {} }, { config: 'A' }, 'report', { days })
    const from = v.blocks.find(b => b.block_id === 'from').element.initial_date, to = v.blocks.find(b => b.block_id === 'to').element.initial_date
    assert.equal((Date.parse(to) - Date.parse(from)) / 86400000 + 1, days)
  }
})
test('modern controls preserve cleared drafts and newer blocks have safe fallbacks', async () => {
  const block = ui.input('date', 'Date', { type: 'datepicker', initial_date: '2026-10-15' }, true)
  assert.equal(restoreInputs([block], { date: { value: { selected_date: null } } })[0].element.initial_date, undefined)
  assert.equal(ui.select('s', 'Status', [ui.option('Open', 'open'), ui.option('Done', 'done')], 'open').element.type, 'radio_buttons')
  const table = actionTable([{ id: 'A', detail: '<!channel> sensitive & text', due: '2026-10-15' }], 'C')
  assert.equal(table.rows.length, 2); assert.equal(table.rows[1][2].fallback.type, 'raw_text')
  const view = { type: 'home', blocks: [table] }; const calls = []
  await sendView(async a => { calls.push(a); if (calls.length === 1) throw { data: { error: 'invalid_blocks' } }; return {} }, { view })
  assert.equal(calls.length, 2); assert.equal(calls[1].view.blocks[0].text.type, 'plain_text')
  assert.equal(fallbackView({ blocks: [alert('Saved', 'success')] }).blocks[0].type, 'section')
  let attempts = 0
  await assert.rejects(sendView(async () => { attempts++; throw { data: { error: 'ratelimited' } } }, { view }))
  assert.equal(attempts, 1)
})
