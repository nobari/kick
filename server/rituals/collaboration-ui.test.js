const test = require('node:test')
const assert = require('node:assert/strict')
const { registerCollaboration } = require('./collaboration-slack')
const { ui } = require('./slack')
const { deadline } = require('./domain')

function validView(view) {
  assert.equal(view.type, 'modal')
  assert.ok(view.title.text.length <= 24)
  assert.ok(view.private_metadata.length <= 3000)
  assert.ok(view.blocks.length > 0 && view.blocks.length <= 100)
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'button') { assert.ok(node.text.text.length <= 75); assert.ok(node.value.length <= 2000) }
    if (node.type === 'static_select') {
      assert.ok(node.options.length > 0 && node.options.length <= 100)
      node.options.forEach(o => { assert.ok(o.value.length > 0 && o.value.length <= 150); assert.ok(o.text.text.length <= 75) })
      assert.ok(node.options.some(o => o.value === node.initial_option.value))
    }
    if (node.type === 'section') assert.ok(node.text.text.length > 0 && node.text.text.length <= 3000)
    Object.values(node).forEach(v => Array.isArray(v) ? v.forEach(visit) : visit(v))
  }
  visit(view)
}

test('all collaboration Slack forms obey Block Kit limits and use independent operation IDs', async () => {
  const c = { id: 'c'.repeat(64), team: 'T1', channel: 'C1', name: 'Daily standup', owner: 'U1', retentionDays: 30, zone: 'UTC', time: '09:00', digestTime: '17:00', enabled: true, nextAt: Date.now() }
  const ctx = { config: c.id, team: 'T1', user: 'U1' }, r = { id: 'response', user: 'U1', answers: ['Done', 'Next'], version: 1 }
  const s = { id: 'sprint', title: 'October', goal: 'Ship', start: '2026-10-01', end: '2026-10-07', status: 'active' }
  const api = {
    access: async () => c,
    list: async (_ctx, kind) => kind === 'responses' ? [r] : kind === 'sprints' ? [s] : [],
    retroDetail: async () => ({ id: 'retro', title: 'Review', status: 'voting', user: 'U1', topics: [{ id: 'topic', user: 'U2', detail: 'Improve', category: 'Try', votes: 1 }] }),
    pokerDetail: async () => ({ id: 'poker', title: 'Estimate', user: 'U1', members: ['U1', 'U2'], round: 1, status: 'voting', votes: [{ user: 'U2' }] }),
    search: async () => [],
    operations: async () => ({ config: c, jobs: [], audit: [] }),
  }
  const handlers = {}, app = { action: (_p, fn) => { handlers.action = fn }, view: (_p, fn) => { handlers.view = fn } }
  const client = { auth: { test: async () => ({ ok: true }) } }
  const store = { get: async () => ({ questions: ['Done?', 'Next?'] }) }
  const { render } = registerCollaboration({ app, bolt: { shortcut() {} }, store, engine: {}, ui, canRemind: async () => true })
  const actions = ['hub', 'actions', 'sprints', 'retros', 'poker', 'new_action', 'new_sprint', 'sprint', 'close_sprint', 'new_retro', 'retro', 'retro_phase', 'new_topic', 'group', 'new_estimate', 'estimate', 'cast', 'poker_phase', 'decision', 'search', 'results', 'calendar', 'operations', 'retry', 'edit_update']
  for (const action of actions) {
    const data = { c: c.id, id: action === 'edit_update' ? 'response' : action === 'sprint' ? 'sprint' : 'item', filters: {}, round: 1 }
    const view = await render(api, ctx, action, data, client)
    validView(view)
  }
  const first = await render(api, ctx, 'new_action', { c: c.id }, client)
  const second = await render(api, ctx, 'new_action', { c: c.id }, client)
  assert.notEqual(JSON.parse(first.private_metadata).request, JSON.parse(second.private_metadata).request)
})

test('calendar deadline follows DST gaps and repeated hours', () => {
  assert.equal(deadline(Date.parse('2026-03-08T06:30Z'), 'America/New_York', '2026-03-08', '02:30'), Date.parse('2026-03-08T07:00Z'))
  assert.equal(deadline(Date.parse('2026-11-01T05:00Z'), 'America/New_York', '2026-11-01', '02:30'), Date.parse('2026-11-01T07:30Z'))
})
