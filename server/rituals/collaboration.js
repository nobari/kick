const { key } = require('./store')
const { DAY, localTime, validTime, escape } = require('./domain')
const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'abstain']
const required = (value, max = 1500) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Enter between 1 and ${max} characters.`)
  return value.trim()
}
const date = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid date.')
  return value
}

// Every entry point rechecks workspace, retention and live channel membership.
// Slack membership is checked before opening a transaction; no network calls in locks.
function createCollaboration(store, engine, { authorize, clock = Date.now }) {
  const alive = (row, c) => row && row.team === c.team && row.config === c.id && row.expiresAt > clock()
  async function access(ctx, admin = false) {
    const c = await store.get('configs', ctx.config)
    if (!c || c.team !== ctx.team) throw new Error('Workflow unavailable. Open Kick Home again.')
    await authorize(c, ctx.user, admin)
    return c
  }
  const life = c => ({ team: c.team, config: c.id, at: clock(), expiresAt: clock() + c.retentionDays * DAY })
  async function row(tx, kind, id, c) {
    const value = await tx.get(kind, id)
    if (!alive(value, c)) throw new Error('This record is unavailable or its retention period has ended.')
    return value
  }
  async function audit(tx, c, user, event, target, detail, request) {
    await tx.create('audit', key(c.id, event, target, request), { ...life(c), user, event, target, detail })
  }
  async function list(ctx, kind) {
    if (!['actions', 'sprints', 'retros', 'poker', 'calendar', 'responses', 'blockers', 'recognition'].includes(kind)) throw new Error('Unsupported view.')
    const c = await access(ctx)
    return (await store.list(kind, 'config', '==', c.id)).filter(r => alive(r, c)).sort((a, b) => b.at - a.at)
  }
  async function action(ctx, data, request) {
    const c = await access(ctx), detail = required(data.detail), due = date(data.due)
    await authorize(c, data.owner, false)
    return store.locked(c.id, async tx => {
      let old = data.id ? await row(tx, 'actions', data.id, c) : null
      if (old && ![old.owner, old.user, c.owner].includes(ctx.user)) throw new Error('Only the assignee, creator or workflow owner can edit this action.')
      const status = data.status || old?.status || 'open'
      if (!['open', 'done'].includes(status)) throw new Error('Choose Open or Done.')
      const source = old?.source || data.source || null, sourceId = old?.sourceId || data.sourceId || null
      if (source && !['responses', 'blockers', 'topics', 'message'].includes(source)) throw new Error('Invalid source.')
      if (source && source !== 'message') await row(tx, source, sourceId, c)
      const sprint = data.sprint ? await row(tx, 'sprints', data.sprint, c) : null
      if (sprint && sprint.status !== 'active' && old?.sprint !== sprint.id) throw new Error('Choose an active sprint.')
      // A retro topic becomes one action even if two people convert it at once.
      const id = old?.id || key(c.id, 'action', source === 'topics' ? sourceId : request)
      if (!old && await tx.get('actions', id)) return id
      await tx.set('actions', id, { ...(old || life(c)), user: old?.user || ctx.user, owner: data.owner,
        detail, due, status, completedAt: status === 'done' ? old?.completedAt || clock() : null,
        source, sourceId, sprint: sprint?.id || null,
        expiresAt: Math.min(old?.expiresAt || clock() + c.retentionDays * DAY, sprint?.expiresAt || Infinity) })
      await audit(tx, c, ctx.user, old ? 'action_updated' : 'action_created', id, status, request)
      return id
    })
  }
  async function editResponse(ctx, id, version, answers, request) {
    const c = await access(ctx)
    return store.locked(`response:${id}`, async tx => {
      const r = await row(tx, 'responses', id, c), run = await row(tx, 'runs', r.run, c)
      if (r.user !== ctx.user) throw new Error('Only the author can edit an update.')
      const receipt = key(c.id, 'update_edited', id, request)
      if (await tx.get('audit', receipt)) return
      if (r.version !== version) throw new Error('This update changed. Reopen it before editing again.')
      if (answers.length !== run.questions.length) throw new Error('Answer every question.')
      answers = answers.map(a => required(a))
      const local = localTime(clock(), c.zone), delivery = await tx.get('jobs', key(run.id, 'digest'))
      const closed = run.closesAt ? clock() >= run.closesAt : local.date > run.date || local.time >= c.digestTime
      const late = closed || delivery?.status === 'sent' || delivery?.leaseUntil > clock()
      // Never rewrite a published digest. Late edits are an explicit, separately queued correction.
      const correction = late ? answers.map((a, i) => `${run.questions[i]}: ${a}`).join('\n') : r.correction
      await tx.set('responses', id, { answers: late ? r.answers : answers, correction, editedAt: clock(), version: version + 1 })
      if (late) await engine.queue(c, key(id, 'correction', request), { kind: 'notice', reason: `Correction to ${run.date} check-in by <@${ctx.user}>:\n${escape(correction)}` }, tx)
      await audit(tx, c, ctx.user, 'update_edited', id, late ? 'Late correction queued; original preserved' : 'Edited before digest', request)
    })
  }
  async function sprint(ctx, data, request) {
    const c = await access(ctx, true)
    return store.locked(c.id, async tx => {
      const id = data.id || key(c.id, 'sprint', request)
      if (!data.id) {
        const start = date(data.start), end = date(data.end)
        if (end < start) throw new Error('Sprint end must follow its start.')
        await tx.create('sprints', id, { ...life(c), user: ctx.user, title: required(data.title, 100), goal: required(data.goal), start, end, status: 'active' })
      } else {
        const s = await row(tx, 'sprints', id, c)
        if (s.status === 'closed') return id
        const actions = (await tx.list('actions', 'config', '==', c.id)).filter(a => alive(a, c) && a.sprint === id)
        const updates = (await tx.list('responses', 'config', '==', c.id)).filter(r => alive(r, c) && localTime(r.at, c.zone).date >= s.start && localTime(r.at, c.zone).date <= s.end)
        const recap = `${s.title}\nGoal: ${s.goal}\n${s.start} – ${s.end}\nLinked actions: ${actions.filter(a => a.status === 'done').length}/${actions.length} done.\n${updates.length} workflow updates during these dates. Counts reflect retained records; no inferred productivity score.`
        await tx.set('sprints', id, { status: 'closed', recap })
        await engine.queue(c, key(id, 'recap'), { kind: 'notice', reason: escape(recap) }, tx)
      }
      await audit(tx, c, ctx.user, data.id ? 'sprint_closed' : 'sprint_created', id, data.id ? 'Recap queued' : 'Sprint created', request)
      return id
    })
  }
  async function retro(ctx, data, request) {
    const c = await access(ctx)
    return store.locked(c.id, async tx => {
      const id = data.id || key(c.id, 'retro', request)
      if (!data.id) await tx.create('retros', id, { ...life(c), user: ctx.user, title: required(data.title, 100), status: 'collecting' })
      else {
        const r = await row(tx, 'retros', id, c)
        if (![r.user, c.owner].includes(ctx.user)) throw new Error('Only the facilitator or workflow owner can change the phase.')
        if (!['collecting', 'voting', 'closed'].includes(data.status)) throw new Error('Choose a phase.')
        if (r.status === 'closed') throw new Error('This retrospective is closed. Start a new one.')
        await tx.set('retros', id, { status: data.status })
      }
      await audit(tx, c, ctx.user, 'retro_phase', id, data.status || 'collecting', request)
      return id
    })
  }
  async function topic(ctx, data, request) {
    const c = await access(ctx)
    return store.locked(c.id, async tx => {
      const r = await row(tx, 'retros', data.retro, c)
      if (data.id) {
        const t = await row(tx, 'topics', data.id, c)
        if (t.retro !== r.id || ![r.user, c.owner].includes(ctx.user) || r.status === 'closed') throw new Error('Only the facilitator can group topics in an open retrospective.')
        await tx.set('topics', t.id, { group: required(data.group, 100) })
        return t.id
      }
      if (r.status !== 'collecting') throw new Error('Topic collection has ended.')
      if (!['Keep', 'Improve', 'Try'].includes(data.category)) throw new Error('Choose a category.')
      const id = key(c.id, 'topic', request)
      await tx.create('topics', id, { ...life(c), expiresAt: r.expiresAt, retro: r.id, user: ctx.user, detail: required(data.detail), category: data.category })
      return id
    })
  }
  async function vote(ctx, topicId) {
    const c = await access(ctx)
    return store.locked(c.id, async tx => {
      const t = await row(tx, 'topics', topicId, c), r = await row(tx, 'retros', t.retro, c)
      if (r.status !== 'voting') throw new Error('Voting is not open.')
      await tx.create('votes', key(t.id, ctx.user), { ...life(c), expiresAt: r.expiresAt, topic: t.id, user: ctx.user })
    })
  }
  async function retroDetail(ctx, id) {
    const c = await access(ctx), r = await row(store, 'retros', id, c)
    const topics = (await store.list('topics', 'retro', '==', id)).filter(t => alive(t, c))
    const votes = (await store.list('votes', 'config', '==', c.id)).filter(v => alive(v, c))
    return { ...r, topics: topics.map(t => ({ ...t, votes: votes.filter(v => v.topic === t.id).length, voted: votes.some(v => v.topic === t.id && v.user === ctx.user) })) }
  }
  async function poker(ctx, data, request) {
    const c = await access(ctx)
    if (!data.id) {
      const members = [...new Set(data.members || [])]
      if (!members.length || members.length > 50) throw new Error('Choose 1–50 channel members.')
      for (const user of members) await authorize(c, user, false)
      const id = key(c.id, 'poker', request)
      await store.create('poker', id, { ...life(c), user: ctx.user, title: required(data.title, 150), members, round: 1, status: 'voting' })
      return id
    }
    return store.locked(`poker:${data.id}`, async tx => {
      const p = await row(tx, 'poker', data.id, c)
      if (data.value) {
        if (p.status !== 'voting' || !p.members.includes(ctx.user) || p.round !== data.round) throw new Error('This voting round is not open for you. Refresh the session.')
        if (!CARDS.includes(data.value)) throw new Error('Choose a valid estimate.')
        await tx.set('estimates', key(p.id, p.round, ctx.user), { ...life(c), expiresAt: p.expiresAt, poker: p.id, user: ctx.user, round: p.round, value: data.value })
      } else {
        if (![p.user, c.owner].includes(ctx.user)) throw new Error('Only the facilitator or workflow owner can manage this session.')
        const receipt = key(c.id, 'poker_phase', p.id, request)
        if (await tx.get('audit', receipt)) return p.id
        if (p.status === 'closed') throw new Error('This session is closed.')
        if (data.status === 'revealed' && p.status === 'voting') await tx.set('poker', p.id, { status: 'revealed' })
        else if (data.status === 'voting' && p.status === 'revealed') await tx.set('poker', p.id, { status: 'voting', round: p.round + 1 })
        else if (data.status === 'closed' && p.status === 'revealed') await tx.set('poker', p.id, { status: 'closed', decision: required(data.decision, 150) })
        else throw new Error('Refresh the session before changing its phase.')
        await audit(tx, c, ctx.user, 'poker_phase', p.id, data.status, request)
      }
      return p.id
    })
  }
  async function pokerDetail(ctx, id) {
    const c = await access(ctx)
    return store.locked(`poker:${id}`, async tx => {
      const p = await row(tx, 'poker', id, c)
      const votes = (await tx.list('estimates', 'poker', '==', id)).filter(v => alive(v, c) && v.round === p.round)
      // Never return hidden values to the Slack renderer, even to the facilitator.
      return { ...p, votes: votes.map(v => ({ user: v.user, ...(p.status !== 'voting' ? { value: v.value } : {}) })), myVote: votes.find(v => v.user === ctx.user)?.value }
    })
  }
  async function calendar(ctx, data, request) {
    const c = await access(ctx, true), day = date(data.date)
    if (day < localTime(clock(), c.zone).date) throw new Error('Choose today or a future date.')
    if (!data.skip && (!validTime(data.time) || !validTime(data.digestTime) || data.time >= data.digestTime)) throw new Error('Choose an opening time before the digest.')
    return store.locked(c.id, async tx => {
      if (await tx.get('runs', key(c.id, day))) throw new Error('This check-in already opened. Change a future date instead.')
      const id = key(c.id, 'calendar', day)
      // Exceptions cannot outlive the workflow retention policy; avoid silently expiring future plans.
      if (Date.parse(day) > clock() + (c.retentionDays - 1) * DAY) throw new Error(`Choose a date within the next ${c.retentionDays - 1} days.`)
      await tx.set('calendar', id, { ...life(c), user: ctx.user, date: day, skip: !!data.skip, time: data.skip ? null : data.time, digestTime: data.skip ? null : data.digestTime })
      await audit(tx, c, ctx.user, 'calendar_changed', id, `${day}: ${data.skip ? 'skipped' : `${data.time}–${data.digestTime}`}`, request)
    })
  }
  async function search(ctx, filters) {
    const c = await access(ctx)
    if (filters.from) date(filters.from)
    if (filters.to) date(filters.to)
    if (filters.from && filters.to && filters.from > filters.to) throw new Error('End date must follow start date.')
    return store.search(c.id, { ...filters, now: clock() })
  }
  async function operations(ctx) {
    const c = await access(ctx, true)
    const jobs = (await store.list('jobs', 'config', '==', c.id)).filter(j => alive(j, c)).sort((a, b) => b.at - a.at)
    const audit = (await store.list('audit', 'config', '==', c.id)).filter(j => alive(j, c)).sort((a, b) => b.at - a.at)
    return { config: c, jobs, audit }
  }
  async function retry(ctx, id, request) {
    const c = await access(ctx, true)
    return store.locked(c.id, async tx => {
      const job = await row(tx, 'jobs', id, c)
      if (!c.enabled || job.status !== 'failed' || job.leaseUntil > clock()) throw new Error('Only failed, unleased deliveries on an enabled workflow can be retried.')
      await tx.set('jobs', id, { done: false, status: 'retry', attempts: 0, dueAt: clock(), leaseUntil: 0, owner: null })
      await audit(tx, c, ctx.user, 'delivery_retry', id, 'Retry requested; original message identity preserved', request)
    })
  }
  async function shortcut(ctx, kind, data, request) {
    const c = await access(ctx)
    if (kind === 'action') return action(ctx, { ...data, source: 'message' }, request)
    const detail = required(data.detail)
    await authorize(c, data.owner, false)
    return store.locked(c.id, async tx => {
      const id = key(c.id, kind, request)
      if (kind === 'blocker') await tx.create('blockers', id, { ...life(c), user: ctx.user, helper: data.owner, detail })
      else if (kind === 'kudos') {
        if (data.owner === ctx.user) throw new Error('Choose a teammate to thank.')
        await tx.create('recognition', id, { ...life(c), from: ctx.user, to: data.owner, reason: detail })
        await engine.queue(c, key(id, 'notice'), { kind: 'notice', reason: `<@${ctx.user}> thanked <@${data.owner}>: ${escape(detail)}` }, tx)
      } else throw new Error('Unknown shortcut.')
      return id
    })
  }
  return { access, list, action, editResponse, sprint, retro, topic, vote, retroDetail, poker, pokerDetail, calendar, search, operations, retry, shortcut }
}
module.exports = { createCollaboration, CARDS, date }
