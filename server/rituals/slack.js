const { TEMPLATES, validateConfig, validTime, localTime, escape, DAY } = require('./domain')
const { key } = require('./store')
const { text, button, section } = require('./engine')
const { waitUntil } = require('@vercel/functions')
const background = work => waitUntil(work().catch(e => console.error('Kick workflow failed:', e.data?.error || e.code || 'unknown_error')))
const option = (label, value) => ({ text: text(label), value: String(value) })
const input = (id, label, element, optional = false) => ({ type: 'input', block_id: id, label: text(label), optional, element: { action_id: 'value', ...element } })
const field = (id, label, value = '', optional = false, multiline = false) => input(id, label, {
  type: 'plain_text_input', ...(value ? { initial_value: value } : {}), multiline, max_length: multiline ? 1500 : 150
}, optional)
const select = (id, label, values, value) => input(id, label, { type: 'static_select', options: values,
  initial_option: values.find(o => o.value === String(value)) || values[0] })
const read = (view, id) => {
  const v = view.state.values[id]?.value || {}
  return v.value ?? v.selected_option?.value ?? v.selected_options?.map(o => o.value) ?? v.selected_users ?? v.selected_user ?? v.selected_conversation ?? v.selected_date ?? ''
}
const modal = (title, callback, channel, blocks, submit = 'Save') => ({ type: 'modal', callback_id: callback,
  private_metadata: channel, title: text(title), close: text('Cancel'), ...(submit ? { submit: text(submit) } : {}), blocks })
function registerRituals(bolt, store, engine, { schedulerEnabled = process.env.KICK_SCHEDULER_ENABLED === 'true', dmEnabled = process.env.KICK_RITUALS_DM_ENABLED === 'true' } = {}) {
  // Keep the signed HTTP acknowledgment under Slack's deadline, while Vercel
  // retains the invocation until the modal/database work finishes.
  const loading = () => modal('Kick', 'ritual_loading', '', [section('Loading your team workspace…')], null)
  async function modalClient(client, trigger) {
    const result = await client.views.open({ trigger_id: trigger, view: loading() })
    return { ...client, views: { ...client.views, open: ({ view }) => client.views.update({ view_id: result.view.id, view }) } }
  }
  const app = {
    event: (pattern, fn) => bolt.event(pattern, async args => { background(() => fn(args)) }),
    action: (pattern, fn) => bolt.action(pattern, async args => {
      await args.ack()
      background(async () => fn({ ...args, ack: async () => {}, client: args.action.action_id === 'ritual_channel' ? args.client : await modalClient(args.client, args.body.trigger_id) }))
    }),
    view: (pattern, fn) => bolt.view(pattern, async args => {
      await args.ack({ response_action: 'update', view: loading() })
      background(() => fn({ ...args, ack: async response => {
        let view = response.view
        if (response.response_action === 'errors') {
          // Restore the entered values after async validation rather than losing a draft.
          const blocks = args.view.blocks.map(b => {
            if (b.type !== 'input') return b
            const v = args.view.state.values[b.block_id]?.value || {}, element = { ...b.element }
            const mappings = { value: 'initial_value', selected_option: 'initial_option', selected_options: 'initial_options', selected_users: 'initial_users', selected_user: 'initial_user', selected_date: 'initial_date', selected_conversation: 'initial_conversation' }
            for (const [source, target] of Object.entries(mappings)) if (v[source]) element[target] = v[source]
            return { ...b, element }
          })
          view = modal(args.view.title.text, args.view.callback_id, args.view.private_metadata, [section(escape(Object.values(response.errors).join('\n'))), ...blocks], args.view.submit?.text || 'Save')
        }
        await args.client.views.update({ view_id: args.view.id, view })
      } }))
    }),
    use: fn => bolt.use(fn)
  }
  async function member(client, channel, user) {
    // Public channels only: no additional private-channel history access is requested.
    const info = await client.conversations.info({ channel })
    if (info.channel.is_private || info.channel.is_im || info.channel.is_mpim || info.channel.is_archived)
      throw new Error('Choose an active public channel.')
    let cursor
    do {
      const result = await client.conversations.members({ channel, cursor, limit: 200 })
      if (result.members.includes(user)) return
      cursor = result.response_metadata?.next_cursor
    } while (cursor)
    throw new Error('Join this channel before using its team workflows.')
  }
  async function manage(client, c, user) {
    await member(client, c.channel, user)
    if (c.owner === user) return
    const result = await client.users.info({ user })
    if (!result.user.is_admin && !result.user.is_owner) throw new Error('Only the workflow owner or a workspace admin can change these settings.')
  }
  async function setupView(team, channel) {
    const c = await engine.config(team, channel) || { zone: 'Asia/Tokyo', time: '09:30', digestTime: '17:00',
      days: [1, 2, 3, 4, 5], members: [], template: 'standup', questions: TEMPLATES.standup, retentionDays: 30 }
    return modal('Set up team rituals', 'ritual_setup_save', channel, [
      section(`Choose a schedule and participants, then preview before enabling. Updates and blockers are visible to channel members. Retention affects new workflow data in Kick, not Slack messages or core command history.${schedulerEnabled ? '' : ' Automatic scheduling is not activated yet; save as Paused.'}${dmEnabled ? '' : ' Private reminders are not activated yet.'}`),
      select('enabled', 'Scheduled check-ins', [option('Enabled', 'yes'), option('Paused', 'no')], c.enabled ? 'yes' : 'no'),
      field('zone', 'IANA time zone (e.g. Asia/Tokyo)', c.zone),
      field('time', 'Check-in time (24-hour HH:MM)', c.time), field('digest', 'Digest time (same day)', c.digestTime),
      input('days', 'Check-in days', { type: 'multi_static_select', options: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(option),
        initial_options: c.days.map(d => option(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d], d)) }),
      input('members', 'Participants (up to 50 channel members)', { type: 'multi_users_select', max_selected_items: 50,
        ...(c.members.length ? { initial_users: c.members } : {}) }),
      select('template', 'Template', [option('Daily standup', 'standup'), option('Weekly wins', 'wins'), option('Retrospective', 'retro'), option('Custom questions', 'custom')], c.template),
      field('questions', 'Custom only: one question per line (1–5)', c.template === 'custom' ? c.questions.join('\n') : '', true, true),
      select('roundup', 'Friday appreciation roundup', [option('Off', 'no'), option('On', 'yes')], c.roundup ? 'yes' : 'no'),
      select('retention', 'Keep new workflow records for', [option('7 days', 7), option('30 days', 30), option('90 days', 90)], c.retentionDays)
    ], 'Preview')
  }
  async function preferencesView(team, user) {
    const p = await store.get('prefs', key(team, user)) || {}
    return modal('Your preferences', 'ritual_preferences_save', '', [
      section('These settings control your private reminders and blocker follow-ups. Quiet hours use your own time zone. Leave also excludes you from new check-ins.'),
      select('disabled', 'Private reminders', [option('On', 'no'), option('Off', 'yes')], p.disabled ? 'yes' : 'no'),
      field('zone', 'Your IANA time zone', p.zone || 'Asia/Tokyo'),
      field('start', 'Quiet hours start (HH:MM)', p.quietStart || '18:00'),
      field('end', 'Quiet hours end (HH:MM)', p.quietEnd || '09:00'),
      input('leave', 'On leave through (optional; clear to return)', { type: 'datepicker', ...(p.leaveUntil ? { initial_date: p.leaveUntil } : {}) }, true)
    ])
  }
  async function checkinView(team, channel, user) {
    const c = await engine.config(team, channel)
    const run = c && await engine.currentRun(c)
    if (!run || !run.members.includes(user)) throw new Error('No check-in is open for you. Ask the workflow owner about the schedule and participants.')
    if (await store.get('responses', key(run.id, user))) throw new Error('Your update is already saved. Thank you!')
    return modal('Team check-in', 'ritual_checkin_save', channel, [
      section(`Your answers will appear in the channel digest. Retained by Kick for ${c.retentionDays} days.`),
      ...run.questions.map((q, i) => field(`q${i}`, q, '', false, true)),
      field('blocker', 'Anything blocking you? (optional)', '', true, true),
      input('helper', 'Who could help? (optional)', { type: 'users_select' }, true)
    ], 'Submit')
  }
  async function home(client, team, user, chosen) {
    const configs = await store.list('configs', 'team', '==', team)
    const accessible = []
    for (const c of configs) {
      try { await member(client, c.channel, user); accessible.push(c) } catch { /* Membership is checked before disclosing data. */ }
    }
    const c = accessible.find(c => c.channel === chosen) || accessible.find(c => c.members.includes(user)) || accessible[0]
    const blocks = [section('*Kick · Small rituals. Stronger teams*\nCheck in, unblock your team, and celebrate contributions.'),
      { type: 'actions', elements: [button('Set up a channel', 'ritual_choose', 'setup'), button('My preferences', 'ritual_preferences', 'home')] }]
    if (!c) blocks.push(section('Welcome! Choose “Set up a channel” to preview a schedule, or use `/sync setup` in a public channel. Existing `/sync`, `/kudos`, `/coins`, and `/pick` commands still work.'))
    else {
      blocks.push({ type: 'actions', elements: [{ type: 'static_select', action_id: 'ritual_channel',
        placeholder: text('Choose a team'), options: accessible.slice(0, 100).map(x => option(x.channel, x.channel)), initial_option: option(c.channel, c.channel) }] })
      blocks.push(section(`*<#${c.channel}>* · ${c.enabled ? 'Active' : 'Paused'}\n${c.time} → ${c.digestTime} (${escape(c.zone)}) · ${c.retentionDays}-day retention${c.lastError ? '\n⚠️ Scheduler needs attention. Ask the owner to check deployment logs.' : ''}`),
        { type: 'actions', elements: [button('Share update', 'ritual_checkin', c.channel), button('Channel settings', 'ritual_setup', c.channel), button('Fair rotation', 'ritual_rotate', c.channel)] })
      const d = await engine.dataset(c), run = d.runs.sort((a, b) => b.at - a.at)[0]
      if (run) {
        const responses = d.responses.filter(r => r.run === run.id)
        blocks.push(section(`*Latest check-in · ${run.date}*\n${responses.length}/${run.members.length} responses. ${responses.some(r => r.user === user) ? 'Your update is saved.' : 'You have not submitted an update.'}`))
        responses.slice(0, 8).forEach(r => blocks.push(section(`<@${r.user}>: ${r.answers.map(escape).join('\n').slice(0, 1800)}`)))
        blocks.push({ type: 'actions', elements: [button('Read all updates', 'ritual_updates', `${c.channel}:0`)] })
      }
      const open = d.blockers.filter(b => !b.resolvedAt)
      blocks.push(section(`*Open blockers · ${open.length}*`))
      open.slice(0, 8).forEach(b => blocks.push({ ...section(`${escape(b.detail).slice(0, 1500)}\nReported by <@${b.user}> · Helper <@${b.helper}>`), accessory: button('Resolve / assign', 'ritual_blocker', b.id) }))
      if (open.length > 8) blocks.push({ type: 'actions', elements: [button('Browse all blockers', 'ritual_blockers', `${c.channel}:0`)] })
      const [week, previous] = await engine.insights(c)
      blocks.push(section(`*Team trends · rolling 7 days vs previous 7*\nParticipation: ${week.participation ?? '—'}% vs ${previous.participation ?? '—'}%\nNew blockers: ${week.blockers} vs ${previous.blockers} · Resolved: ${week.resolved} vs ${previous.resolved}\nTeam aggregates only. No individual productivity scores. ${c.retentionDays < 14 ? 'Previous period is incomplete due to retention.' : ''}`))
      blocks.push(section('*Recent appreciation*'))
      d.recognition.sort((a, b) => b.at - a.at).slice(0, 5).forEach(r => blocks.push(section(`<@${r.from}> → <@${r.to}>: ${escape(r.reason || 'Thank you!')}`)))
    }
    await client.views.publish({ user_id: user, view: { type: 'home', blocks } })
  }
  async function open(client, trigger, view) { return client.views.open({ trigger_id: trigger, view }) }
  async function openError(client, trigger, error) {
    await open(client, trigger, modal('Kick', 'ritual_error', '', [section(escape(error.message))], null))
  }
  app.event('app_home_opened', async ({ event, body, client }) => { if (event.tab === 'home') await home(client, body.team_id, event.user) })
  app.action(/^ritual_/, async ({ ack, body, action, client }) => {
    await ack()
    const team = body.team.id, user = body.user.id, channel = action.value
    try {
      if (action.action_id === 'ritual_channel') return home(client, team, user, action.selected_option.value)
      if (action.action_id === 'ritual_choose') return open(client, body.trigger_id, modal('Choose a channel', 'ritual_choose_save', '', [input('channel', 'Public channel', { type: 'conversations_select', filter: { include: ['public'], exclude_bot_users: true } })], 'Continue'))
      if (action.action_id === 'ritual_preferences') return open(client, body.trigger_id, await preferencesView(team, user))
      if (action.action_id === 'ritual_snooze') {
        await store.set('prefs', key(team, user), { team, user, snoozeUntil: Date.now() + 3600000 })
        return open(client, body.trigger_id, modal('Reminders snoozed', 'ritual_error', '', [section('Private reminders are paused for one hour.')], null))
      }
      if (['ritual_updates', 'ritual_blockers'].includes(action.action_id)) {
        const [selected, offset] = channel.split(':'); const page = Math.max(0, Number(offset) || 0)
        await member(client, selected, user)
        const c = await engine.config(team, selected), d = await engine.dataset(c)
        const isUpdates = action.action_id === 'ritual_updates'
        const items = isUpdates ? d.responses.sort((a, b) => b.at - a.at) : d.blockers.filter(b => !b.resolvedAt).sort((a, b) => a.at - b.at)
        const blocks = items.slice(page * 10, page * 10 + 10).map(r => ({ ...section(isUpdates ? `<@${r.user}> · ${localTime(r.at, c.zone).date}` : escape(r.detail)),
          accessory: button(isUpdates ? 'Read update' : 'Resolve / assign', isUpdates ? 'ritual_response' : 'ritual_blocker', r.id) }))
        if (!blocks.length) blocks.push(section('No records to show.'))
        const nav = []
        if (page > 0) nav.push(button('Previous', action.action_id, `${selected}:${page - 1}`))
        if ((page + 1) * 10 < items.length) nav.push(button('Next', action.action_id, `${selected}:${page + 1}`))
        if (nav.length) blocks.push({ type: 'actions', elements: nav })
        return open(client, body.trigger_id, modal(isUpdates ? 'Team updates' : 'Team blockers', 'ritual_browse', '', blocks, null))
      }
      if (action.action_id === 'ritual_response') {
        const r = await store.get('responses', channel)
        if (!r || r.team !== team || r.expiresAt <= Date.now()) throw new Error('Update unavailable.')
        const c = await store.get('configs', r.config); await member(client, c.channel, user)
        const run = await store.get('runs', r.run)
        return open(client, body.trigger_id, modal('Team update', 'ritual_read', '', [section(`<@${r.user}> · ${localTime(r.at, c.zone).date}`),
          ...r.answers.map((a, i) => section(`*${escape(run?.questions[i] || 'Update')}*\n${escape(a)}`))], null))
      }
      if (action.action_id === 'ritual_blocker') {
        const b = await store.get('blockers', channel)
        if (!b || b.team !== team || b.expiresAt <= Date.now()) throw new Error('This blocker is no longer available.')
        const c = await store.get('configs', b.config)
        await member(client, c.channel, user)
        if (![b.user, b.helper, c.owner].includes(user)) await manage(client, c, user)
        return open(client, body.trigger_id, modal('Resolve or assign', 'ritual_blocker_save', b.id, [section(escape(b.detail)),
          select('status', 'Status', [option('Open', 'open'), option('Resolved', 'resolved')], b.resolvedAt ? 'resolved' : 'open'),
          input('helper', 'Helper', { type: 'users_select', initial_user: b.helper })]))
      }
      await member(client, channel, user)
      if (action.action_id === 'ritual_setup') {
        const c = await engine.config(team, channel)
        if (c) await manage(client, c, user)
        return open(client, body.trigger_id, await setupView(team, channel))
      }
      if (action.action_id === 'ritual_checkin') return open(client, body.trigger_id, await checkinView(team, channel, user))
      if (action.action_id === 'ritual_rotate') return open(client, body.trigger_id, modal('Fair team rotation', 'ritual_rotate_save', channel, [
        section('Choose the least recently selected participant. Excluded people keep their place for next time.'),
        field('reason', 'What is this rotation for?', '', true), input('exclude', 'Exclude this time', { type: 'multi_users_select' }, true)
      ], 'Pick'))
    } catch (e) { await openError(client, body.trigger_id, e) }
  })
  app.view(/^ritual_.*_save$/, async ({ ack, body, view, client }) => {
    const team = body.team.id, user = body.user.id, channel = view.private_metadata
    try {
      if (view.callback_id === 'ritual_choose_save') {
        const selected = read(view, 'channel')
        await member(client, selected, user)
        const c = await engine.config(team, selected)
        if (c) await manage(client, c, user)
        return ack({ response_action: 'update', view: await setupView(team, selected) })
      }
      if (view.callback_id === 'ritual_preferences_save') {
        const zone = read(view, 'zone'), quietStart = read(view, 'start'), quietEnd = read(view, 'end')
        try { localTime(Date.now(), zone) } catch { throw new Error('Enter a valid IANA time zone.') }
        if (!zone || !validTime(quietStart) || !validTime(quietEnd)) throw new Error('Use HH:MM quiet-hour times.')
        await store.set('prefs', key(team, user), { team, user, zone, quietStart, quietEnd, disabled: read(view, 'disabled') === 'yes', leaveUntil: read(view, 'leave') || null })
      } else if (view.callback_id === 'ritual_setup_save') {
        await member(client, channel, user)
        const existing = await engine.config(team, channel)
        if (existing) await manage(client, existing, user)
        const template = read(view, 'template')
        const c = validateConfig({ team, channel, owner: existing?.owner || user, enabled: read(view, 'enabled') === 'yes',
          zone: read(view, 'zone'), time: read(view, 'time'), digestTime: read(view, 'digest'), days: read(view, 'days').map(Number),
          members: read(view, 'members'), template, questions: template === 'custom' ? read(view, 'questions').split('\n').map(q => q.trim()).filter(Boolean) : TEMPLATES[template],
          roundup: read(view, 'roundup') === 'yes', retentionDays: Number(read(view, 'retention')) })
        // Store draft server-side: never trust a client-supplied serialized configuration.
        const draftId = key(team, user, view.id)
        await store.set('drafts', draftId, { ...c, editor: user, expiresAt: Date.now() + 15 * 60000 })
        return ack({ response_action: 'update', view: modal('Preview team ritual', 'ritual_confirm_save', draftId, [
          section(`*<#${channel}> · ${c.enabled ? 'Enable' : 'Pause'}*\n${c.time} check-in · ${c.digestTime} digest · ${escape(c.zone)}\nDays: ${c.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}\n${c.members.length} participants · ${c.retentionDays}-day retention\nFriday roundup: ${c.roundup ? 'On' : 'Off'}`),
          section(`*Check-in preview*\n${c.questions.map((q, i) => `${i + 1}. ${escape(q)}`).join('\n')}\nOptional blocker and helper.`),
          section(dmEnabled ? 'One private reminder after one hour, subject to personal preferences. Unresolved blockers get weekday follow-ups. Use channel settings to pause at any time.' : 'Private reminders and helper follow-ups are disabled until Slack permissions are approved. Use channel settings to pause at any time.')
        ], 'Confirm') })
      } else if (view.callback_id === 'ritual_confirm_save') {
        const draft = await store.get('drafts', channel)
        if (!draft || draft.team !== team || draft.editor !== user || draft.expiresAt <= Date.now()) throw new Error('Setup preview expired. Start setup again.')
        const c = await engine.config(team, draft.channel)
        if (c) await manage(client, c, user); else await member(client, draft.channel, user)
        // Validate the selected participant set once, using paginated channel membership.
        const members = new Set(); let cursor
        do { const r = await client.conversations.members({ channel: draft.channel, cursor, limit: 200 }); r.members.forEach(u => members.add(u)); cursor = r.response_metadata?.next_cursor } while (cursor)
        if (draft.members.some(u => !members.has(u))) throw new Error('All participants must belong to the selected channel.')
        for (let start = 0; start < draft.members.length; start += 5) {
          const users = await Promise.all(draft.members.slice(start, start + 5).map(user => client.users.info({ user })))
          if (users.some(r => r.user.is_bot || r.user.deleted || r.user.id === 'USLACKBOT')) throw new Error('Choose active human participants, not bots or deactivated accounts.')
        }
        const { id, expiresAt, editor, ...settings } = draft
        if (settings.enabled && !schedulerEnabled) throw new Error('Automatic schedules are not activated yet. Save this setup as Paused; an administrator must connect the scheduler first.')
        await store.set('configs', engine.configId(team, draft.channel), { ...settings, nextAt: Date.now(), updatedAt: Date.now(), leaseUntil: 0, leaseOwner: null })
        // Shorter retention applies to already-stored new-workflow records as well.
        if (store.shortenRetention) await store.shortenRetention(engine.configId(team, draft.channel), settings.retentionDays)
        else for (const kind of ['runs', 'responses', 'blockers', 'recognition', 'rotations', 'jobs']) {
          const records = await store.list(kind, 'config', '==', engine.configId(team, draft.channel))
          for (const record of records) {
            const expiry = (record.at || Date.now()) + settings.retentionDays * DAY
            if (record.expiresAt > expiry) await store.set(kind, record.id, { expiresAt: expiry })
          }
        }
      } else if (view.callback_id === 'ritual_blocker_save') {
        const b = await store.get('blockers', channel)
        if (!b || b.team !== team || b.expiresAt <= Date.now()) throw new Error('Blocker unavailable.')
        const c = await store.get('configs', b.config)
        await member(client, c.channel, user)
        if (![b.user, b.helper, c.owner].includes(user)) await manage(client, c, user)
        const helper = read(view, 'helper'); await member(client, c.channel, helper)
        await store.set('blockers', b.id, { helper, resolvedAt: read(view, 'status') === 'resolved' ? Date.now() : null, updatedBy: user })
      } else {
        await member(client, channel, user)
        const c = await engine.config(team, channel)
        if (!c?.enabled) throw new Error('Configure and enable this channel first with /sync setup.')
        if (view.callback_id === 'ritual_checkin_save') {
          const helper = read(view, 'helper')
          if (helper) await member(client, channel, helper)
          const run = await engine.currentRun(c)
          if (!run) throw new Error('This check-in has closed.')
          await engine.submit(c, user, run.questions.map((_, i) => read(view, `q${i}`)), read(view, 'blocker'), helper)
        } else if (view.callback_id === 'ritual_rotate_save') {
          await engine.rotate(c, read(view, 'exclude') || [], read(view, 'reason'), view.id)
        }
      }
      await ack({ response_action: 'update', view: modal('Saved', 'ritual_done', '', [section('Saved successfully. Open Kick’s Home tab to see the latest team information.')], null) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } :
        { response_action: 'update', view: modal('Please try again', 'ritual_error', '', [section(escape(e.message))], null) })
    }
  })
  // Middleware intercepts only new subcommands; the legacy command handlers stay intact.
  app.use(async args => {
    const { body, next, ack, client: baseClient } = args
    const command = body.command?.replace(/^\/t/, '/')
    const sub = body.text?.trim()
    if (!((command === '/sync' && ['setup', 'preferences', 'checkin', 'home'].includes(sub)) || (command === '/pick' && sub === 'rotate'))) return next()
    await ack()
    background(async () => {
    const originalClient = baseClient
    const client = sub === 'home' ? originalClient : await modalClient(originalClient, body.trigger_id)
    try {
      if (sub === 'home') return home(client, body.team_id, body.user_id, body.channel_id)
      if (sub === 'preferences') return open(client, body.trigger_id, await preferencesView(body.team_id, body.user_id))
      await member(client, body.channel_id, body.user_id)
      if (sub === 'setup') {
        const c = await engine.config(body.team_id, body.channel_id)
        if (c) await manage(client, c, body.user_id)
        return open(client, body.trigger_id, await setupView(body.team_id, body.channel_id))
      }
      if (sub === 'checkin') return open(client, body.trigger_id, await checkinView(body.team_id, body.channel_id, body.user_id))
      return open(client, body.trigger_id, modal('Fair team rotation', 'ritual_rotate_save', body.channel_id, [field('reason', 'What is this rotation for?', '', true), input('exclude', 'Exclude this time', { type: 'multi_users_select' }, true)], 'Pick'))
    } catch (e) { await openError(client, body.trigger_id, e) }
    })
  })
  return { home }
}
module.exports = { registerRituals, read, modal }
