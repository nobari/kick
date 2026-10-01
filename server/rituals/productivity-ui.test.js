const test = require('node:test')
const assert = require('node:assert/strict')
const { registerProductivity } = require('./productivity-slack')
const { ui } = require('./slack')

function validate(view) {
  assert.ok(view.title.text.length <= 24)
  assert.ok(view.private_metadata.length <= 3000)
  assert.ok(view.blocks.length > 0 && view.blocks.length <= 100)
  function visit(n) {
    if (!n || typeof n !== 'object') return
    if (n.type === 'section') assert.ok(n.text.text.length <= 3000)
    if (n.type === 'button') assert.ok(n.value.length <= 2000 && n.text.text.length <= 75)
    if (n.type === 'static_select') {
      assert.ok(n.options.length > 0 && n.options.length <= 100)
      n.options.forEach(o => assert.ok(o.value.length > 0 && o.value.length <= 150 && o.text.text.length <= 75))
    }
    Object.values(n).forEach(v => Array.isArray(v) ? v.forEach(visit) : visit(v))
  }
  visit(view)
}
test('productivity modals handle maximum content, navigation and explicit sharing', async () => {
  const c = { id: 'c'.repeat(64), name: 'Weekly', channel: 'C1' }, ctx = { team: 'T1', user: 'U1', config: c.id }
  const todo = { id: 't'.repeat(64), detail: '<'.repeat(1500), due: '2026-10-01', status: 'open', version: 1 }
  const poll = { id: 'p'.repeat(64), title: '<'.repeat(150), options: Array.from({ length: 10 }, (_, i) => `${i} ${'<'.repeat(70)}`), status: 'open', canClose: true, counts: Array(10).fill(1), myChoice: 3 }
  const api = { channel: async () => c, todos: async () => Array(9).fill(todo), todo: async () => todo, polls: async () => Array(9).fill(poll), pollDetail: async () => poll,
    report: async () => ({ c, from: '2026-10-01', to: '2026-10-01', generatedAt: Date.now(), lines: Array(8).fill('Total: 10'), note: 'Personal to-dos excluded.' }) }
  const { render } = registerProductivity({ app: { action() {}, view() {} }, store: {}, engine: {}, service: () => ({}), ui })
  for (const action of ['todos', 'new_todo', 'todo', 'delete_todo', 'polls', 'new_poll', 'poll', 'close_poll', 'report', 'report_result']) {
    const v = await render(api, ctx, action, { c: c.id, id: todo.id, offset: 8 })
    validate(v)
    if (action === 'report_result') assert.equal(v.submit.text, 'Share report')
    if (action === 'todo') assert.ok(v.blocks.some(b => b.block_id === 'status'))
  }
  const first = await render(api, ctx, 'new_todo', {}), second = await render(api, ctx, 'new_todo', {})
  assert.notEqual(JSON.parse(first.private_metadata).request, JSON.parse(second.private_metadata).request)
  poll.canClose = false
  const memberView = await render(api, ctx, 'poll', { c: c.id, id: poll.id })
  assert.ok(!JSON.stringify(memberView).includes('Close poll'))
  assert.equal(memberView.blocks.filter(b => b.type === 'section' && b.text.text.includes(': *1*')).length, 10)
  await assert.rejects(render(api, ctx, 'close_poll', { c: c.id, id: poll.id }), /creator/)
  poll.status = 'closed'
  assert.equal((await render(api, ctx, 'poll', { c: c.id, id: poll.id })).submit, undefined)
})

test('personal to-do entry never calls channel access, even without a workflow', async () => {
  const { render } = registerProductivity({ app: { action() {}, view() {} }, store: {}, engine: {}, service: () => ({}), ui })
  const api = { todos: async () => [], channel: async () => { throw new Error('Must not request channel access') } }
  const view = await render(api, { team: 'T1', user: 'U1' }, 'todos', {})
  assert.match(JSON.stringify(view), /Nothing here yet/)
  validate(view)
})
