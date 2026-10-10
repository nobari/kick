const { randomUUID } = require('node:crypto')
const { escape } = require('./domain')
const { createPlanning, progress } = require('./planning')

function registerPlanning({ app, store, service, member, ui }) {
  const { modal, section, button, input, field, select, option, context, read } = ui
  const b = (label, action, data) => button(label, `plan_${action}`, JSON.stringify(data))
  const buttons = (...elements) => ({ type: 'actions', elements })
  const form = (title, action, data, blocks, submit = null) => modal(title, `plan_${action}_save`, JSON.stringify({ ...data, request: randomUUID() }), blocks, submit)
  const day = (id, label, value) => input(id, label, { type: 'datepicker', ...(value ? { initial_date: value } : {}) })
  const owner = user => input('owner', 'Responsible teammate', { type: 'users_select', initial_user: user })
  const metric = (id, label, n) => input(id, label, { type: 'number_input', is_decimal_allowed: true, ...(n != null ? { initial_value: String(n) } : {}), min_value: '-1000000000', max_value: '1000000000' })
  const back = c => buttons(b('Team planning', 'hub', { c }))
  const paragraphs = value => (value.match(/[\s\S]{1,450}/gu) || []).map(s => section(escape(s)))
  const apiFor = client => createPlanning(store, { access: service(client).access, authorize: (c, user) => member(client, c.channel, user) })
  const labels = { decisions: 'Decision log', objectives: 'Objectives & results', results: 'Key result' }
  async function render(api, ctx, action, data) {
    const c = await api.access(ctx), scope = { c: c.id }
    const disclosure = context(`Visible to current channel members. Kept for ${c.retentionDays} days from creation; edits do not extend retention. Saving sends no channel message.`)
    if (action === 'hub') return form('Team planning', 'read', scope, [
      section(`*${escape(c.name)} · <#${c.channel}>*\nAgree on priorities, make room for the work, and keep decisions easy to find.`),
      section('*Workload & capacity*\nCompare open channel to-dos with each person’s own weekly task limit.'),
      buttons(b('View workload', 'workload', scope)),
      section('*Objectives & key results*\nName an owner, set measurable targets, and update progress together.'),
      buttons(b('Objectives & results', 'objectives', scope)),
      section('*Decision log*\nKeep the decision, rationale, owner and review date in one place.'),
      buttons(b('Decision log', 'decisions', scope)), disclosure,
      buttons(button('Team workspace', 'collab_hub', JSON.stringify(scope))),
    ])
    if (action === 'workload') {
      const offset = data.offset || 0, r = await api.workload(ctx, data.week, offset)
      const blocks = [section(`*Workload · ${r.week} – ${r.end}*\nOpen channel to-dos due by the end of this week, including unfinished work from earlier weeks. This is a current view, not a historical snapshot.`),
        context('Limits are self-declared counts of tasks, not hours. Unset means unknown—not zero capacity. Personal to-dos, other workflows and external trackers are excluded.')]
      r.people.slice(0, 8).forEach(p => blocks.push(section(`<@${p.user}>\n*${p.tasks} open* · ${p.overdue} overdue now · ${p.limit == null ? 'capacity not set' : `limit ${p.limit}${p.tasks > p.limit ? ` · ${p.tasks - p.limit} over limit` : ` · ${p.limit - p.tasks} slots remaining`}`}`)))
      if (!r.people.length) blocks.push(section('No participants or open work yet. Add channel to-dos to start planning.'))
      blocks.push(buttons(b('Set my capacity', 'capacity', { ...scope, week: r.week }), b('Choose week', 'week', { ...scope, week: r.week }), button('Channel to-dos', 'collab_actions', JSON.stringify(scope))))
      const nav = []
      if (offset) nav.push(b('Previous', 'workload', { ...scope, week: r.week, offset: Math.max(0, offset - 8) }))
      if (r.people.length > 8) nav.push(b('Next', 'workload', { ...scope, week: r.week, offset: offset + 8 }))
      if (nav.length) blocks.push(buttons(...nav))
      blocks.push(disclosure, back(c.id))
      return form('Workload & capacity', 'read', scope, blocks)
    }
    if (action === 'week') return form('Choose a week', 'week', scope, [day('week', 'Any day in the week', data.week), context('Weeks run Monday–Sunday. Task status is current, even when you select an earlier week.')], 'View workload')
    if (action === 'capacity') {
      const r = await api.capacity(ctx, data.week)
      return form('My weekly capacity', 'capacity', { ...scope, week: r.week, version: r.version }, [
        section(`*Week of ${r.week}*\nHow many open tasks can you reasonably carry in this workflow? Only you can set your limit. Your teammates can see it.`),
        input('limit', 'Task limit (0 means unavailable)', { type: 'number_input', is_decimal_allowed: false, min_value: '0', max_value: '1000', ...(r.limit != null ? { initial_value: String(r.limit) } : {}) }),
        context('This week must finish before the record expires. This limit does not block assignments or automatically change your check-in schedule.'), disclosure,
      ], 'Save capacity')
    }
    if (['decisions', 'objectives'].includes(action)) {
      const offset = data.offset || 0, rows = await api.list(ctx, action, offset)
      const blocks = [section(`*${labels[action]} · ${escape(c.name)}*`), buttons(b(action === 'decisions' ? 'Record a decision' : 'Add an objective', `new_${action}`, scope))]
      rows.slice(0, 8).forEach(r => blocks.push({ ...section(`*${escape(r.title)}*\n${r.status} · <@${r.owner}> · ${action === 'decisions' ? `Review ${r.review}` : `${r.start} – ${r.end}`}`), accessory: b('Open', `view_${action}`, { ...scope, id: r.id }) }))
      if (!rows.length) blocks.push(section(action === 'decisions' ? 'No decisions recorded yet. Start with a proposal and explain why it matters.' : 'No objectives yet. Start with one outcome and add measurable key results.'))
      const nav = []
      if (offset) nav.push(b('Previous', action, { ...scope, offset: Math.max(0, offset - 8) }))
      if (rows.length > 8) nav.push(b('Next', action, { ...scope, offset: offset + 8 }))
      if (nav.length) blocks.push(buttons(...nav))
      blocks.push(disclosure, back(c.id))
      return form(labels[action], 'read', scope, blocks)
    }
    if (action.startsWith('view_')) {
      const kind = action.slice(5), r = await api.record(ctx, kind, data.id)
      const blocks = [section(`*${escape(r.title)}*\nOwner <@${r.owner}> · Created by <@${r.user}>`)]
      if (kind === 'decisions') blocks.push(section(`*${r.status}* · Review ${r.review}`), section('*Decision*'), ...paragraphs(r.detail), section('*Rationale*'), ...paragraphs(r.rationale))
      if (kind === 'results') blocks.push(section(`*${r.progress}% toward target*\n${r.baseline} → ${r.current} → ${r.target} ${escape(r.unit)}\nBaseline → current → target`), context('Progress is clamped to 0–100% for display; original values remain unchanged. It is not a measure of individual productivity.'))
      if (kind === 'objectives') {
        blocks.push(section(`*${r.status}* · ${r.start} – ${r.end}`))
        const offset = data.offset || 0, results = await api.list(ctx, 'results', offset, r.id)
        results.slice(0, 8).forEach(k => blocks.push({ ...section(`*${escape(k.title)}* · ${progress(k)}%\n${k.current} / ${k.target} ${escape(k.unit)} · <@${k.owner}>`), accessory: b('Open result', 'view_results', { ...scope, id: k.id }) }))
        if (!results.length) blocks.push(section('No key results yet. Add a baseline, a current value, a target and a unit.'))
        if (r.canEdit && r.status === 'active') blocks.push(buttons(b('Add key result', 'new_results', { ...scope, objective: r.id })))
        const nav = []
        if (offset) nav.push(b('Previous results', action, { ...data, offset: Math.max(0, offset - 8) }))
        if (results.length > 8) nav.push(b('Next results', action, { ...data, offset: offset + 8 }))
        if (nav.length) blocks.push(buttons(...nav))
      }
      if (r.canEdit) blocks.push(buttons(b('Edit', `edit_${kind}`, { ...scope, id: r.id })))
      blocks.push(disclosure, buttons(b(kind === 'results' ? 'Back to objective' : `All ${kind}`, kind === 'results' ? 'view_objectives' : kind, { ...scope, ...(kind === 'results' ? { id: r.objective } : {}) })))
      return form(labels[kind], 'read', scope, blocks)
    }
    const match = /^(new|edit)_(decisions|objectives|results)$/.exec(action)
    if (match) {
      const [, mode, kind] = match, r = mode === 'edit' ? await api.record(ctx, kind, data.id) : null
      if (r && !r.canEdit) throw new Error('Only a responsible owner or creator can edit this record.')
      const parent = kind === 'results' ? await api.record(ctx, 'objectives', r?.objective || data.objective) : null
      if (parent && (parent.status !== 'active' || (!r && !parent.canEdit))) throw new Error('Only an objective owner or creator can add results to an active objective.')
      const fields = [field('title', kind === 'results' ? 'Measurable result' : kind === 'objectives' ? 'Outcome to achieve' : 'Decision title', r?.title), owner(r?.owner || ctx.user)]
      if (kind === 'decisions') fields.push(field('detail', 'Decision / proposal', r?.detail, false, true), field('rationale', 'Why this choice?', r?.rationale, false, true), day('review', 'Review date', r?.review), select('status', 'Status', ['proposed', 'accepted', 'superseded'].map(x => option(x, x)), r?.status || 'proposed'))
      if (kind === 'objectives') fields.push(day('start', 'Start date', r?.start), day('end', 'Target date', r?.end), select('status', 'Status', ['active', 'closed'].map(x => option(x, x)), r?.status || 'active'), context('Closing stops key-result edits. An owner can reopen the objective while it remains within retention.'))
      if (kind === 'results') fields.push(metric('baseline', 'Baseline', r?.baseline ?? 0), metric('current', 'Current value', r?.current ?? 0), metric('target', 'Target value', r?.target), field('unit', 'Unit (e.g. days, releases, %)', r?.unit), context('Use a lower target for reductions. Key results expire no later than their objective.'))
      fields.push(disclosure, context('Choose target and review dates before the record expires. For longer planning cycles, ask the workflow owner to select 90-day retention before creating records.'))
      return form(kind === 'decisions' ? 'Record a decision' : kind === 'objectives' ? 'Edit objective' : 'Edit key result', kind, { ...scope, id: r?.id, version: r?.version, objective: parent?.id }, fields, 'Save')
    }
    throw new Error('Open Team planning from Kick Home.')
  }
  app.action(/^plan_/, async ({ body, action, client }) => {
    try {
      const data = JSON.parse(action.value), ctx = { team: body.team.id, user: body.user.id, config: data.c }
      await client.views.open({ trigger_id: body.trigger_id, view: await render(apiFor(client), ctx, action.action_id.slice(5), data) })
    } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Please try again', 'error', {}, [section(escape(e.message))]) }) }
  })
  app.view(/^plan_.*_save$/, async ({ body, view, client, ack }) => {
    try {
      const data = JSON.parse(view.private_metadata), ctx = { team: body.team.id, user: body.user.id, config: data.c }, api = apiFor(client), action = view.callback_id.slice(5, -5)
      let next, payload = { c: data.c }
      if (action === 'week') { next = 'workload'; payload.week = read(view, 'week') }
      else if (action === 'capacity') { await api.saveCapacity(ctx, { ...data, limit: read(view, 'limit') }, data.request); next = 'workload'; payload.week = data.week }
      else if (['decisions', 'objectives', 'results'].includes(action)) {
        const fields = Object.fromEntries(['title', 'owner', 'detail', 'rationale', 'review', 'status', 'start', 'end', 'baseline', 'current', 'target', 'unit'].map(f => [f, read(view, f)]))
        payload.id = await api.save(ctx, action, { ...data, ...fields }, data.request); next = `view_${action}`
      } else throw new Error('Unsupported submission.')
      await ack({ response_action: 'update', view: await render(api, ctx, next, payload) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } : { response_action: 'update', view: form('Please try again', 'error', {}, [section(escape(e.message))]) })
    }
  })
  return { render, apiFor }
}
module.exports = { registerPlanning }
