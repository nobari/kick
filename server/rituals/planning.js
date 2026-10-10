const { key } = require('./store')
const { DAY, localTime } = require('./domain')
const { date } = require('./collaboration')

function required(value, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Enter between 1 and ${max} characters.`)
  return value.trim()
}
function page(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) throw new Error('Reopen this list.')
  return value
}
function number(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new Error('Enter a number.')
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw new Error('Enter a finite number between −1 billion and 1 billion.')
  return n
}
function monday(value) {
  const d = new Date(date(value)), weekday = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (weekday + 6) % 7)
  return d.toISOString().slice(0, 10)
}
const plusDays = (value, days) => new Date(Date.parse(value) + days * DAY).toISOString().slice(0, 10)
const progress = r => Math.max(0, Math.min(100, Math.round(100 * (r.current - r.baseline) / (r.target - r.baseline))))

function createPlanning(store, { access, authorize, clock = Date.now }) {
  const life = c => ({ team: c.team, config: c.id, at: clock(), expiresAt: clock() + c.retentionDays * DAY })
  async function row(tx, kind, id, c) {
    const r = await tx.get(kind, id)
    if (!r || r.team !== c.team || r.config !== c.id || r.expiresAt <= clock()) throw new Error('Planning record unavailable or expired.')
    return r
  }
  function version(old, data) {
    if (old && old.version !== data.version) throw new Error('This record changed. Reopen it before editing.')
  }
  function editable(r, c, user) {
    if (![r.user, r.owner, c.owner].includes(user)) throw new Error('Only the creator, assigned owner or workflow owner can edit this record.')
  }
  function withinRetention(c, value, expiry = clock() + c.retentionDays * DAY) {
    date(value)
    if (Date.parse(value) >= expiry) throw new Error('Choose a date before this record expires. Editing does not extend retention.')
  }
  async function record(ctx, kind, id) {
    if (!['decisions', 'objectives', 'results'].includes(kind)) throw new Error('Unknown planning tool.')
    const c = await access(ctx), r = await row(store, kind, id, c)
    const parent = kind === 'results' ? await row(store, 'objectives', r.objective, c) : null
    return { ...r, canEdit: [r.user, r.owner, c.owner].includes(ctx.user) && (!parent || parent.status === 'active'), ...(kind === 'results' ? { progress: progress(r) } : {}) }
  }
  async function list(ctx, kind, offset = 0, objective) {
    const c = await access(ctx)
    if (kind === 'results') await row(store, 'objectives', objective, c)
    return store.planningPage(kind, c.team, c.id, clock(), page(offset), objective)
  }
  async function audit(tx, c, ctx, kind, id, request) {
    await tx.create('audit', key(c.id, kind, id, request), { ...life(c), user: ctx.user, event: `${kind}_saved`, target: id, detail: 'Planning record saved; content is available in Team planning.' })
  }
  async function save(ctx, kind, data, request) {
    if (!['decisions', 'objectives', 'results'].includes(kind)) throw new Error('Unknown planning tool.')
    required(request, 100)
    const c = await access(ctx), title = required(data.title), owner = required(data.owner, 80)
    await authorize(c, owner)
    // One workflow lock orders parent/child edits and makes Slack retries safe.
    return store.locked(c.id, async tx => {
      const id = data.id || key(c.id, kind, ctx.user, request)
      const old = data.id ? await row(tx, kind, id, c) : await tx.get(kind, id)
      if (old && !data.id) return id
      if (old) editable(old, c, ctx.user)
      const receipt = key(c.id, kind, id, request)
      if (await tx.get('audit', receipt)) return id
      version(old, data)
      let fields, parent
      if (kind === 'decisions') {
        const status = data.status || 'proposed'
        if (!['proposed', 'accepted', 'superseded'].includes(status)) throw new Error('Choose a valid decision status.')
        withinRetention(c, data.review, old?.expiresAt)
        fields = { detail: required(data.detail, 1500), rationale: required(data.rationale, 1500), review: data.review, status }
      } else if (kind === 'objectives') {
        const start = date(data.start), end = date(data.end), status = data.status || 'active'
        if (start > end) throw new Error('End date must follow the start date.')
        withinRetention(c, end, old?.expiresAt)
        if (!['active', 'closed'].includes(status)) throw new Error('Choose Active or Closed.')
        fields = { start, end, status }
      } else {
        const objective = old?.objective || data.objective
        parent = await row(tx, 'objectives', objective, c)
        if (parent.status !== 'active') throw new Error('Reopen the objective before changing its key results.')
        if (!old) editable(parent, c, ctx.user)
        const baseline = number(data.baseline), current = number(data.current), target = number(data.target)
        if (baseline === target) throw new Error('Target must differ from baseline. Lower targets are supported.')
        fields = { objective, baseline, current, target, unit: required(data.unit, 40) }
      }
      await tx.set(kind, id, { ...(old || life(c)), user: old?.user || ctx.user, owner, title, ...fields,
        version: (old?.version || 0) + 1, expiresAt: Math.min(old?.expiresAt || clock() + c.retentionDays * DAY, parent?.expiresAt || Infinity) })
      await audit(tx, c, ctx, kind, id, request)
      return id
    })
  }
  async function capacity(ctx, selected) {
    const c = await access(ctx), week = monday(selected)
    const r = await store.get('capacity', key(c.id, ctx.user, week))
    return r && r.team === c.team && r.config === c.id && r.user === ctx.user && r.expiresAt > clock() ? r : { week, limit: null, version: 0 }
  }
  async function saveCapacity(ctx, data, request) {
    required(request, 100)
    const c = await access(ctx), week = monday(data.week), limit = number(data.limit)
    if (!Number.isInteger(limit) || limit < 0 || limit > 1000) throw new Error('Choose a whole task limit from 0 to 1000.')
    if (week < monday(localTime(clock(), c.zone).date)) throw new Error('Choose this week or a future week.')
    withinRetention(c, plusDays(week, 6))
    const id = key(c.id, ctx.user, week)
    return store.locked(c.id, async tx => {
      const stored = await tx.get('capacity', id), old = stored?.expiresAt > clock() ? stored : null
      if (old && (old.team !== c.team || old.user !== ctx.user)) throw new Error('Capacity unavailable.')
      if (await tx.get('audit', key(c.id, 'capacity', id, request))) return id
      if ((old?.version || 0) !== data.version) throw new Error('Your capacity changed. Reopen it before editing.')
      withinRetention(c, plusDays(week, 6), old?.expiresAt)
      await tx.set('capacity', id, { ...(old || life(c)), user: ctx.user, week, limit, version: (old?.version || 0) + 1 })
      await audit(tx, c, ctx, 'capacity', id, request)
      return id
    })
  }
  async function workload(ctx, selected, offset = 0) {
    const c = await access(ctx), today = localTime(clock(), c.zone).date, week = monday(selected || today)
    const people = await store.workload(c.team, c.id, clock(), week, plusDays(week, 7), today, c.members, page(offset))
    return { c, week, end: plusDays(week, 6), people }
  }
  return { access, record, list, save, capacity, saveCapacity, workload }
}
module.exports = { createPlanning, monday, plusDays, progress }
