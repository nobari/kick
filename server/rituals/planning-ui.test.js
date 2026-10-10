const test = require('node:test')
const assert = require('node:assert/strict')
const { registerPlanning } = require('./planning-slack')
const { ui } = require('./slack')
const { monday, progress } = require('./planning')

function valid(view) {
  assert.ok(view.title.text.length <= 24)
  assert.ok(view.private_metadata.length <= 3000)
  assert.ok(view.blocks.length <= 100 && view.blocks.length > 0)
  function visit(n) {
    if (!n || typeof n !== 'object') return
    if (n.type === 'section') assert.ok(n.text.text.length > 0 && n.text.text.length <= 3000, `Section too long: ${n.text.text.length}`)
    if (n.type === 'actions') assert.ok(n.elements.length <= 5)
    if (n.type === 'button') { assert.ok(n.text.text.length <= 75); assert.ok(n.value.length <= 2000) }
    if (n.type === 'static_select') assert.ok(n.options.some(o => o.value === n.initial_option.value))
    Object.values(n).forEach(v => Array.isArray(v) ? v.forEach(visit) : visit(v))
  }
  visit(view)
}
test('planning forms fit Slack limits, escape markup, distinguish unknown capacity and block read-only edits', async () => {
  const c = { id: 'c'.repeat(64), name: '<'.repeat(80), channel: 'C1', retentionDays: 30 }
  const r = { id: 'r'.repeat(64), user: 'U1', owner: 'U2', title: '<'.repeat(150), detail: '<'.repeat(1500), rationale: '&'.repeat(1500), review: '2026-10-10', start: '2026-10-10', end: '2026-10-20', status: 'active', canEdit: true, version: 1, objective: 'o'.repeat(64), baseline: 10, current: 5, target: 0, unit: 'days', progress: 50 }
  const api = { access: async () => c, list: async () => Array(9).fill(r), record: async () => r,
    capacity: async () => ({ week: '2026-10-05', limit: null, version: 0 }),
    workload: async () => ({ week: '2026-10-05', end: '2026-10-11', people: [{ user: 'U1', tasks: 5, overdue: 2, limit: null }, { user: 'U2', tasks: 5, overdue: 2, limit: 0 }, ...Array(7).fill({ user: 'U3', tasks: 1, overdue: 0, limit: 5 })] }),
  }
  const { render } = registerPlanning({ app: { action() {}, view() {} }, ui })
  const ctx = { team: 'T1', user: 'U1', config: c.id }, data = { c: c.id, id: r.id, objective: r.objective, week: '2026-10-05', offset: 8 }
  for (const action of ['hub', 'workload', 'week', 'capacity', 'decisions', 'objectives', 'view_decisions', 'view_objectives', 'view_results', 'new_decisions', 'new_objectives', 'new_results', 'edit_decisions', 'edit_objectives', 'edit_results']) valid(await render(api, ctx, action, data))
  const workload = JSON.stringify(await render(api, ctx, 'workload', data))
  assert.match(workload, /capacity not set/); assert.match(workload, /5 over limit/)
  const first = await render(api, ctx, 'new_decisions', data), second = await render(api, ctx, 'new_decisions', data)
  assert.notEqual(JSON.parse(first.private_metadata).request, JSON.parse(second.private_metadata).request)
  r.canEdit = false
  assert.ok(!JSON.stringify(await render(api, ctx, 'view_decisions', data)).includes('plan_edit_decisions'))
  await assert.rejects(render(api, ctx, 'edit_decisions', data), /owner or creator/)
  await assert.rejects(render(api, ctx, 'new_results', data), /owner or creator/)
})
test('weeks cross year boundaries and progress handles reductions without changing source values', () => {
  assert.equal(monday('2027-01-01'), '2026-12-28')
  assert.equal(monday('2026-10-11'), '2026-10-05')
  assert.throws(() => monday('2026-02-30'))
  assert.equal(progress({ baseline: 10, current: 5, target: 0 }), 50)
  assert.equal(progress({ baseline: 0, current: -5, target: 10 }), 0)
  assert.equal(progress({ baseline: 0, current: 15, target: 10 }), 100)
})
