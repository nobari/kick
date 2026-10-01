const { randomUUID } = require('node:crypto')
const { escape } = require('./domain')
const { createProductivity } = require('./productivity')

function registerProductivity({ app, store, engine, service, ui }) {
  const { modal, section, button, field, input, select, option, context, read } = ui
  const buttons = (...elements) => ({ type: 'actions', elements })
  const b = (label, action, data = {}) => button(label, `work_${action}`, JSON.stringify(data))
  const form = (title, action, data, blocks, submit = null) => modal(title, `work_${action}_save`, JSON.stringify({ ...data, request: data.request || randomUUID() }), blocks, submit)
  const day = (id, label, initial) => input(id, label, { type: 'datepicker', ...(initial ? { initial_date: initial } : {}) })
  const apiFor = client => createProductivity(store, engine, { access: service(client).access })
  async function render(api, ctx, action, data) {
    if (action === 'todos') {
      const offset = data.offset || 0, rows = await api.todos(ctx, offset)
      const blocks = [section('*My personal to-dos*\nOnly you can view these in Kick. They are not shared in channels, search or reports. Each task is kept for 30 days from creation, even when edited.'), buttons(b('Add personal to-do', 'new_todo'))]
      rows.slice(0, 8).forEach(r => blocks.push({ ...section(`*${r.status === 'done' ? 'Done' : 'Open'}* · Due ${r.due}\n${escape(r.detail).slice(0, 1500)}`), accessory: b('Edit', 'todo', { id: r.id }) }))
      if (!rows.length) blocks.push(section('Nothing here yet. Add a reminder for yourself, without notifying your team.'))
      const nav = []
      if (offset) nav.push(b('Previous', 'todos', { offset: Math.max(0, offset - 8) }))
      if (rows.length > 8) nav.push(b('Next', 'todos', { offset: offset + 8 }))
      if (nav.length) blocks.push(buttons(...nav))
      return form('My personal to-dos', 'read', {}, blocks)
    }
    if (action === 'new_todo' || action === 'todo') {
      const old = action === 'todo' ? await api.todo(ctx, data.id) : null
      return form(old ? 'Edit personal to-do' : 'New personal to-do', 'todo', { id: old?.id, version: old?.version }, [
        section('Private to you in Kick. No channel notification is sent. For shared work, use Channel to-dos in the team workspace.'),
        field('detail', 'To-do', old?.detail || '', false, true), day('due', 'Due date', old?.due),
        select('status', 'Status', [option('Open', 'open'), option('Done', 'done')], old?.status || 'open'),
        ...(old ? [buttons(b('Delete to-do', 'delete_todo', { id: old.id }))] : []),
      ], 'Save')
    }
    if (action === 'delete_todo') {
      await api.todo(ctx, data.id)
      return form('Delete personal to-do?', 'delete_todo', data, [section('Permanently delete this personal to-do from Kick? This cannot be undone.')], 'Delete')
    }
    if (action === 'polls') {
      const offset = data.offset || 0, all = await api.polls(ctx, offset)
      const blocks = [section('*Channel polls*\nOne choice per member. Results show totals; votes are stored with your Slack ID and are not anonymous.'), buttons(b('Create poll', 'new_poll', { c: ctx.config }))]
      all.slice(0, 8).forEach(p => blocks.push({ ...section(`*${escape(p.title)}* · ${p.status}`), accessory: b('Vote / results', 'poll', { c: ctx.config, id: p.id }) }))
      if (!all.length) blocks.push(section('No polls yet. Ask your channel a question with 2–10 choices.'))
      const nav = [button('Team workspace', 'collab_hub', JSON.stringify({ c: ctx.config }))]
      if (offset) nav.push(b('Previous', 'polls', { c: ctx.config, offset: Math.max(0, offset - 8) }))
      if (all.length > 8) nav.push(b('Next', 'polls', { c: ctx.config, offset: offset + 8 }))
      blocks.push(buttons(...nav))
      return form('Channel polls', 'read', data, blocks)
    }
    if (action === 'new_poll') {
      await api.channel(ctx) // Membership check before showing a shared creation form.
      return form('Create channel poll', 'poll', { c: ctx.config }, [
        section('Creating a poll queues an invitation for this channel. Members vote in Kick Home. Choices cannot be edited after creation; the creator or workflow owner can close voting and share results.'),
        field('title', 'Question'), field('options', 'Choices — one per line', '', false, true), context('2–10 different choices, up to 75 characters each. Not anonymous; your Slack ID is stored with your vote.'),
      ], 'Create & announce')
    }
    if (action === 'poll' || action === 'close_poll') {
      const p = await api.pollDetail(ctx, data.id)
      if (action === 'close_poll') {
        if (!p.canClose) throw new Error('Only the creator or workflow owner can close this poll.')
        return form('Close this poll?', 'close_poll', data, [section(`Close voting for “${escape(p.title)}” and queue the final results for the channel? You cannot reopen it.`)], 'Close & share')
      }
      const blocks = [section(`*${escape(p.title)}*\n${p.status === 'open' ? 'Voting open' : 'Voting closed'} · ${p.counts.reduce((a, n) => a + n, 0)} votes`),
        ...p.options.map((o, i) => section(`${escape(o)}: *${p.counts[i]}*${p.myChoice === i ? ' · your choice' : ''}`)),
        context('Totals are visible to channel members. Votes are stored with Slack IDs, not anonymously. One vote per person; changing your choice replaces the previous vote.')]
      if (p.status === 'open') {
        blocks.push(select('choice', 'Your choice', p.options.map((o, i) => option(o, i)), p.myChoice ?? 0))
        // The service checks creator/owner again on close, including forged actions.
        if (p.canClose) blocks.push(buttons(b('Close poll…', 'close_poll', data)))
      }
      blocks.push(buttons(b('Refresh', 'poll', data), b('All polls', 'polls', { c: ctx.config })))
      return form('Poll results', 'vote', { c: ctx.config, id: p.id }, blocks, p.status === 'open' ? 'Save vote' : null)
    }
    if (action === 'report') {
      // Report access is also checked again at generation and sharing.
      const today = new Date().toISOString().slice(0, 10), week = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
      await api.channel(ctx)
      return form('Comprehensive report', 'report', { c: ctx.config }, [section('Combine this workflow’s retained check-ins, blockers, channel to-dos, sprints, recognition, retrospectives, planning sessions and polls. Personal to-dos are always excluded.'), day('from', 'From (UTC)', week), day('to', 'Through (UTC)', today), context('Up to 90 days. Counts use creation dates and current status, not historical snapshots. Nothing is shared until you confirm.')], 'Build report')
    }
    if (action === 'report_result') {
      const r = await api.report(ctx, data)
      return form('Comprehensive report', 'share_report', { c: ctx.config, from: r.from, to: r.to }, [
        section(`*${escape(r.c.name)} · <#${r.c.channel}>*\n${r.from} through ${r.to} (UTC)\nGenerated ${new Date(r.generatedAt).toISOString().slice(0, 16)} UTC`),
        ...r.lines.map(section), section(r.note), context('Share report queues a fresh copy of these totals for this channel. No private personal tasks or hidden estimates are included.'),
        buttons(b('Change dates', 'report', { c: ctx.config })),
      ], 'Share report')
    }
    throw new Error('Open Kick Home and choose a tool.')
  }
  app.action(/^work_/, async ({ body, action, client }) => {
    try {
      const data = JSON.parse(action.value), ctx = { team: body.team.id, user: body.user.id, config: data.c }
      await client.views.open({ trigger_id: body.trigger_id, view: await render(apiFor(client), ctx, action.action_id.slice(5), data) })
    } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Please try again', 'error', {}, [section(escape(e.message))]) }) }
  })
  app.view(/^work_.*_save$/, async ({ body, view, client, ack }) => {
    try {
      const data = JSON.parse(view.private_metadata), ctx = { team: body.team.id, user: body.user.id, config: data.c }, api = apiFor(client), action = view.callback_id.slice(5, -5)
      let next = 'todos', payload = { c: data.c }
      if (action === 'todo') await api.saveTodo(ctx, { ...data, detail: read(view, 'detail'), due: read(view, 'due'), status: read(view, 'status') }, data.request)
      else if (action === 'delete_todo') await api.deleteTodo(ctx, data.id)
      else if (action === 'poll') { payload.id = await api.createPoll(ctx, { title: read(view, 'title'), options: read(view, 'options') }, data.request); next = 'poll' }
      else if (action === 'vote') { await api.vote(ctx, data.id, Number(read(view, 'choice'))); next = 'poll'; payload.id = data.id }
      else if (action === 'close_poll') { await api.closePoll(ctx, data.id); next = 'poll'; payload.id = data.id }
      else if (action === 'report') { next = 'report_result'; payload = { ...payload, from: read(view, 'from'), to: read(view, 'to') } }
      else if (action === 'share_report') {
        await api.shareReport(ctx, data, data.request)
        return ack({ response_action: 'update', view: form('Report queued', 'read', {}, [section('Your report is queued for the channel. Delivery is checked every 15 minutes. Close this window to return to Kick.')]) })
      } else throw new Error('Unsupported submission.')
      await ack({ response_action: 'update', view: await render(api, ctx, next, payload) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } : { response_action: 'update', view: form('Please try again', 'error', {}, [section(escape(e.message))]) })
    }
  })
  return { render, apiFor }
}
module.exports = { registerProductivity }
