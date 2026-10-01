const { key } = require('./store')
const { DAY, escape } = require('./domain')

function required(value, max = 1500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Enter between 1 and ${max} characters.`)
  return value.trim()
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.')
  return value
}
function page(value = 0) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000) throw new Error('Reopen the list.')
  return value
}
function createProductivity(store, engine, { access, clock = Date.now }) {
  const life = c => ({ team: c.team, config: c.id, at: clock(), expiresAt: clock() + c.retentionDays * DAY })
  function identity(ctx) {
    if (!ctx.team || !ctx.user) throw new Error('Open Kick from your Slack workspace.')
  }
  async function todo(ctx, id, tx = store) {
    identity(ctx)
    const r = await tx.get('todos', id)
    if (!r || r.team !== ctx.team || r.user !== ctx.user || r.expiresAt <= clock()) throw new Error('Personal to-do unavailable.')
    return r
  }
  async function todos(ctx, offset) {
    identity(ctx)
    return store.personalTodos(ctx.team, ctx.user, clock(), page(offset))
  }
  async function saveTodo(ctx, data, request) {
    identity(ctx)
    const detail = required(data.detail), due = date(data.due), status = data.status || 'open'
    if (!['open', 'done'].includes(status)) throw new Error('Choose Open or Done.')
    const id = data.id || key(ctx.team, ctx.user, 'todo', required(request, 100))
    return store.locked(`todo:${id}`, async tx => {
      const old = data.id ? await todo(ctx, id, tx) : await tx.get('todos', id)
      if (old && !data.id) return id
      if (old && old.version !== data.version) throw new Error('This to-do changed. Reopen it before editing.')
      await tx.set('todos', id, { ...(old || { team: ctx.team, user: ctx.user, at: clock(), expiresAt: clock() + 30 * DAY }),
        detail, due, status, version: (old?.version || 0) + 1, completedAt: status === 'done' ? old?.completedAt || clock() : null })
      return id
    })
  }
  async function deleteTodo(ctx, id) {
    identity(ctx)
    // Scoped deletion is idempotent, including repeated Slack submissions.
    return store.deleteTodo(ctx.team, ctx.user, id)
  }
  async function pollRow(ctx, id, tx = store, c) {
    c ||= await access(ctx)
    const p = await tx.get('polls', id)
    if (!p || p.team !== ctx.team || p.config !== c.id || p.expiresAt <= clock()) throw new Error('Poll unavailable.')
    return p
  }
  async function polls(ctx, offset = 0) {
    const c = await access(ctx)
    return store.pollPage(ctx.team, c.id, clock(), page(offset))
  }
  async function createPoll(ctx, data, request) {
    const c = await access(ctx), title = required(data.title, 150)
    const options = required(data.options).split('\n').map(v => v.trim()).filter(Boolean)
    if (options.length < 2 || options.length > 10 || options.some(v => v.length > 75) || new Set(options.map(v => v.toLowerCase())).size !== options.length) throw new Error('Use 2–10 different choices, one per line, up to 75 characters each.')
    const id = key(c.id, 'poll', required(request, 100))
    return store.locked(c.id, async tx => {
      if (!await tx.create('polls', id, { ...life(c), user: ctx.user, title, options, status: 'open' })) return id
      await tx.create('audit', key(id, 'created'), { ...life(c), user: ctx.user, event: 'poll_created', target: id, detail: 'Poll created; one choice per member' })
      // Explicit creation includes an announced, durable channel invitation.
      await engine.queue(c, key(id, 'announcement'), { kind: 'notice', reason: `Poll: ${escape(title)}\n${options.map(o => `• ${escape(o)}`).join('\n')}\nVote in Kick Home → ${escape(c.name)} → Team workspace → Polls. One choice per member; you can change it until closed. Counts are shared; votes are stored with your Slack ID (not anonymous).` }, tx)
      return id
    })
  }
  async function pollDetail(ctx, id) {
    const c = await access(ctx), p = await pollRow(ctx, id, store, c)
    const counts = await store.pollResults(ctx.team, c.id, id, clock()), mine = await store.get('ballots', key(id, ctx.user))
    return { ...p, canClose: [p.user, c.owner].includes(ctx.user), counts: p.options.map((_, i) => counts.find(v => v.choice === i)?.count || 0), myChoice: mine && mine.expiresAt > clock() ? mine.choice : null }
  }
  async function vote(ctx, id, choice) {
    const c = await access(ctx)
    return store.locked(`poll:${id}`, async tx => {
      const p = await pollRow(ctx, id, tx, c)
      if (p.status !== 'open') throw new Error('Voting has closed.')
      if (!Number.isInteger(choice) || choice < 0 || choice >= p.options.length) throw new Error('Choose a poll option.')
      const ballotId = key(id, ctx.user), old = await tx.get('ballots', ballotId)
      await tx.set('ballots', ballotId, { ...(old || life(c)), expiresAt: p.expiresAt, poll: id, user: ctx.user, choice })
    })
  }
  async function closePoll(ctx, id) {
    const c = await access(ctx)
    return store.locked(`poll:${id}`, async tx => {
      const p = await pollRow(ctx, id, tx, c)
      if (![p.user, c.owner].includes(ctx.user)) throw new Error('Only the creator or workflow owner can close this poll.')
      if (p.status === 'closed') return
      await tx.set('polls', id, { status: 'closed', closedAt: clock() })
      const counts = await tx.pollResults(ctx.team, c.id, id, clock())
      await engine.queue(c, key(id, 'results'), { kind: 'notice', reason: `Poll closed: ${escape(p.title)}\n${p.options.map((o, i) => `${escape(o)}: ${counts.find(v => v.choice === i)?.count || 0}`).join('\n')}\nResults reflect retained votes. Each person has one choice.` }, tx)
      await tx.create('audit', key(id, 'closed'), { ...life(c), user: ctx.user, event: 'poll_closed', target: id, detail: 'Results queued for channel' })
    })
  }
  async function report(ctx, filters) {
    const c = await access(ctx), from = date(filters.from), to = date(filters.to)
    const start = Date.parse(from), until = Date.parse(to) + DAY
    if (until <= start || until - start > 90 * DAY) throw new Error('Choose an ordered date range of at most 90 days.')
    const now = clock(), today = new Date(now).toISOString().slice(0, 10)
    const s = await store.report(ctx.team, c.id, start, until, now, today)
    const lines = [
      `Check-ins: ${s.runs.total} runs · ${s.responses.total} updates · ${s.responses.people} contributors · ${s.runs.expected} expected responses across runs`,
      `Blockers: ${s.blockers.total} reported · ${s.blockers.open} still open · ${s.blockers.total - s.blockers.open} resolved`,
      `Channel to-dos: ${s.actions.total} created · ${s.actions.done} done · ${s.actions.overdue} currently overdue (UTC)`,
      `Sprints: ${s.sprints.total} created · ${s.sprints.closed} closed`,
      `Recognition: ${s.recognition.total} thanks · ${s.recognition.people} recipients`,
      `Retrospectives: ${s.retros.total} created · ${s.retros.closed} closed · ${s.topics.total} topics added`,
      `Planning poker: ${s.poker.total} sessions created · ${s.poker.closed} decisions recorded`,
      `Polls: ${s.polls.total} created · ${s.polls.closed} closed · ${s.ballots.total} ballots first cast`,
    ]
    const note = 'Retained records created in this UTC date range, with their current status—not a historical snapshot. Expected responses sum the participant lists of runs created in range; updates are counted by their own creation date. Personal to-dos, legacy command history, coin balances and hidden estimates are excluded. No productivity scores.'
    return { c, from, to, generatedAt: now, stats: s, lines, note }
  }
  async function shareReport(ctx, filters, request) {
    const r = await report(ctx, filters)
    await engine.queue(r.c, key(r.c.id, ctx.user, 'report', required(request, 100)), { kind: 'notice', reason: `Kick report · ${escape(r.c.name)}\n${r.from} through ${r.to} (UTC)\n${r.lines.join('\n')}\n${r.note}` })
    return r
  }
  return { channel: access, todos, todo, saveTodo, deleteTodo, polls, createPoll, pollDetail, vote, closePoll, report, shareReport }
}
module.exports = { createProductivity }
