// Secret-free shared source for Slack help, manifests and the public reference.
const commands = [
  { name: 'sync', description: 'Share an update or manage team check-ins', usage: 'help | home | setup | checkin | preferences | -r 7', legacy: true },
  { name: 'pick', description: 'Choose teammates randomly or rotate fairly', usage: 'help | rotate', legacy: true },
  { name: 'kudos', description: 'Thank teammates for their contributions', usage: 'help | -r 7', legacy: true },
  { name: 'coins', description: 'Give virtual recognition points, not money', usage: 'help | -r 7', legacy: true },
  { name: 'todo', description: 'Manage private personal or shared channel tasks', usage: 'mine | new | channel | help' },
  { name: 'poll', description: 'Create channel polls and view votes and results', usage: 'create | results | help' },
  { name: 'report', description: 'Preview a comprehensive workflow report', usage: 'week | month | custom | help' },
  { name: 'plan', description: 'View workload, capacity, goals and issue sync', usage: 'workload | capacity | goals | sync | help' },
  { name: 'decision', description: 'Record proposals and find team decisions', usage: 'new | list | help' },
  { name: 'handoff', description: 'Agree on handoffs between teams', usage: 'new | incoming | list | help' },
  { name: 'approve', description: 'Request a decision or review pending requests', usage: 'request | pending | list | help' },
  { name: 'onboard', description: 'Manage onboarding checklists and buddies', usage: 'new | active | list | help' },
  { name: 'oneonone', description: 'Prepare private agendas and follow-up actions', usage: 'new | upcoming | list | help' },
  { name: 'leave', description: 'Request leave and view approved team coverage', usage: 'request | mine | coverage | help' },
]
const route = (tool, action, data = {}) => ({ tool, action, data })
const routes = {
  todo: { '': route('work', 'todos'), mine: route('work', 'todos'), new: route('work', 'new_todo'), channel: route('collab', 'actions') },
  poll: { '': route('work', 'polls'), create: route('work', 'new_poll'), results: route('work', 'polls') },
  report: { '': route('work', 'report'), week: route('work', 'report', { days: 7 }), month: route('work', 'report', { days: 30 }), custom: route('work', 'report') },
  plan: { '': route('plan', 'hub'), workload: route('plan', 'workload'), capacity: route('plan', 'capacity'), goals: route('plan', 'objectives'), sync: route('integ', 'hub') },
  decision: { '': route('plan', 'decisions'), new: route('plan', 'new_decisions'), list: route('plan', 'decisions') },
  handoff: { '': route('coord', 'list', { kind: 'handoffs' }), new: route('coord', 'new', { kind: 'handoffs' }), incoming: route('coord', 'list', { kind: 'handoffs', filter: 'incoming' }), list: route('coord', 'list', { kind: 'handoffs' }) },
  approve: { '': route('coord', 'list', { kind: 'approvals' }), request: route('coord', 'new', { kind: 'approvals' }), pending: route('coord', 'list', { kind: 'approvals', filter: 'pending' }), list: route('coord', 'list', { kind: 'approvals' }) },
  onboard: { '': route('coord', 'list', { kind: 'onboarding' }), new: route('coord', 'new', { kind: 'onboarding' }), active: route('coord', 'list', { kind: 'onboarding', filter: 'active' }), list: route('coord', 'list', { kind: 'onboarding' }) },
  oneonone: { '': route('coord', 'list', { kind: 'meetings' }), new: route('coord', 'new', { kind: 'meetings' }), upcoming: route('coord', 'list', { kind: 'meetings', filter: 'upcoming' }), list: route('coord', 'list', { kind: 'meetings' }) },
  leave: { '': route('coord', 'list', { kind: 'leaves', filter: 'mine' }), request: route('coord', 'new', { kind: 'leaves' }), mine: route('coord', 'list', { kind: 'leaves', filter: 'mine' }), coverage: route('coord', 'coverage') },
}
function parseCommand(command, value = '', test = false) {
  const prefix = test ? '/t' : '/'
  if (typeof command !== 'string' || !command.startsWith(prefix)) return null
  const name = command.slice(prefix.length), entry = commands.find(c => c.name === name)
  if (!entry) return null
  const sub = String(value).trim().toLowerCase()
  if (['help', '-h', '--help'].includes(sub)) return { name, help: true }
  if (entry.legacy) return null // Existing arguments and behavior remain intact.
  if (!Object.hasOwn(routes[name], sub)) return { name, help: true, invalid: true }
  return { name, ...routes[name][sub] }
}
module.exports = { commands, routes, parseCommand }
