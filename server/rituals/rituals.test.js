const test = require('node:test')
const assert = require('node:assert/strict')
const { DAY, TEMPLATES, localTime, validateConfig, mayRemind, nextInRotation, insights, escape } = require('./domain')
const { createEngine } = require('./engine')
const { key } = require('./store')
const { registerRituals } = require('./slack')

function fixture() {
  let now = Date.parse('2026-09-09T01:00:00Z') // Wednesday 10am Tokyo
  const rows = new Map(), sent = [], opened = []
  const store = {
    key,
    async get(k, id) { return rows.get(`${k}/${id}`) || null },
    async set(k, id, data) { rows.set(`${k}/${id}`, { ...await this.get(k, id), ...structuredClone(data), id }) },
    async create(k, id, data) { if (await this.get(k, id)) return false; await this.set(k, id, data); return true },
    async list(k, field, op, value, limit = 10000) {
      return [...rows].filter(([id, d]) => id.startsWith(`${k}/`) && (op === '==' ? d[field] === value : op === '<=' ? d[field] <= value : d[field] < value)).map(([, d]) => d).slice(0, limit)
    },
    async mutate(k, id, fn) { const value = fn(await this.get(k, id)); if (value) await this.set(k, id, value); return value },
    async claim(k, id, time) { const d = await this.get(k, id); if (!d || d.done || d.leaseUntil > time) return null; await this.set(k, id, { leaseUntil: time + 120000 }); return 'owner' },
    async finish(k, id, owner, data) { await this.set(k, id, data); return true },
    async submit(id, response, blocker) { if (!await this.create('responses', id, response)) return false; if (blocker) await this.create('blockers', id, blocker); return true },
    async cleanup(time) { for (const [id, d] of rows) if (d.expiresAt <= time) rows.delete(id) }
  }
  const client = {
    conversations: { open: async args => { opened.push(args); return { channel: { id: 'D123' } } },
      info: async () => ({ channel: { is_private: false } }), members: async () => ({ members: ['U1', 'U2', 'U3'], response_metadata: {} }) },
    users: { info: async () => ({ user: { is_admin: false } }) },
    chat: { postMessage: async args => { sent.push(args); return { ts: '123' } } },
    views: { publish: async () => {}, open: async () => ({ view: { id: 'V1' } }), update: async () => ({}) }
  }
  const engine = createEngine(store, async () => client, () => now)
  const c = { id: engine.configId('T1', 'C1'), team: 'T1', channel: 'C1', owner: 'U1', enabled: true,
    zone: 'Asia/Tokyo', time: '09:00', digestTime: '17:00', days: [1, 2, 3, 4, 5], members: ['U1', 'U2', 'U3'],
    questions: TEMPLATES.standup, template: 'standup', retentionDays: 30, roundup: true, nextAt: now }
  return { store, engine, c, sent, opened, client, rows, now: () => now, advance: ms => { now += ms }, setNow: value => { now = Date.parse(value) } }
}

test('time zones track calendar days and DST transitions', () => {
  assert.equal(localTime(Date.parse('2026-09-09T16:00Z'), 'Asia/Tokyo').date, '2026-09-10')
  assert.equal(localTime(Date.parse('2026-03-08T06:30Z'), 'America/New_York').time, '01:30')
  assert.equal(localTime(Date.parse('2026-03-08T07:30Z'), 'America/New_York').time, '03:30')
})
test('configuration rejects invalid zones, times, days, questions and retention', () => {
  const { c } = fixture()
  assert.equal(validateConfig(c), c)
  for (const change of [{ zone: 'Tokyo' }, { time: '25:00' }, { digestTime: '08:00' }, { days: [] }, { members: [] }, { questions: [] }, { retentionDays: 0 }])
    assert.throws(() => validateConfig({ ...c, ...change }))
})
test('quiet hours, disabled reminders, leave and snooze are honored', () => {
  const { now } = fixture()
  assert.equal(mayRemind({}, now(), 'Asia/Tokyo'), true)
  for (const p of [{ disabled: true }, { snoozeUntil: now() + 1000 }, { leaveUntil: '2026-09-09' }, { quietStart: '09:00', quietEnd: '12:00' }])
    assert.equal(mayRemind(p, now(), 'Asia/Tokyo'), false)
  assert.equal(mayRemind({}, Date.parse('2026-09-09T12:00Z'), 'Asia/Tokyo'), false)
  assert.equal(mayRemind({ quietStart: '10:00', quietEnd: '10:00' }, now(), 'Asia/Tokyo'), true)
})
test('rotation is deterministic, excludes users, and favors least recent', () => {
  assert.equal(nextInRotation(['U1', 'U2', 'U3'], ['U1', 'U2']), 'U3')
  assert.equal(nextInRotation(['U1', 'U2', 'U3'], ['U1', 'U2'], ['U3']), 'U1')
  assert.throws(() => nextInRotation(['U1'], [], ['U1']))
})
test('team insights have no individual scores and handle an empty period', () => {
  const { now } = fixture()
  const result = insights([{ id: 'R', members: ['U1', 'U2'], at: now() - 1000 }], [{ run: 'R', user: 'U1' }], [{ at: now() - 1000, resolvedAt: now() }], now())
  assert.equal(result[0].participation, 50)
  assert.equal(result[0].resolved, 1)
  assert.equal(result[1].participation, null)
  assert.ok(!JSON.stringify(result).includes('U1'))
})
test('user text cannot inject Slack mentions', () => assert.equal(escape('<!channel> & <@U1>'), '&lt;!channel&gt; &amp; &lt;@U1&gt;'))
test('repeated schedule ticks produce one prompt', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.tick(); f.advance(6 * 60000); await f.engine.tick()
  assert.equal(f.sent.length, 1)
})
test('schedule does not run on an excluded weekday or when paused', async () => {
  const f = fixture(); f.c.days = [5]
  assert.equal(await f.engine.currentRun(f.c), null)
  f.c.days = [3]; f.c.enabled = false
  assert.equal(await f.engine.currentRun(f.c), null)
})
test('leave excludes participants from new runs', async () => {
  const f = fixture(); await f.store.set('prefs', key('T1', 'U2'), { leaveUntil: '2026-09-09' })
  assert.deepEqual((await f.engine.currentRun(f.c)).members, ['U1', 'U3'])
})
test('check-in submission and blocker creation are idempotent', async () => {
  const f = fixture()
  const id = await f.engine.submit(f.c, 'U1', ['Done', 'Next'], 'Need access', 'U2')
  await f.engine.submit(f.c, 'U1', ['Duplicate', 'Next'], 'Other', 'U3')
  assert.equal((await f.store.get('responses', id)).answers[0], 'Done')
  assert.equal((await f.store.get('blockers', id)).helper, 'U2')
  await assert.rejects(f.engine.submit(f.c, 'outsider', ['A', 'B']))
})
test('closed check-ins reject submissions', async () => {
  const f = fixture(); f.setNow('2026-09-09T09:00Z')
  await assert.rejects(f.engine.submit(f.c, 'U1', ['A', 'B']))
})
test('custom questions are snapshotted for an open run', async () => {
  const f = fixture(); f.c.questions = ['Your weekly win?']
  const run = await f.engine.currentRun(f.c)
  f.c.questions = ['Changed?', 'New?']
  await f.engine.submit(f.c, 'U1', ['Shipped it'])
  assert.deepEqual((await f.store.get('runs', run.id)).questions, ['Your weekly win?'])
})
test('reminders target nonrespondents only, once per run', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.tick(); await f.engine.submit(f.c, 'U1', ['A', 'B'])
  f.advance(3600000); await f.engine.tick(); f.advance(6 * 60000); await f.engine.tick()
  assert.deepEqual(f.opened.map(x => x.users).sort(), ['U2', 'U3'])
})
test('a queued reminder is suppressed after a response arrives', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const run = await f.engine.currentRun(f.c)
  await f.engine.submit(f.c, 'U1', ['A', 'B'])
  const status = await f.engine.deliver({ config: f.c.id, kind: 'reminder', run: run.id, user: 'U1', expiresAt: f.now() + DAY })
  assert.equal(status, 'skipped'); assert.equal(f.sent.length, 0)
})
test('digest includes answers, pending participants and blockers', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.tick(); await f.engine.submit(f.c, 'U1', ['Shipped', 'Testing'], 'Access needed', 'U2')
  f.setNow('2026-09-09T08:00Z'); await f.engine.tick()
  const digest = f.sent.find(x => x.text.startsWith('Team digest'))
  assert.ok(digest); assert.match(JSON.stringify(digest.blocks), /Shipped/); assert.match(JSON.stringify(digest.blocks), /U2/)
})
test('digest catches up after a missed evening invocation', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.tick(); f.setNow('2026-09-10T00:00Z'); await f.engine.tick()
  assert.ok(f.sent.some(x => x.text.startsWith('Team digest · 2026-09-09')))
})
test('recognition roundups are opt-in and workspace scoped', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.recognize('T1', 'C1', 'U1', 'U2', 'Great debugging', '123')
  await f.engine.recognize('T2', 'C1', 'U1', 'U2', 'Other workspace', '124')
  f.setNow('2026-09-11T08:00Z'); await f.engine.tick()
  assert.equal(f.sent.length, 1)
  assert.match(JSON.stringify(f.sent[0]), /Great debugging/)
  assert.ok(!JSON.stringify(f.sent).includes('Other workspace'))
})
test('resolved blockers do not produce follow-up messages', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const id = await f.engine.submit(f.c, 'U1', ['A', 'B'], 'Stuck', 'U2')
  await f.store.set('blockers', id, { resolvedAt: f.now() })
  f.advance(DAY); await f.engine.tick()
  assert.ok(!f.sent.some(x => x.text.includes('Can you help')))
})
test('unresolved blockers send a weekday helper follow-up', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.submit(f.c, 'U1', ['A', 'B'], 'Stuck', 'U2')
  f.advance(DAY); await f.engine.tick()
  assert.ok(f.sent.some(x => x.text.includes('Can you help')))
})
test('failed delivery retries with stable client ID and backoff', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const original = f.client.chat.postMessage
  f.client.chat.postMessage = async () => { throw { data: { error: 'ratelimited' }, retryAfter: 120 } }
  await f.engine.tick()
  const [job] = await f.store.list('jobs', 'config', '==', f.c.id)
  assert.equal(job.attempts, 1); assert.ok(job.dueAt >= f.now() + 120000)
  f.client.chat.postMessage = original; f.advance(180000); await f.engine.tick()
  assert.equal(f.sent[0].client_msg_id, job.clientId)
})
test('leased jobs are not sent by overlapping invocations', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.tickConfig(f.c)
  const [job] = await f.store.list('jobs', 'config', '==', f.c.id)
  await f.store.claim('jobs', job.id, f.now()); await f.engine.tick()
  assert.equal(f.sent.length, 0)
})
test('old rotation request retries do not advance the rotation again', async () => {
  const f = fixture()
  assert.equal(await f.engine.rotate(f.c, [], 'Review', 'request1'), 'U1')
  assert.equal(await f.engine.rotate(f.c, [], 'Review', 'request2'), 'U2')
  assert.equal(await f.engine.rotate(f.c, [], 'Review', 'request1'), 'U1')
  assert.equal(await f.engine.rotate(f.c, [], 'Review', 'request3'), 'U3')
})
test('rotation excludes participants who have left the channel', async () => {
  const f = fixture()
  f.client.conversations.members = async () => ({ members: ['U2', 'U3'] })
  assert.equal(await f.engine.rotate(f.c, [], 'Review', 'request1'), 'U2')
})
test('private jobs are suppressed when DM permissions are not activated', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const engine = createEngine(f.store, async () => f.client, f.now, { dmEnabled: false })
  await engine.tick(); f.advance(65 * 60000); await engine.tick()
  assert.equal(f.opened.length, 0)
  assert.equal(f.sent.length, 1)
})
test('expired records are omitted from dashboard datasets and removed by cleanup', async () => {
  const f = fixture(); await f.engine.submit(f.c, 'U1', ['A', 'B'])
  f.advance(31 * DAY)
  assert.equal((await f.engine.dataset(f.c)).responses.length, 0)
  await f.store.cleanup(f.now()); assert.equal(f.rows.size, 0)
})
test('App Home does not reveal channel data to nonmembers', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.submit(f.c, 'U1', ['Sensitive team update', 'Next'])
  let published
  f.client.views.publish = async data => { published = data }
  const bolt = { use() {}, action() {}, view() {}, event() {} }
  const ui = registerRituals(bolt, f.store, f.engine)
  await ui.home(f.client, 'T1', 'outsider')
  assert.ok(!JSON.stringify(published).includes('Sensitive team update'))
  assert.ok(JSON.stringify(published).includes('Welcome!'))
})

test('legacy standups count toward scheduled completion without changing custom templates', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.recordLegacy('T1', 'C1', 'U1', { l: 'Yesterday', t: 'Today', b: 'none' })
  assert.equal((await f.engine.dataset(f.c)).responses.length, 1)
  assert.equal((await f.engine.dataset(f.c)).blockers.length, 0)
  await f.store.set('configs', f.c.id, { template: 'retro' })
  await f.engine.recordLegacy('T1', 'C1', 'U2', { l: 'A', t: 'B' })
  assert.equal((await f.engine.dataset(f.c)).responses.length, 1)
})
test('a helper who left the channel does not receive its blockers', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const id = await f.engine.submit(f.c, 'U1', ['A', 'B'], 'Sensitive', 'U2')
  f.client.conversations.members = async () => ({ members: ['U1', 'U3'] })
  const result = await f.engine.deliver({ config: f.c.id, kind: 'followup', blocker: id, user: 'U2', expiresAt: f.now() + DAY })
  assert.equal(result, 'skipped'); assert.equal(f.opened.length, 0)
})

async function withUI(fn) {
  const f = fixture(), handlers = {}, pending = [], updates = [], acks = []
  const symbol = Symbol.for('@vercel/request-context'), previous = globalThis[symbol]
  globalThis[symbol] = { get: () => ({ waitUntil: p => pending.push(p) }) }
  f.client.views.update = async value => { updates.push(value.view); return { view: { id: 'V1' } } }
  const bolt = Object.fromEntries(['action', 'view', 'event'].map(k => [k, (pattern, fn) => { handlers[k] = fn }]))
  bolt.use = fn => { handlers.use = fn }
  registerRituals(bolt, f.store, f.engine, { schedulerEnabled: true, dmEnabled: true })
  const invoke = async (kind, args) => {
    await handlers[kind]({ ack: async value => { acks.push(value) }, client: f.client, ...args })
    await Promise.all(pending.splice(0))
  }
  try { await fn({ ...f, invoke, updates, acks }) } finally { globalThis[symbol] = previous }
}
const values = object => Object.fromEntries(Object.entries(object).map(([id, v]) => [id, { value: typeof v === 'string' ? { value: v } : v }]))
test('setup opens a loading modal before fetching settings and starts paused', async () => withUI(async f => {
  await f.invoke('use', { body: { command: '/sync', text: 'setup', team_id: 'T1', channel_id: 'C1', user_id: 'U1', trigger_id: 'trigger' } })
  assert.equal(f.acks.length, 1)
  assert.equal(f.updates[0].callback_id, 'ritual_setup_save')
  assert.equal(f.updates[0].blocks.find(b => b.block_id === 'enabled').element.initial_option.value, 'no')
}))
test('setup preview saves no active schedule until confirmed', async () => withUI(async f => {
  const view = { id: 'V1', callback_id: 'ritual_setup_save', private_metadata: 'C1', blocks: [], state: { values: values({
    zone: 'Asia/Tokyo', time: '09:00', digest: '17:00', enabled: 'yes', days: { selected_options: [{ value: '3' }] },
    members: { selected_users: ['U1', 'U2'] }, template: 'wins', roundup: 'yes', retention: '30'
  }) } }
  await f.invoke('view', { body: { team: { id: 'T1' }, user: { id: 'U1' } }, view })
  assert.equal(f.acks[0].view.callback_id, 'ritual_loading')
  const preview = f.updates.at(-1)
  assert.equal(preview.callback_id, 'ritual_confirm_save')
  assert.equal(await f.engine.config('T1', 'C1'), null)
  await f.invoke('view', { body: { team: { id: 'T1' }, user: { id: 'U1' } }, view: { id: 'V1', callback_id: 'ritual_confirm_save', private_metadata: preview.private_metadata, blocks: [], state: { values: {} } } })
  assert.equal((await f.engine.config('T1', 'C1')).enabled, true)
  assert.deepEqual((await f.engine.config('T1', 'C1')).questions, TEMPLATES.wins)
}))
test('non-owner members cannot edit a configured workflow', async () => withUI(async f => {
  await f.store.set('configs', f.c.id, f.c)
  await f.invoke('action', { body: { team: { id: 'T1' }, user: { id: 'U2' }, trigger_id: 'trigger' }, action: { action_id: 'ritual_setup', value: 'C1' } })
  assert.match(JSON.stringify(f.updates.at(-1)), /Only the workflow owner/)
}))
test('forged cross-workspace blocker IDs cannot be read or modified', async () => withUI(async f => {
  await f.store.set('configs', f.c.id, f.c)
  const id = await f.engine.submit(f.c, 'U1', ['A', 'B'], 'Private blocker', 'U2')
  await f.invoke('action', { body: { team: { id: 'T2' }, user: { id: 'U1' }, trigger_id: 'trigger' }, action: { action_id: 'ritual_blocker', value: id } })
  assert.ok(!JSON.stringify(f.updates).includes('Private blocker'))
  assert.match(JSON.stringify(f.updates), /no longer available/)
}))
test('preferences save user-local settings without altering another user', async () => withUI(async f => {
  await f.invoke('view', { body: { team: { id: 'T1' }, user: { id: 'U1' } }, view: { id: 'V1', callback_id: 'ritual_preferences_save', private_metadata: '', blocks: [], state: { values: values({ zone: 'America/New_York', start: '18:00', end: '09:00', disabled: 'yes', leave: { selected_date: '2026-09-15' } }) } } })
  assert.equal((await f.store.get('prefs', key('T1', 'U1'))).disabled, true)
  assert.equal(await f.store.get('prefs', key('T1', 'U2')), null)
}))
test('legacy commands and unknown options pass through middleware', async () => withUI(async f => {
  let passed = 0
  await f.invoke('use', { body: { command: '/sync', text: '-r 7' }, next: async () => { passed++ } })
  assert.equal(passed, 1); assert.equal(f.acks.length, 0)
}))

test('reminders are suppressed when this installation has not consented, even when globally enabled', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  const engine = createEngine(f.store, async () => f.client, f.now, { dmEnabled: true, canRemind: async () => false })
  const run = await engine.currentRun(f.c)
  assert.equal(await engine.deliver({ config: f.c.id, kind: 'reminder', run: run.id, user: 'U1', expiresAt: f.now() + DAY }), 'skipped')
  assert.equal(f.opened.length, 0)
})
test('digest fallback text includes the answers for screen-reader users', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  await f.engine.submit(f.c, 'U1', ['Accessible answer', 'Next step'])
  f.setNow('2026-09-09T08:00Z'); await f.engine.tick()
  assert.match(f.sent.find(m => m.text.startsWith('Team digest')).text, /Accessible answer/)
})
test('Home names channels, separates views, and handles empty trends without invalid percentages', async () => {
  const f = fixture(); await f.store.set('configs', f.c.id, f.c)
  let published
  f.client.conversations.info = async () => ({ channel: { name: 'team-check-in', is_private: false } })
  f.client.views.publish = async args => { published = args }
  const ui = registerRituals({ use() {}, action() {}, view() {}, event() {} }, f.store, f.engine)
  await ui.home(f.client, 'T1', 'U2', 'C1', 'trends')
  const serialized = JSON.stringify(published)
  assert.match(serialized, /#team-check-in/)
  assert.match(serialized, /No sessions/)
  assert.doesNotMatch(serialized, /—%|Channel settings/)
  assert.ok(published.view.blocks.length <= 100)
})
test('setup uses native time controls and preserves their submitted values', async () => withUI(async f => {
  await f.invoke('use', { body: { command: '/sync', text: 'setup', team_id: 'T1', channel_id: 'C1', user_id: 'U1', trigger_id: 'trigger' } })
  assert.equal(f.updates[0].blocks.find(b => b.block_id === 'time').element.type, 'timepicker')
  const { read } = require('./slack')
  assert.equal(read({ state: { values: values({ time: { selected_time: '09:30' } }) } }, 'time'), '09:30')
}))
test('editing a setup preview reuses the modal rather than opening another stack', async () => withUI(async f => {
  const id = 'draft-review'; await f.store.set('drafts', id, { ...f.c, editor: 'U1', expiresAt: Date.now() + 60000 })
  f.client.views.open = async () => { throw new Error('Must reuse the existing modal') }
  await f.invoke('action', { body: { team: { id: 'T1' }, user: { id: 'U1' }, trigger_id: 'trigger', view: { type: 'modal', id: 'V1' } }, action: { action_id: 'ritual_edit_draft', value: id } })
  assert.equal(f.updates.at(-1).callback_id, 'ritual_setup_save')
}))
