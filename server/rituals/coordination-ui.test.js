const test = require('node:test')
const assert = require('node:assert/strict')
const { registerCoordination } = require('./coordination-slack')
const { registerIntegrations } = require('../integrations/slack')
const { ui } = require('./slack')
function valid(view) {
  assert.ok(view.title.text.length <= 24, view.title.text)
  assert.ok(view.private_metadata.length <= 3000)
  assert.ok(view.blocks.length <= 100)
  function walk(n) {
    if (!n || typeof n !== 'object') return
    if (n.type === 'section') assert.ok(n.text.text.length > 0 && n.text.text.length <= 3000)
    if (n.type === 'actions') assert.ok(n.elements.length <= 5)
    if (n.type === 'static_select') { assert.ok(n.options.length > 0 && n.options.length <= 100); assert.ok(n.initial_option) }
    if (n.type === 'button') { assert.ok(n.value.length <= 2000); assert.ok(n.text.text.length <= 75) }
    Object.values(n).forEach(v => Array.isArray(v) ? v.forEach(walk) : walk(v))
  }
  walk(view)
}
test('coordination modals fit Slack limits with escaped maximum-size content and pagination', async () => {
  const c = { id: 'c'.repeat(64), name: '<'.repeat(80), channel: 'C1', owner: 'U1', retentionDays: 30 }
  const r = { id: 'r'.repeat(64), config: c.id, user: 'U1', owner: 'U2', buddy: 'U3', title: '<'.repeat(150), detail: '&'.repeat(1500), decision: '<'.repeat(1500), status: 'active', due: '2026-10-20', version: 1, cover: 'U3', start: '2026-10-20', end: '2026-10-21' }
  const api = { access: async () => c, row: async () => r, list: async () => Array(9).fill(r), coverage: async () => Array(51).fill(r), escalation: async () => ({ days: 2, enabled: false, version: 0 }) }
  const { render } = registerCoordination({ app: { action() {}, view() {} }, ui })
  const ctx = { team: 'T1', user: 'U1', config: c.id }
  for (const action of ['hub','coverage','escalation']) valid(await render(api, ctx, action))
  for (const kind of ['approvals','leaves','onboarding','meetings','handoffs','steps','notes']) {
    const d = { c: c.id, kind, id: r.id, parent: r.id, offset: 8, status: 'done' }
    for (const action of ['list','new','view','confirm']) valid(await render(api, ctx, action, d))
    valid(await render(api, ctx, 'new', { ...d, target: 't'.repeat(64) }))
  }
})
test('issue sync screens distinguish explicit sharing, conflicts, direction, and credential deletion', async () => {
  const c = { id: 'c'.repeat(64), name: 'Team', channel: 'C1' }
  const snapshot = { version: 1, local: 'done', remote: 'open', revision: '2026-10-10' }
  const r = { issue: { id: '1', title: '<'.repeat(1000), done: false, status: 'open', revision: snapshot.revision, states: [{ id: 'closed', label: 'Closed' }] }, provider: 'github', action: { status: 'done' }, snapshot, conflict: true }
  const api = { allowed: async () => c, list: async (_ctx, kind) => kind === 'connections' ? [{ id: 'conn', provider: 'github' }] : kind === 'mappings' ? [{ id: 'map', connection: 'conn', label: 'repo' }] : Array(9).fill({ id: 'link', remote: '42', localStatus: 'done', syncedAt: 0 }),
    roots: async () => [{ id: 'root', label: 'Org' }], containers: async () => [{ id: 'repo', label: 'Repo' }], ticket: async () => 'https://kick.bozmoz.com/api/integrations/github/start?ticket=example', preview: async () => r, inspect: async () => r }
  const { render } = registerIntegrations({ app: { action() {}, view() {} }, ui })
  const ctx = { team: 'T1', user: 'U1', config: c.id }, data = { c: c.id, id: 'link', connection: 'conn', root: 'root', mapping: 'map', provider: 'github', snapshot, offset: 8, kind: 'connections' }
  for (const action of ['hub','connect','roots','containers','import','preview','links','inspect','pull','push','remove']) valid(await render(api, ctx, action, data))
  assert.match(JSON.stringify(await render(api, ctx, 'inspect', data)), /Both sides changed/)
})
