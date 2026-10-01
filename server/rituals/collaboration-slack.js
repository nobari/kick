const { createCollaboration, CARDS } = require('./collaboration')
const { escape, localTime } = require('./domain')
const { randomUUID } = require('node:crypto')
const { oauthScopes } = require('./capabilities')

function registerCollaboration({ app, bolt, store, engine, member, manage, modalClient, background, ui, canRemind, dmEnabled, schedulerEnabled }) {
  const { modal, section, button, input, field, select, option, text, read, context } = ui
  const value = data => JSON.stringify(data)
  const decode = data => { try { return JSON.parse(data) } catch { throw new Error('Open Kick Home and try again.') } }
  const buttons = (...elements) => ({ type: 'actions', elements })
  const b = (label, action, data) => button(label, `collab_${action}`, value(data))
  const form = (title, action, data, blocks, submit = 'Save') => modal(title, `collab_${action}_save`, value({ ...data, request: data.request || randomUUID() }), blocks, submit)
  const picker = (id, label, user) => input(id, label, { type: 'users_select', ...(user ? { initial_user: user } : {}) })
  const day = (id, label, initial, optional = false) => input(id, label, { type: 'datepicker', ...(initial ? { initial_date: initial } : {}) }, optional)
  function service(client) {
    const checked = new Map()
    return createCollaboration(store, engine, { authorize: (c, user, admin) => {
      const id = `${c.team}:${c.channel}:${c.owner}:${user}:${!!admin}`
      if (!checked.has(id)) checked.set(id, admin ? manage(client, c, user) : member(client, c.channel, user))
      return checked.get(id)
    } })
  }
  const ctxFor = (body, data) => ({ team: body.team.id, user: body.user.id, config: data.c })
  async function hub(api, ctx) {
    const c = await api.access(ctx)
    return form('Team workspace', 'hub', { c: c.id }, [
      section(`*${escape(c.name)} · <#${c.channel}>*\nChoose a tool. Records are shared with channel members and kept for ${c.retentionDays} days.`),
      buttons(b('Actions', 'actions', { c: c.id }), b('Sprints', 'sprints', { c: c.id }), b('Retrospectives', 'retros', { c: c.id })),
      buttons(b('Planning poker', 'poker', { c: c.id }), b('Search history', 'search', { c: c.id })),
      buttons(b('Calendar', 'calendar', { c: c.id }), b('Operations', 'operations', { c: c.id })),
      context('Calendar and operations are restricted to the workflow owner or a workspace admin. Retrospectives are attributed, not anonymous. Estimates are hidden until revealed.'),
    ], null)
  }
  async function actionForm(api, ctx, data) {
    const c = await api.access(ctx), records = await api.list(ctx, 'actions')
    const old = data.edit ? records.find(a => a.id === data.id) : null
    if (data.edit && !old) throw new Error('Action unavailable.')
    let initial = old?.detail || ''
    if (data.source && data.source !== 'message') {
      if (!['responses', 'blockers', 'topics'].includes(data.source)) throw new Error('Invalid source.')
      const source = await store.get(data.source, data.sourceId)
      if (!source || source.team !== ctx.team || source.config !== c.id || source.expiresAt <= Date.now()) throw new Error('Source unavailable.')
      initial = (source.detail || source.answers.join('\n')).slice(0, 1500)
    }
    const sprints = (await api.list(ctx, 'sprints')).filter(s => s.status === 'active' || s.id === old?.sprint).slice(0, 99)
    return form(old ? 'Edit action' : 'Track an action', 'action', { ...data, c: c.id, id: old?.id }, [
      section(`This action will be visible to members of <#${c.channel}>. Review the text before saving.`),
      field('detail', 'Action / next step', initial, false, true), picker('owner', 'Assignee', old?.owner || ctx.user),
      day('due', 'Due date', old?.due || localTime(Date.now(), c.zone).date),
      select('status', 'Status', [option('Open', 'open'), option('Done', 'done')], old?.status || 'open'),
      select('sprint', 'Link to sprint', [option('No sprint', 'none'), ...sprints.map(s => option(s.title.slice(0, 75), s.id))], old?.sprint || 'none'),
    ])
  }
  async function listing(api, ctx, kind, page = 0) {
    const c = await api.access(ctx), all = await api.list(ctx, kind), rows = all.slice(page * 8, page * 8 + 8)
    const labels = { actions: 'Actions', sprints: 'Sprints', retros: 'Retrospectives', poker: 'Planning poker' }
    const target = { actions: 'action', sprints: 'sprint', retros: 'retro', poker: 'estimate' }[kind]
    const blocks = [section(`*${escape(c.name)} · ${labels[kind]}*`), buttons(b(`New ${kind === 'retros' ? 'retrospective' : kind === 'poker' ? 'session' : kind.slice(0, -1)}`, `new_${target}`, { c: c.id }))]
    if (!rows.length) blocks.push(section('Nothing here yet. Create the first one when your team is ready.'))
    rows.forEach(r => blocks.push({ ...section(kind === 'actions' ? `*${r.status === 'done' ? 'Done' : 'Open'}* · Due ${r.due} · <@${r.owner}>\n${escape(r.detail).slice(0, 700)}` : `*${escape(r.title)}* · ${r.status}`), accessory: b('Open', target, { c: c.id, id: r.id, edit: true }) }))
    const nav = [b('Team workspace', 'hub', { c: c.id })]
    if (page) nav.push(b('Previous', kind, { c: c.id, page: page - 1 }))
    if (all.length > (page + 1) * 8) nav.push(b('Next', kind, { c: c.id, page: page + 1 }))
    blocks.push(buttons(...nav))
    return form(labels[kind], 'list', { c: c.id }, blocks, null)
  }
  async function retroView(api, ctx, data) {
    const r = await api.retroDetail(ctx, data.id), c = await api.access(ctx), page = Math.max(0, data.page || 0)
    const blocks = [section(`*${escape(r.title)}* · ${r.status}\nEvery topic and vote is attributed. One vote per person per topic; you can support multiple topics.`)]
    if (r.status === 'collecting') blocks.push(buttons(b('Add a topic', 'new_topic', { c: c.id, id: r.id })))
    if ([r.user, c.owner].includes(ctx.user) && r.status !== 'closed') blocks.push(buttons(
      b(r.status === 'collecting' ? 'Open voting' : 'Close retrospective', 'retro_phase', { c: c.id, id: r.id, status: r.status === 'collecting' ? 'voting' : 'closed' })))
    const topics = r.topics.sort((a, b) => (a.group || a.category).localeCompare(b.group || b.category) || b.votes - a.votes)
    if (!topics.length) blocks.push(section('No topics yet. Add something to keep, improve or try.'))
    topics.slice(page * 6, page * 6 + 6).forEach(t => {
      blocks.push(section(`*${escape(t.group || t.category)}* · <@${t.user}> · ${t.votes} votes\n${escape(t.detail)}`))
      const actions = [b('Track action', 'new_action', { c: c.id, source: 'topics', sourceId: t.id })]
      if (r.status === 'voting' && !t.voted) actions.push(b('Vote', 'vote', { c: c.id, id: t.id, retro: r.id }))
      if ([r.user, c.owner].includes(ctx.user) && r.status !== 'closed') actions.push(b('Group topic', 'group', { c: c.id, id: t.id, retro: r.id }))
      blocks.push(buttons(...actions))
    })
    const nav = [b('All retrospectives', 'retros', { c: c.id })]
    if (page) nav.push(b('Previous', 'retro', { ...data, page: page - 1 }))
    if (topics.length > (page + 1) * 6) nav.push(b('Next', 'retro', { ...data, page: page + 1 }))
    blocks.push(buttons(...nav))
    return form('Retrospective', 'read', data, blocks, null)
  }
  async function pokerView(api, ctx, data) {
    const p = await api.pokerDetail(ctx, data.id), c = await api.access(ctx)
    const blocks = [section(`*${escape(p.title)}*\nRound ${p.round} · ${p.status} · ${p.votes.length}/${p.members.length} voted`)]
    if (p.status === 'voting') blocks.push(section('Estimates stay hidden until the facilitator reveals them. Voting does not post your estimate to the channel.'))
    else blocks.push(section(p.votes.map(v => `<@${v.user}>: ${v.value}`).join('\n') || 'No estimates were submitted.'))
    if (p.decision) blocks.push(section(`*Recorded decision:* ${escape(p.decision)}`))
    if (p.status === 'voting' && p.members.includes(ctx.user)) blocks.push(buttons(b(p.myVote ? 'Change my estimate' : 'Estimate', 'cast', { c: c.id, id: p.id, round: p.round })))
    if ([p.user, c.owner].includes(ctx.user)) {
      if (p.status === 'voting') blocks.push(buttons(b('Reveal estimates', 'poker_phase', { c: c.id, id: p.id, status: 'revealed' })))
      if (p.status === 'revealed') blocks.push(buttons(b('Start another round', 'poker_phase', { c: c.id, id: p.id, status: 'voting' }), b('Record decision', 'decision', { c: c.id, id: p.id })))
    }
    blocks.push(buttons(b('Refresh', 'estimate', { c: c.id, id: p.id }), b('All sessions', 'poker', { c: c.id })))
    return form('Planning poker', 'read', data, blocks, null)
  }
  async function render(api, ctx, action, data, client) {
    const c = await api.access(ctx)
    if (action === 'hub') return hub(api, ctx)
    if (['actions', 'sprints', 'retros', 'poker'].includes(action)) return listing(api, ctx, action, Math.max(0, Math.floor(data.page || 0)))
    if (['new_action', 'action'].includes(action)) return actionForm(api, ctx, data)
    if (action === 'edit_update') {
      const r = (await api.list(ctx, 'responses')).find(r => r.id === data.id)
      if (!r || r.user !== ctx.user) throw new Error('Only the author can edit this update.')
      const run = await store.get('runs', r.run)
      return form('Edit your update', 'edit_update', { c: c.id, id: r.id, version: r.version }, [
        section('Before the digest closes, this replaces your saved answers. After closing, it adds a clearly labeled correction and queues it for the channel; the original digest stays unchanged.'),
        ...r.answers.map((a, i) => field(`q${i}`, run.questions[i], a, false, true)),
        ...(r.correction ? [section(`*Last correction:*\n${escape(r.correction).slice(0, 2200)}`)] : []),
      ], 'Save changes')
    }
    if (action === 'new_sprint') {
      await api.access(ctx, true)
      return form('New sprint', 'sprint', data, [field('title', 'Sprint name'), field('goal', 'Goal', '', false, true), day('start', 'Start date'), day('end', 'End date')])
    }
    if (action === 'sprint') {
      const s = (await api.list(ctx, 'sprints')).find(s => s.id === data.id)
      if (!s) throw new Error('Sprint unavailable.')
      const actions = (await api.list(ctx, 'actions')).filter(a => a.sprint === s.id)
      const updates = (await api.list(ctx, 'responses')).filter(r => localTime(r.at, c.zone).date >= s.start && localTime(r.at, c.zone).date <= s.end)
      const blocks = [section(`*${escape(s.title)}* · ${s.status}\n${s.start} – ${s.end}\n*Goal:* ${escape(s.goal)}`),
        section(`${actions.filter(a => a.status === 'done').length}/${actions.length} linked actions done · ${updates.length} workflow updates in this date range.`),
        ...actions.slice(0, 8).map(a => ({ ...section(`${a.status} · ${escape(a.detail).slice(0, 500)}`), accessory: b('Open action', 'action', { c: c.id, id: a.id, edit: true }) })),
        ...updates.slice(0, 4).map(r => ({ ...section(`Update by <@${r.user}> · ${localTime(r.at, c.zone).date}`), accessory: button('Read update', 'ritual_response', r.id) })),
        ...(s.recap ? [section(escape(s.recap))] : []), buttons(b('All sprints', 'sprints', { c: c.id })),
      ]
      if (s.status === 'active') {
        try { await api.access(ctx, true); blocks.push(buttons(b('Finish & share recap', 'close_sprint', data))) } catch { /* Read-only members. */ }
      }
      return form('Sprint', 'read', data, blocks, null)
    }
    if (action === 'close_sprint') return form('Finish sprint?', 'close_sprint', data, [section('Close this sprint and queue a factual recap for the channel? It includes the goal, dates, completed action count and retained update count. This cannot be undone.')], 'Finish sprint')
    if (action === 'new_retro') return form('New retrospective', 'retro', data, [section('Topics and votes are attributed to members. This is not anonymous.'), field('title', 'Retrospective name')])
    if (action === 'retro') return retroView(api, ctx, data)
    if (action === 'retro_phase') return form('Change retro phase?', 'retro_phase', data, [section(data.status === 'voting' ? 'End topic collection and open voting? Members can support each topic once.' : 'Close voting? Existing topics can still become actions, but no new votes or topics will be accepted.')], 'Confirm')
    if (action === 'new_topic') return form('Add a topic', 'topic', data, [section('Your name is shown with this topic.'), select('category', 'Category', ['Keep', 'Improve', 'Try'].map(x => option(x, x)), 'Keep'), field('detail', 'What would you like to discuss?', '', false, true)])
    if (action === 'group') return form('Group topic', 'group', data, [field('group', 'Group name'), context('Use the same group name on related topics to collect them together. Original authorship is preserved.')])
    if (action === 'vote') { await api.vote(ctx, data.id); return retroView(api, ctx, { c: c.id, id: data.retro }) }
    if (action === 'new_estimate') return form('New planning session', 'poker', data, [field('title', 'Work item to estimate'), input('members', 'Voters (channel members)', { type: 'multi_users_select', max_selected_items: 50, initial_users: [ctx.user] }), context('Use numbers, ? for unsure, or Abstain. Estimates are hidden until reveal; names and estimates become visible afterward.')])
    if (action === 'estimate') return pokerView(api, ctx, data)
    if (action === 'cast') return form('Your estimate', 'cast', data, [select('value', 'Estimate', CARDS.map(v => option(v === 'abstain' ? 'Abstain' : v, v)), '?'), context('You can change your estimate while this round is open.')], 'Vote')
    if (action === 'poker_phase') return form('Change voting phase?', 'poker_phase', data, [section(data.status === 'revealed' ? 'Reveal the submitted estimates to channel members? People who have not voted will be shown as pending.' : 'Start a fresh round with hidden estimates? Previous rounds remain in retained history but do not count in the new round.')], 'Confirm')
    if (action === 'decision') return form('Record decision', 'decision', data, [field('decision', 'Agreed estimate / decision'), context('This closes the session. The decision is visible to channel members.')])
    if (action === 'search') return form('Search Kick history', 'search', { c: c.id }, [
      section(`Search retained Kick records for *${escape(c.name)}* in <#${c.channel}>. This does not search Slack messages. Dates use UTC.`),
      field('query', 'Words or phrase (optional)', '', true), input('user', 'Author / action assignee (optional)', { type: 'users_select' }, true),
      select('status', 'Status', [option('Any', 'any'), option('Open actions / blockers', 'open'), option('Done / submitted', 'done')], 'any'),
      day('from', 'From (optional)', '', true), day('to', 'Through (optional)', '', true),
    ], 'Search')
    if (action === 'results') {
      const results = await api.search(ctx, data.filters), blocks = [section('Results from retained Kick records only.')]
      results.slice(0, 20).forEach(r => blocks.push(section(`*${r.kind} · ${r.status}* · <@${r.author}> · ${new Date(r.at).toISOString().slice(0, 10)}\n${escape(r.detail).slice(0, 1400)}`)))
      if (!results.length) blocks.push(section('No matching records. Try fewer filters or another workflow.'))
      const nav = [b('New search', 'search', { c: c.id })], offset = data.filters.offset || 0
      if (offset > 0) nav.push(b('Previous', 'results', { ...data, filters: { ...data.filters, offset: Math.max(0, offset - 20) } }))
      if (results.length > 20) nav.push(b('Next', 'results', { ...data, filters: { ...data.filters, offset: offset + 20 } }))
      blocks.push(buttons(...nav))
      return form('Search results', 'read', data, blocks, null)
    }
    if (action === 'calendar') {
      await api.access(ctx, true)
      const upcoming = (await api.list(ctx, 'calendar')).filter(e => e.date >= localTime(Date.now(), c.zone).date).sort((a, b) => a.date.localeCompare(b.date))
      return form('Calendar exception', 'calendar', { c: c.id }, [
        section(`*${escape(c.name)}* · ${escape(c.zone)}\nSkip a holiday or override one date’s check-in times. Applies only before that day’s check-in opens. Dates must be within the retention window.`),
        ...upcoming.slice(0, 12).map(e => section(`${e.date}: ${e.skip ? 'Skipped' : `${e.time}–${e.digestTime}`}`)),
        day('date', 'Date'), select('mode', 'This date', [option('Skip check-in', 'skip'), option('Use custom times (even on a day off)', 'override')], 'skip'),
        input('time', 'Check-in opens (override only)', { type: 'timepicker', initial_time: c.time }),
        input('digest', 'Digest (override only)', { type: 'timepicker', initial_time: c.digestTime }),
        context('To undo a skip, save the same date with custom times. Existing runs keep their original closing time.'),
      ])
    }
    if (action === 'operations') {
      const o = await api.operations(ctx), auth = await client.auth.test(), reminders = dmEnabled && await canRemind(ctx.team)
      const granted = auth.response_metadata?.scopes
      const missing = granted && oauthScopes({ KICK_OAUTH_DM_SCOPE_ENABLED: 'true' }).filter(scope => !granted.includes(scope))
      const blocks = [section(`*${escape(c.name)} · Operations*\nInstallation: ${auth.ok ? 'connected' : 'needs attention'}\nScheduler configured: ${schedulerEnabled ? 'yes' : 'no'} · Workflow: ${c.enabled ? 'enabled' : 'paused'}\nPrivate reminders: ${reminders ? 'available' : 'unavailable'}\nLast schedule error: ${escape(c.lastError || 'none')}\nNext check due: ${new Date(c.nextAt).toISOString()}`),
        section(`*Slack permissions*\n${granted ? missing.length ? `Missing from the published permission set: ${missing.join(', ')}. Reinstall through the website to grant approved permissions.` : 'All seven published bot permissions are granted.' : 'Slack did not return scope metadata for this check. Permission status is unverified.'}`),
        section(`Retained deliveries: ${o.jobs.filter(j => j.status === 'sent').length} sent · ${o.jobs.filter(j => j.status === 'failed').length} failed · ${o.jobs.filter(j => !j.done).length} queued.\nOnly failed deliveries can be retried. Ambiguous network failures can still produce duplicates in Slack.`)]
      o.jobs.filter(j => j.status === 'failed').slice(0, 8).forEach(j => blocks.push({ ...section(`${j.kind} · ${escape(j.lastError || 'delivery_error')} · ${j.attempts} attempts`), accessory: b('Review retry', 'retry', { c: c.id, id: j.id }) }))
      blocks.push(section('*Recent configuration and operations audit*'))
      o.audit.slice(0, 10).forEach(a => blocks.push(section(`${new Date(a.at).toISOString().slice(0, 16)} UTC · <@${a.user}>\n${escape(a.event)} · ${escape(a.detail)}`)))
      blocks.push(buttons(b('Refresh', 'operations', { c: c.id }), b('Team workspace', 'hub', { c: c.id })))
      return form('Operations', 'read', data, blocks, null)
    }
    if (action === 'retry') { await api.access(ctx, true); return form('Retry delivery?', 'retry', data, [section('Queue this failed delivery again with the same message identity? Kick rechecks expiry, workflow status, recipient eligibility and lease ownership before sending. Slack delivery is not guaranteed exactly once.')], 'Retry') }
    throw new Error('Choose a tool from Kick Home.')
  }
  app.action(/^collab_/, async ({ body, action, client }) => {
    try {
      const data = decode(action.value), api = service(client), ctx = ctxFor(body, data)
      await client.views.open({ trigger_id: body.trigger_id, view: await render(api, ctx, action.action_id.slice(7), data, client) })
    } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Please try again', 'error', {}, [section(escape(e.message))], null) }) }
  })
  app.view(/^collab_.*_save$/, async ({ body, view, client, ack }) => {
    try {
      const data = decode(view.private_metadata), api = service(client), ctx = ctxFor(body, data), action = view.callback_id.slice(7, -5), request = data.request
      if (typeof request !== 'string' || request.length > 100) throw new Error('Reopen this form from Kick Home.')
      let next = 'hub', nextData = { c: data.c }
      if (action === 'action') {
        await api.action(ctx, { ...data, detail: read(view, 'detail'), owner: read(view, 'owner'), due: read(view, 'due'), status: read(view, 'status'), sprint: read(view, 'sprint') === 'none' ? null : read(view, 'sprint') }, request)
        next = 'actions'
      } else if (action === 'edit_update') {
        const response = (await api.list(ctx, 'responses')).find(r => r.id === data.id)
        if (!response) throw new Error('Update unavailable.')
        await api.editResponse(ctx, data.id, data.version, response.answers.map((_, i) => read(view, `q${i}`)), request)
      } else if (action === 'sprint' || action === 'close_sprint') {
        const id = await api.sprint(ctx, action === 'sprint' ? { title: read(view, 'title'), goal: read(view, 'goal'), start: read(view, 'start'), end: read(view, 'end') } : { id: data.id }, request)
        next = 'sprint'; nextData.id = id
      } else if (action === 'retro' || action === 'retro_phase') {
        const id = await api.retro(ctx, action === 'retro' ? { title: read(view, 'title') } : { id: data.id, status: data.status }, request)
        next = 'retro'; nextData.id = id
      } else if (action === 'topic' || action === 'group') {
        await api.topic(ctx, action === 'topic' ? { retro: data.id, category: read(view, 'category'), detail: read(view, 'detail') } : { id: data.id, retro: data.retro, group: read(view, 'group') }, request)
        next = 'retro'; nextData.id = data.retro || data.id
      } else if (['poker', 'cast', 'poker_phase', 'decision'].includes(action)) {
        const payload = action === 'poker' ? { title: read(view, 'title'), members: read(view, 'members') } : action === 'cast' ? { id: data.id, round: data.round, value: read(view, 'value') } : { id: data.id, status: action === 'decision' ? 'closed' : data.status, decision: read(view, 'decision') }
        nextData.id = await api.poker(ctx, payload, request); next = 'estimate'
      } else if (action === 'search') {
        next = 'results'; nextData.filters = { query: read(view, 'query'), user: read(view, 'user'), status: read(view, 'status') === 'any' ? '' : read(view, 'status'), from: read(view, 'from'), to: read(view, 'to'), offset: 0 }
      } else if (action === 'calendar') {
        await api.calendar(ctx, { date: read(view, 'date'), skip: read(view, 'mode') === 'skip', time: read(view, 'time'), digestTime: read(view, 'digest') }, request); next = 'calendar'
      } else if (action === 'retry') { await api.retry(ctx, data.id, request); next = 'operations' }
      else if (action === 'shortcut') {
        const selected = read(view, 'workflow'), c = await api.access({ ...ctx, config: selected })
        if (c.channel !== data.channel) throw new Error('Choose a workflow from the source channel.')
        await api.shortcut({ ...ctx, config: selected }, data.kind, { detail: read(view, 'detail'), owner: read(view, 'owner'), due: read(view, 'due'), sourceId: data.ts }, request)
        nextData.c = selected
      } else throw new Error('Unsupported submission.')
      await ack({ response_action: 'update', view: await render(api, { ...ctx, config: nextData.c }, next, nextData, client) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } : { response_action: 'update', view: form('Please try again', 'error', {}, [section(escape(e.message))], null) })
    }
  })
  bolt.shortcut(/^kick_(track_action|report_blocker|give_kudos)$/, async args => {
    await args.ack()
    background(async () => {
      const { body } = args, client = await modalClient(args.client, body.trigger_id)
      try {
        const channel = body.channel?.id, team = body.team.id, user = body.user.id
        await member(client, channel, user)
        const configs = (await store.list('configs', 'team', '==', team)).filter(c => c.channel === channel).slice(0, 100)
        if (!configs.length) throw new Error('Set up a workflow in this channel with /sync setup first.')
        const kind = { kick_track_action: 'action', kick_report_blocker: 'blocker', kick_give_kudos: 'kudos' }[body.callback_id]
        const data = { c: configs[0].id, channel, ts: body.message?.ts, kind }
        await client.views.open({ trigger_id: body.trigger_id, view: form('Review before sharing', 'shortcut', data, [
          section(`Review the selected message text below. Only the text you confirm is saved. ${kind === 'kudos' ? 'Your thanks will also be queued for this channel.' : 'The saved record is visible to channel members in Kick.'}`),
          select('workflow', 'Workflow', configs.map(c => option(c.name.slice(0, 75), c.id)), configs[0].id),
          field('detail', kind === 'kudos' ? 'Why are you thanking them?' : 'Action / blocker', (body.message?.text || '').slice(0, 1500), false, true),
          picker('owner', kind === 'kudos' ? 'Teammate to thank' : kind === 'blocker' ? 'Helper' : 'Assignee', kind === 'kudos' ? undefined : user),
          ...(kind === 'action' ? [day('due', 'Due date')] : []),
          context('Cancel to discard. Kick does not fetch surrounding messages or save message attachments.'),
        ], 'Confirm') })
      } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Shortcut unavailable', 'error', {}, [section(escape(e.message))], null) }) }
    })
  })
  return { render, service }
}
module.exports = { registerCollaboration }
