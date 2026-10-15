const { randomUUID } = require('node:crypto')
const { escape, DAY } = require('./domain')
const { createCoordination } = require('./coordination')

const labels = { approvals: 'Approvals', leaves: 'Leave requests', onboarding: 'Onboarding', meetings: 'Private one-on-ones', handoffs: 'Team handoffs', steps: 'Checklist item', notes: 'Agenda & follow-ups' }
function registerCoordination({ app, store, service, member, ui }) {
  const { modal, section, button, input, field, select, option, context, read } = ui
  const b = (label, action, data) => button(label, `coord_${action}`, JSON.stringify(data))
  const buttons = (...elements) => ({ type: 'actions', elements })
  const form = (title, action, data, blocks, submit = null) => modal(title, `coord_${action}_save`, JSON.stringify({ ...data, request: randomUUID() }), blocks, submit)
  const day = (id, label, value) => input(id, label, { type: 'datepicker', ...(value ? { initial_date: value } : {}) })
  const person = (id, label, value) => input(id, label, { type: 'users_select', ...(value ? { initial_user: value } : {}) })
  const paragraphs = v => (v.match(/[\s\S]{1,450}/gu) || []).map(s => section(escape(s)))
  const apiFor = client => createCoordination(store, { access: service(client).access, authorize: (c, user) => member(client, c.channel, user) })
  function notice(kind, c) {
    const privacy = ['meetings', 'notes'].includes(kind) ? 'Visible only to the two participants while they remain channel members. Excluded from channel search, reports and integrations. Titles and notes are encrypted at rest.' :
      ['approvals', 'leaves'].includes(kind) ? 'Details are visible only to the requester and approver. Approved leave shares only names, dates and the proposed cover teammate with this channel.' :
      kind === 'handoffs' ? 'The summary is shared with the source channel and the recipient you choose. Accepting shares it with the receiving channel. No other record is copied.' : 'Visible to current members of this channel.'
    return context(`${privacy} Kept for up to ${c.retentionDays} days from creation. Saving does not send a message.`)
  }
  async function render(api, ctx, action, data = {}) {
    const c = await api.access(ctx), scope = { c: c.id }, back = buttons(b('People & coordination', 'hub', scope))
    if (action === 'hub') return form('People & coordination', 'read', scope, [
      section(`*${escape(c.name)} · <#${c.channel}>*\nKeep handoffs explicit, decisions accountable, and sensitive conversations private.`),
      section('*Coordinate work*\nRequest a decision with a deadline, or agree on a handoff with another team.'),
      buttons(b('Approvals', 'list', { ...scope, kind: 'approvals' }), b('Team handoffs', 'list', { ...scope, kind: 'handoffs' })),
      section('*Support your teammates*\nMake a shared onboarding checklist, prepare a private conversation, or arrange leave coverage.'),
      buttons(b('Onboarding', 'list', { ...scope, kind: 'onboarding' }), b('Private one-on-ones', 'list', { ...scope, kind: 'meetings' })),
      buttons(b('My leave requests', 'list', { ...scope, kind: 'leaves' }), b('Team coverage', 'coverage', scope)),
      section('*Follow up without chasing*\nOptional daily channel summaries surface overdue tasks and aging blockers. Off until a workflow owner or Slack admin enables them.'),
      buttons(b('Escalation settings', 'escalation', scope)),
      buttons(button('Team planning', 'plan_hub', JSON.stringify(scope))),
    ])
    if (action === 'list') {
      const { kind } = data, offset = data.offset || 0
      const rows = await api.list(ctx, kind, offset, data.parent, data.filter)
      const filters = { pending: 'Awaiting your decision', incoming: 'Incoming to this workflow', active: 'Active only', upcoming: 'Active, today or later (UTC)', mine: 'Requested by you' }
      const blocks = [section(`*${labels[kind]}*${data.filter ? `\n${filters[data.filter]}` : ''}`), buttons(b('Create new', 'new', { ...scope, kind }))]
      rows.slice(0, 8).forEach(r => blocks.push({ ...section(`*${escape(r.title || r.detail.slice(0, 120))}*\n${r.status} · <@${r.owner}> · ${r.due}`), accessory: b('Open', 'view', { ...scope, kind, id: r.id }) }))
      if (!rows.length) blocks.push(section(data.filter ? 'No records match this view. Use All records to browse other statuses. Private lists still include only your own conversations or requests.' : 'Nothing here yet. Create a record to get started. Private lists include only records you participate in.'))
      if (data.filter) blocks.push(buttons(b('All records', 'list', { ...scope, kind })))
      const nav = []
      if (offset) nav.push(b('Previous', 'list', { ...data, offset: Math.max(0, offset - 8) }))
      if (rows.length > 8) nav.push(b('Next', 'list', { ...data, offset: offset + 8 }))
      if (nav.length) blocks.push(buttons(...nav))
      blocks.push(notice(kind, c), back)
      return form(labels[kind], 'read', scope, blocks)
    }
    if (action === 'new') {
      const kind = data.kind
      if (kind === 'handoffs' && !data.target) return form('Choose receiving team', 'target', { ...scope, kind }, [
        input('channel', 'Receiving public channel', { type: 'conversations_select', filter: { include: ['public'], exclude_bot_users: true } }),
        context('You and the recipient must belong to both channels. Only the summary you write will be shared. The receiving channel needs a Kick workflow.'),
      ], 'Choose workflow')
      if (!labels[kind]) throw new Error('Unknown tool.')
      const child = ['steps', 'notes'].includes(kind)
      if (child) await api.row(ctx, kind === 'steps' ? 'onboarding' : 'meetings', data.parent)
      const blocks = [child ? field('detail', kind === 'notes' ? 'Agenda topic or follow-up' : 'Checklist item', '', false, true) : field('title', 'Title'),
        person('owner', ['approvals', 'leaves'].includes(kind) ? 'Approver (not yourself)' : kind === 'meetings' ? 'Conversation partner' : kind === 'onboarding' ? 'New teammate' : 'Responsible teammate'),
        day('due', ['approvals', 'leaves'].includes(kind) ? 'Decision deadline (UTC)' : kind === 'meetings' ? 'Meeting date (UTC)' : 'Due date (UTC)')]
      if (['approvals', 'leaves', 'handoffs'].includes(kind)) blocks.push(field('detail', kind === 'handoffs' ? 'Summary safe to share with both teams' : 'Details for the approver', '', false, true))
      if (kind === 'leaves') blocks.push(day('start', 'First day away (UTC)'), day('end', 'Last day away (UTC)'), person('cover', 'Proposed cover teammate'), context('Coverage is a proposal, not an automatic assignment. Agree with this teammate first. This request does not change your reminder preferences; set your leave dates there separately. Avoid medical or other sensitive details.'))
      if (kind === 'onboarding') blocks.push(person('buddy', 'Onboarding buddy'))
      blocks.push(notice(kind, c), context('Choose dates within retention. Requests are immutable: cancel and recreate to change the recipient, details or dates.'))
      return form(labels[kind], 'create', { ...scope, kind, target: data.target, parent: data.parent }, blocks, 'Create')
    }
    if (action === 'view') {
      const { kind, id } = data, r = await api.row(ctx, kind, id), payload = { ...scope, kind, id, version: r.version }
      const blocks = [section(`*${escape(r.title || labels[kind])}*\n${r.status} · <@${r.owner}> · ${r.due}\nCreated by <@${r.user}>`)]
      if (r.detail) blocks.push(...paragraphs(r.detail))
      if (r.decision) blocks.push(section('*Decision note*'), ...paragraphs(r.decision))
      if (kind === 'leaves') blocks.push(section(`${r.start} – ${r.end} · proposed cover <@${r.cover}>`))
      if (kind === 'onboarding') blocks.push(section(`Buddy <@${r.buddy}>`))
      if (kind === 'handoffs') blocks.push(context(r.config === c.id ? 'You are viewing the source team. The recipient accepts from the receiving workflow.' : 'You are viewing the receiving team. Accepting shares this summary with your channel members.'))
      if (['onboarding', 'meetings'].includes(kind)) {
        const child = kind === 'meetings' ? 'notes' : 'steps', offset = data.offset || 0
        const rows = await api.list(ctx, child, offset, id)
        rows.slice(0, 8).forEach(item => blocks.push({ ...section(`${item.status === 'done' ? '✓' : '○'} ${escape(item.detail.slice(0, 300))}\n<@${item.owner}> · ${item.due}`), accessory: b('Open', 'view', { ...scope, kind: child, id: item.id }) }))
        if (!rows.length) blocks.push(section(kind === 'meetings' ? 'Add agenda topics and assign follow-ups to either participant.' : 'Add the first checklist item and give it an owner and due date.'))
        if (r.status === 'active' && [r.user, r.owner, r.buddy, ...(kind === 'onboarding' ? [c.owner] : [])].includes(ctx.user)) blocks.push(buttons(b('Add item', 'new', { ...scope, kind: child, parent: id })))
        const nav = []
        if (offset) nav.push(b('Previous items', 'view', { ...data, offset: Math.max(0, offset - 8) }))
        if (rows.length > 8) nav.push(b('Next items', 'view', { ...data, offset: offset + 8 }))
        if (nav.length) blocks.push(buttons(...nav))
      }
      const choices = []
      if (['approvals', 'leaves'].includes(kind)) {
        if (r.owner === ctx.user && r.status === 'pending') choices.push(['Approve', 'approved'], ['Decline', 'declined'])
        if (r.user === ctx.user && ['pending', 'approved'].includes(r.status)) choices.push(['Cancel request', 'cancelled'])
      } else if (kind === 'handoffs') {
        if (r.owner === ctx.user && c.id === r.target && r.status === 'pending') choices.push(['Accept & share', 'accepted'], ['Decline', 'declined'])
        if (r.owner === ctx.user && c.id === r.target && r.status === 'accepted') choices.push(['Mark complete', 'completed'])
        if (r.user === ctx.user && c.id === r.config && ['pending', 'accepted'].includes(r.status)) choices.push(['Cancel handoff', 'cancelled'])
      } else if (['meetings', 'onboarding'].includes(kind)) {
        if (r.status === 'active' && [r.user, r.owner, r.buddy, ...(kind === 'onboarding' ? [c.owner] : [])].includes(ctx.user)) choices.push(['Finish', 'completed'], ['Cancel', 'cancelled'])
      } else {
        const parent = await api.row(ctx, kind === 'notes' ? 'meetings' : 'onboarding', r.meeting || r.onboarding)
        if (parent.status === 'active' && [r.user, r.owner, parent.user, parent.owner, ...(kind === 'steps' ? [parent.buddy, c.owner] : [])].includes(ctx.user)) choices.push([r.status === 'done' ? 'Reopen item' : 'Mark done', r.status === 'done' ? 'open' : 'done'])
      }
      if (choices.length) blocks.push(buttons(...choices.map(([label, status]) => b(label, 'confirm', { ...payload, status }))))
      blocks.push(notice(kind, c), back)
      return form(labels[kind], 'read', scope, blocks)
    }
    if (action === 'confirm') {
      const r = await api.row(ctx, data.kind, data.id)
      return form('Confirm change', 'transition', { ...data }, [section(`Set *${escape(r.title || labels[data.kind])}* to *${escape(data.status)}*?`),
        ...(['approvals', 'leaves'].includes(data.kind) ? [field('decision', 'Decision note (optional)', '', true, true)] : []), notice(data.kind, c)], 'Confirm')
    }
    if (action === 'coverage') {
      const from = data.from || new Date().toISOString().slice(0, 10), to = data.to || new Date(Date.now() + 14 * DAY).toISOString().slice(0, 10)
      const rows = await api.coverage(ctx, from, to)
      return form('Team coverage', 'coverage', scope, [section(`*Approved leave · ${from} – ${to}*`),
        ...rows.slice(0, 50).map(r => section(`<@${r.user}> away ${r.start} – ${r.end} · proposed cover <@${r.cover}>`)),
        ...(!rows.length ? [section('No retained, approved leave in this date range.')] : []),
        ...(rows.length > 50 ? [context('More than 50 matches. Narrow the date range to see the rest.')] : []),
        day('from', 'From', from), day('to', 'Through', to), context('Only names, dates and proposed coverage are shared. Leave reasons and decision notes are never included.'), back], 'View dates')
    }
    if (action === 'escalation') {
      await api.access(ctx, true)
      const r = await api.escalation(ctx)
      return form('Escalation settings', 'escalation', { ...scope, version: r.version }, [
        section('Send one weekday channel summary after the workflow’s digest time when tasks are overdue or blockers need attention. Counts only—no private records, ranking or automatic reassignment.'),
        select('enabled', 'Channel escalation summaries', [option('Off', 'false'), option('On', 'true')], String(r.enabled)),
        input('days', 'Minimum age / days overdue', { type: 'number_input', is_decimal_allowed: false, min_value: '1', max_value: '30', initial_value: String(r.days) }),
        context(`Requires an enabled workflow and the scheduler. Settings expire with ${c.retentionDays}-day retention. Delivered counts are rechecked; resolved work is excluded. Disabling stops queued summaries.`),
      ], 'Save settings')
    }
    throw new Error('Open People & coordination from Kick Home.')
  }
  app.action(/^coord_/, async ({ body, action, client }) => {
    try {
      const data = JSON.parse(action.value), ctx = { team: body.team.id, user: body.user.id, config: data.c }
      await client.views.open({ trigger_id: body.trigger_id, view: await render(apiFor(client), ctx, action.action_id.slice(6), data) })
    } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Please try again', 'error', {}, [section(escape(e.message))]) }) }
  })
  app.view(/^coord_.*_save$/, async ({ body, view, client, ack }) => {
    try {
      const data = JSON.parse(view.private_metadata), ctx = { team: body.team.id, user: body.user.id, config: data.c }, api = apiFor(client), action = view.callback_id.slice(6, -5)
      let next = 'view', payload = { ...data }
      if (action === 'target') {
        const targets = await api.targets(ctx, read(view, 'channel'))
        if (!targets.length) throw new Error('No accessible Kick workflow in that channel. Add a workflow there first.')
        return ack({ response_action: 'update', view: form('Receiving workflow', 'workflow', data, [select('target', 'Workflow', targets.map(c => option(c.name, c.id)), targets[0].id)], 'Continue') })
      } else if (action === 'workflow') { next = 'new'; payload.target = read(view, 'target') }
      else if (action === 'create') {
        const fields = Object.fromEntries(['title', 'detail', 'owner', 'due', 'start', 'end', 'cover', 'buddy'].map(f => [f, read(view, f)]))
        payload.id = await api.create(ctx, data.kind, { ...data, ...fields }, data.request)
      } else if (action === 'transition') await api.transition(ctx, data.kind, data.id, { ...data, decision: read(view, 'decision') })
      else if (action === 'coverage') { next = 'coverage'; payload = { ...data, from: read(view, 'from'), to: read(view, 'to') } }
      else if (action === 'escalation') { await api.saveEscalation(ctx, { ...data, enabled: read(view, 'enabled') === 'true', days: read(view, 'days') }); next = 'hub' }
      else throw new Error('Unsupported submission.')
      await ack({ response_action: 'update', view: await render(api, ctx, next, payload) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } : { response_action: 'update', view: form('Please try again', 'error', {}, [section(escape(e.message))]) })
    }
  })
  return { render, apiFor }
}
module.exports = { registerCoordination }
