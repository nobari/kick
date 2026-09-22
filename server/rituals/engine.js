const { DAY, localTime, mayRemind, nextInRotation, insights, escape } = require('./domain')
const { key } = require('./store')
const { randomUUID } = require('node:crypto')
const text = value => ({ type: 'plain_text', text: value })
const button = (label, action_id, value) => ({ type: 'button', text: text(label), action_id, value })
const section = value => ({ type: 'section', text: { type: 'mrkdwn', text: value.slice(0, 2900) } })
function createEngine(store, clientFor, clock = Date.now, { dmEnabled = true, canRemind = async () => true } = {}) {
  const configId = (team, channel) => key(team, channel)
  async function config(team, channel) { return store.get('configs', configId(team, channel)) }
  async function channelMembers(client, channel) {
    const users = new Set(); let cursor
    do {
      const r = await client.conversations.members({ channel, cursor, limit: 200 })
      r.members.forEach(u => users.add(u)); cursor = r.response_metadata?.next_cursor
    } while (cursor)
    return users
  }
  async function queue(c, id, payload, target = store) {
    await target.create('jobs', id, { ...payload, config: c.id, team: c.team, channel: c.channel,
      dueAt: clock(), at: clock(), attempts: 0, clientId: randomUUID(), expiresAt: clock() + c.retentionDays * DAY })
  }
  async function currentRun(c) {
    const now = clock(), local = localTime(now, c.zone)
    const id = key(c.id, local.date)
    if (!c.enabled || !c.days.includes(local.day) || local.time < c.time || local.time >= c.digestTime) return null
    const existing = await store.get('runs', id)
    if (existing) return existing
    const current = await channelMembers(await clientFor(c.team), c.channel)
    const members = []
    for (const user of c.members) {
      if (!current.has(user)) continue
      const pref = await store.get('prefs', key(c.team, user))
      if (!pref?.leaveUntil || pref.leaveUntil < local.date) members.push(user)
    }
    await store.create('runs', id, { config: c.id, team: c.team, channel: c.channel, date: local.date,
      at: now, members, questions: c.questions, expiresAt: now + c.retentionDays * DAY })
    return store.get('runs', id)
  }
  async function submit(c, user, answers, blocker, helper) {
    const run = await currentRun(c)
    if (!run || !run.members.includes(user)) throw new Error('No open check-in for you. Check the schedule or your leave settings.')
    const id = key(run.id, user)
    if (answers.length !== run.questions.length || answers.some(a => !a.trim() || a.length > 1500)) throw new Error('Answer each question (maximum 1,500 characters).')
    const response = { config: c.id, team: c.team, run: run.id, user, answers,
      at: clock(), expiresAt: clock() + c.retentionDays * DAY }
    // One immutable submission per user/run makes retries safe.
    await store.submit(id, response, blocker?.trim() ? { config: c.id, team: c.team, user,
        detail: blocker.slice(0, 1500), helper: helper || user, at: clock(), resolvedAt: null,
        expiresAt: response.expiresAt } : null)
    return id
  }
  async function recordLegacy(team, channel, user, values) {
    const c = await config(team, channel)
    if (!c?.enabled || c.template !== 'standup') return
    const run = await currentRun(c)
    if (!run?.members.includes(user)) return
    await submit(c, user, [String(values.l || 'No previous update'), String(values.t || 'No plan provided')],
      values.b && !['none', 'no', '-'].includes(String(values.b).toLowerCase()) ? String(values.b) : '', user)
  }
  async function dataset(c) {
    const kinds = ['runs', 'responses', 'blockers', 'recognition']
    const values = await Promise.all(kinds.map(k => store.list(k, 'config', '==', c.id)))
    return Object.fromEntries(kinds.map((k, i) => [k, values[i].filter(x => x.expiresAt > clock())]))
  }
  async function tickConfig(c) {
    const now = clock(), local = localTime(now, c.zone)
    if (!c.enabled) return
    const run = await currentRun(c) || await store.get('runs', key(c.id, local.date))
    if (run && local.time < c.digestTime) {
      await queue(c, key(run.id, 'prompt'), { kind: 'prompt', run: run.id })
      if (dmEnabled && now - run.at >= 60 * 60000) {
        for (const user of run.members) {
          if (await store.get('responses', key(run.id, user))) continue
          const pref = await store.get('prefs', key(c.team, user))
          if (mayRemind(pref || {}, now, c.zone)) await queue(c, key(run.id, 'reminder', user), { kind: 'reminder', run: run.id, user })
        }
      }
    }
    const recentRuns = await store.list('runs', 'config', '==', c.id)
    for (const previous of recentRuns.filter(r => r.expiresAt > now && now - r.at < 2 * DAY &&
      (r.date < local.date || (r.date === local.date && local.time >= c.digestTime))))
      await queue(c, key(previous.id, 'digest'), { kind: 'digest', run: previous.id })
    if (local.time >= c.digestTime && local.day === 5 && c.roundup)
      await queue(c, key(c.id, local.date, 'roundup'), { kind: 'roundup', since: now - 7 * DAY })
    if (dmEnabled && local.day >= 1 && local.day <= 5) {
      const blockers = await store.list('blockers', 'config', '==', c.id)
      for (const b of blockers.filter(b => !b.resolvedAt && b.expiresAt > now && now - b.at >= DAY)) {
        const user = b.helper || b.user, pref = await store.get('prefs', key(c.team, user))
        if (mayRemind(pref || {}, now, c.zone)) await queue(c, key(b.id, local.date, 'followup'), { kind: 'followup', blocker: b.id, user })
      }
    }
  }
  async function deliver(job) {
    const c = await store.get('configs', job.config), now = clock()
    if (!c || !c.enabled || job.expiresAt <= now) return 'skipped'
    if (job.user && (!dmEnabled || !await canRemind(c.team))) return 'skipped'
    const client = await clientFor(c.team)
    const run = job.run && await store.get('runs', job.run)
    let channel = c.channel, blocks, message
    if (job.kind === 'prompt' || job.kind === 'reminder') {
      const local = localTime(now, c.zone)
      if (!run || local.date !== run.date || local.time >= c.digestTime) return 'skipped'
      if (job.kind === 'reminder') {
        if (!c.members.includes(job.user) || await store.get('responses', key(run.id, job.user))) return 'skipped'
        const pref = await store.get('prefs', key(c.team, job.user))
        if (!mayRemind(pref || {}, now, c.zone)) return 'deferred'
      }
      message = job.kind === 'prompt' ? `Time for your team check-in · ${run.date}` : 'A gentle check-in reminder. Share an update when you have a moment.'
      message += ` Submit before ${c.digestTime} (${c.zone}). Your answers will be shared in the channel digest.`
      blocks = [{ type: 'header', text: text(job.user ? 'Your check-in reminder' : 'Time to check in') }, section(message),
        { type: 'context', elements: [text(`${run.members.length} participants · ${c.retentionDays}-day retention · No reply required in this thread`)] },
        { type: 'actions', elements: [{ ...button('Share update', 'ritual_checkin', c.channel), style: 'primary' },
        ...(job.user ? [button('Snooze 1 hour', 'ritual_snooze', c.channel), button('Preferences', 'ritual_preferences', c.channel)] : [])] }]
    } else if (job.kind === 'digest') {
      if (!run) return 'skipped'
      const data = await dataset(c), responses = data.responses.filter(r => r.run === run.id)
      const missing = run.members.filter(u => !responses.some(r => r.user === u))
      message = `Team digest · ${run.date}: ${responses.length}/${run.members.length} updates; ${missing.length} pending.`
      blocks = [section(message)]
      responses.forEach(r => blocks.push(section(`<@${r.user}>\n${r.answers.map((a, i) => `*${escape(run.questions[i])}*\n${escape(a)}`).join('\n').slice(0, 2700)}`)))
      const open = data.blockers.filter(b => !b.resolvedAt)
      blocks.push(section(`*Open blockers:* ${open.length}. Review and resolve in Kick’s Home tab.\n*Pending:* ${missing.map(u => `<@${u}>`).join(', ') || 'Everyone has responded.'}`))
      // Slack allows 50 blocks; preserve all responses in Home, summarize overflow.
      if (blocks.length > 50) blocks = [...blocks.slice(0, 48), section('More updates are available in Kick’s Home tab.'), blocks.at(-1)]
      // Screen readers use the top-level text rather than interior blocks.
      message += '\n' + responses.map(r => `<@${r.user}>: ${r.answers.map((a, i) => `${escape(run.questions[i])}: ${escape(a)}`).join('; ')}`).join('\n')
      message = message.slice(0, 35000) + `\nOpen blockers: ${open.length}. Read all updates in Kick Home.`
    } else if (job.kind === 'roundup') {
      const items = (await store.list('recognition', 'config', '==', c.id)).filter(r => r.at >= job.since && r.expiresAt > now)
      if (!items.length) return 'skipped'
      message = `Weekly appreciation · ${items.length} contributions celebrated. No rankings—just thanks.`
      blocks = [section(message), ...items.slice(-20).map(r => section(`<@${r.from}> thanked <@${r.to}>: ${escape(r.reason || 'Thank you for your contribution!')}`))]
      message += '\n' + items.slice(-20).map(r => `<@${r.from}> thanked <@${r.to}>: ${escape(r.reason || 'Thank you for your contribution!')}`).join('\n')
    } else if (job.kind === 'followup') {
      const b = await store.get('blockers', job.blocker)
      if (!b || b.resolvedAt || b.expiresAt <= now || (b.helper || b.user) !== job.user) return 'skipped'
      const pref = await store.get('prefs', key(c.team, job.user))
      if (!mayRemind(pref || {}, now, c.zone)) return 'deferred'
      message = `Can you help with this blocker? ${escape(b.detail)}`
      blocks = [section(message), { type: 'actions', elements: [button('Resolve / assign', 'ritual_blocker', b.id)] }]
    } else if (job.kind === 'rotation') {
      message = `Next in the team rotation: <@${job.selected}>. ${escape(job.reason)}`
    } else return 'skipped'
    if (job.user) {
      // Never disclose a channel blocker to someone who has since left it.
      if (!(await channelMembers(client, c.channel)).has(job.user)) return 'skipped'
      const dm = await client.conversations.open({ users: job.user })
      channel = dm.channel.id
    }
    await client.chat.postMessage({ channel, text: message, blocks, client_msg_id: job.clientId,
      unfurl_links: false, unfurl_media: false })
    return 'sent'
  }
  async function tick() {
    const started = clock(), results = { configurations: 0, sent: 0, failed: 0 }
    const configs = await store.list('configs', 'nextAt', '<=', started, 10)
    for (const c of configs) {
      if (clock() - started > 20000) break
      const owner = await store.claim('configs', c.id, clock())
      if (!owner) continue
      try {
        await tickConfig(c)
        await store.finish('configs', c.id, owner, { nextAt: clock() + 5 * 60000, leaseUntil: 0, lastError: null })
        results.configurations++
      } catch (e) {
        await store.finish('configs', c.id, owner, { nextAt: clock() + 5 * 60000, leaseUntil: 0, lastError: e.data?.error || 'scheduler_error' })
        results.failed++
      }
    }
    const jobs = await store.list('jobs', 'dueAt', '<=', clock(), 25)
    for (const job of jobs) {
      if (clock() - started > 45000) break
      const owner = await store.claim('jobs', job.id, clock())
      if (!owner) continue
      try {
        const status = await deliver(job)
        await store.finish('jobs', job.id, owner, status === 'deferred' ? { dueAt: clock() + 15 * 60000, leaseUntil: 0 } :
          { done: true, status, dueAt: Number.MAX_SAFE_INTEGER, leaseUntil: 0 })
        if (status === 'sent') results.sent++
      } catch (e) {
        const attempts = job.attempts + 1, dead = attempts >= 8
        await store.finish('jobs', job.id, owner, { attempts, done: dead, status: dead ? 'failed' : 'retry', leaseUntil: 0,
          dueAt: dead ? Number.MAX_SAFE_INTEGER : clock() + Math.max(Number(e.retryAfter || 0) * 1000, Math.min(3600000, 30000 * 2 ** attempts)),
          lastError: e.data?.error || 'delivery_error' })
        results.failed++
      }
    }
    if (clock() - started < 50000) await store.cleanup(clock())
    return results
  }
  async function rotate(c, excluded, reason, requestId) {
    const id = key(c.id, 'rotation'), operation = key(c.id, requestId)
    const present = await channelMembers(await clientFor(c.team), c.channel)
    const ineligible = [...excluded, ...c.members.filter(user => !present.has(user))]
    const perform = async target => {
    const previous = await target.get('jobs', operation)
    if (previous?.selected) return previous.selected
    const state = await target.mutate('rotations', id, old => {
      if (old?.operations?.[operation]) return old
      const history = old?.expiresAt > clock() ? old.history : []
      const selected = nextInRotation(c.members, history, ineligible)
      const operations = { ...old?.operations, [operation]: selected }
      return { team: c.team, config: c.id, operations: Object.fromEntries(Object.entries(operations).slice(-500)), selected, history: [...history, selected].slice(-500), at: clock(), expiresAt: clock() + c.retentionDays * DAY }
    })
    const selected = state.operations[operation]
    await queue(c, operation, { kind: 'rotation', selected, reason }, target)
    return selected
    }
    return store.atomic ? store.atomic(perform) : perform(store)
  }
  async function recognize(team, channel, from, to, reason, ts) {
    const c = await config(team, channel)
    if (!c?.enabled) return
    await store.create('recognition', key(c.id, ts, to), { config: c.id, team, from, to, reason: String(reason || '').slice(0, 1500),
      at: clock(), expiresAt: clock() + c.retentionDays * DAY })
  }
  return { configId, config, currentRun, submit, recordLegacy, dataset, tick, tickConfig, deliver, rotate, recognize, queue,
    insights: async c => { const d = await dataset(c); return insights(d.runs, d.responses, d.blockers, clock()) } }
}
module.exports = { createEngine, text, button, section }
