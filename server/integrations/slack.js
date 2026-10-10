const { randomUUID } = require('node:crypto')
const { escape } = require('../rituals/domain')
const { createIntegrations } = require('./service')
const { createProviders, providers } = require('./providers')
const { assertAdmin } = require('./runtime')

function registerIntegrations({ app, store, service, member, ui }) {
  const { modal, section, button, input, field, select, option, context, read } = ui
  const b = (label, action, data) => button(label, `integ_${action}`, JSON.stringify(data))
  const buttons = (...elements) => ({ type: 'actions', elements })
  const form = (title, action, data, blocks, submit = null) => modal(title, `integ_${action}_save`, JSON.stringify({ ...data, request: randomUUID() }), blocks, submit)
  const apiFor = client => createIntegrations(store, { access: service(client).access, admin: ctx => assertAdmin(client, ctx), member: (c, user) => member(client, c.channel, user), providerApi: createProviders() })
  const disclosure = context('Admin-managed, explicit sync. Import shares the issue title and status with this channel. After import, only status syncs—in the direction you confirm. No background sync, comments, attachments, private to-dos or one-on-one notes. No remote deletion.')
  async function render(api, ctx, action, data = {}) {
    const c = await api.allowed(ctx), scope = { c: c.id }, back = buttons(b('Issue sync', 'hub', scope))
    if (action === 'hub') {
      const connections = await api.list(ctx, 'connections'), maps = await api.list(ctx, 'mappings')
      const blocks = [section(`*Issue sync · ${escape(c.name)}*\nEach Slack workspace connects its own accounts. Choose a provider, map this workflow, and preview an issue before importing it.`)]
      providers.forEach(p => {
        const conn = connections.find(r => r.provider === p), mapping = conn && maps.find(r => r.connection === conn.id)
        blocks.push(section(`*${p === 'github' ? 'GitHub' : p === 'jira' ? 'Jira' : 'Linear'}*\n${conn ? mapping ? `Mapped to ${escape(mapping.label)}` : 'Connected · no mapping for this workflow' : 'Not connected'}`))
        blocks.push(buttons(...(conn ? [b(mapping ? 'Preview an issue' : 'Map this workflow', mapping ? 'import' : 'roots', { ...scope, connection: conn.id, mapping: mapping?.id }),
          b('Disconnect workspace', 'remove', { ...scope, kind: 'connections', id: conn.id }),
          ...(mapping ? [b('Remove mapping', 'remove', { ...scope, kind: 'mappings', id: mapping.id })] : [])] : [b('Connect', 'connect', { ...scope, provider: p })])))
      })
      blocks.push(buttons(b('Linked issues', 'links', scope)), disclosure, context('Connections expire after 90 days. Mappings and links follow workflow retention. Reconnecting requires your provider consent; no separate Kick login.'), buttons(button('Team planning', 'plan_hub', JSON.stringify(scope))))
      return form('Issue sync', 'read', scope, blocks)
    }
    if (action === 'connect') {
      const url = await api.ticket(ctx, data.provider)
      return form('Connect your account', 'read', scope, [section(`Open <${url}|Authorize ${data.provider} for this Slack workspace>. This private link expires in 10 minutes; do not share it.`),
        ...(data.provider === 'github' ? [section('First install <https://github.com/apps/kick-team-sync|Kick Team Sync> on your account or organization and select repositories. Then return here and use the authorization link.')] : []),
        context('Consent does not import anything. After returning to Slack, refresh Issue sync and choose the resource and project/repository to share with this workflow.'), back])
    }
    if (action === 'roots') {
      const roots = await api.roots(ctx, data.connection)
      if (!roots.length) throw new Error('No eligible organizations or sites. Check provider app access and permissions.')
      return form('Choose organization', 'root', data, [select('root', 'Provider organization / site', roots.slice(0, 100).map(r => option(r.label.slice(0, 75), r.id)), roots[0].id), disclosure], 'Continue')
    }
    if (action === 'containers') {
      const items = await api.containers(ctx, data.connection, data.root)
      if (!items.length) throw new Error('No accessible projects, teams or repositories. Check provider access.')
      return form('Map this workflow', 'map', data, [section(`This selection authorizes importing issue titles into <#${c.channel}>. Verify that this channel’s members may see the selected project.`),
        select('container', 'Project, Linear team or repository', items.slice(0, 100).map(r => option(r.label.slice(0, 75), r.id)), items[0].id), disclosure], 'Save mapping')
    }
    if (action === 'import') return form('Find an issue', 'preview', data, [field('remote', 'Issue number / key (not a URL)'), context('GitHub: 42 · Jira: TEAM-42 · Linear: TEAM-42. Only issues inside the mapped container can be imported.')], 'Preview')
    if (action === 'preview') {
      const p = await api.preview(ctx, data.mapping, data.remote)
      return form('Confirm issue import', 'import', { ...data, remote: p.issue.id, revision: p.issue.revision }, [section(`*${escape(p.issue.title.slice(0, 450))}*\nProvider: ${p.provider} · Kick status: ${p.issue.done ? 'done' : 'open'}`),
        input('owner', 'Slack assignee', { type: 'users_select', initial_user: ctx.user }), input('due', 'Kick due date', { type: 'datepicker' }),
        section(`Importing creates a channel to-do visible to members of <#${c.channel}>. Only the title and status are copied; the due date and Slack assignee are your choices.`), disclosure], 'Import into channel')
    }
    if (action === 'links') {
      const offset = data.offset || 0, rows = await api.list(ctx, 'issuelinks', offset)
      const blocks = [section('*Linked issues*\nOpen an issue to compare current statuses and choose a sync direction.')]
      rows.slice(0, 8).forEach(r => blocks.push({ ...section(`Issue ${escape(r.remote)} · last sync ${new Date(r.syncedAt).toISOString().slice(0, 10)}\nLast saved Kick state: ${r.localStatus}`), accessory: b('Compare', 'inspect', { ...scope, id: r.id }) }))
      if (!rows.length) blocks.push(section('No linked issues yet. Map a workflow, then preview and import an issue.'))
      const nav = []
      if (offset) nav.push(b('Previous', 'links', { ...scope, offset: Math.max(0, offset - 8) }))
      if (rows.length > 8) nav.push(b('Next', 'links', { ...scope, offset: offset + 8 }))
      if (nav.length) blocks.push(buttons(...nav))
      blocks.push(disclosure, back)
      return form('Linked issues', 'read', scope, blocks)
    }
    if (action === 'inspect') {
      const p = await api.inspect(ctx, data.id), payload = { ...scope, id: data.id, snapshot: p.snapshot }
      const states = p.issue.states.filter(s => (p.provider === 'github' ? s.id === 'closed' : s.done) === (p.action.status === 'done'))
      return form('Compare issue status', 'read', scope, [section(`*${escape(p.issue.title.slice(0, 450))}*\nKick: *${p.action.status}* · ${p.provider}: *${p.issue.done ? 'done' : 'open'}* (state ${escape(p.issue.status)})`),
        ...(p.conflict ? [section('*Both sides changed since the last sync.* Nothing is overwritten automatically. Decide which side should win below.')] : []),
        buttons(b('Use provider status', 'pull', payload), ...(states.length ? [b('Use Kick status', 'push', payload)] : [])),
        ...(!states.length ? [context('No available provider transition matches the Kick status. Change it in the provider or use the provider status here.')] : []),
        buttons(b('Refresh comparison', 'inspect', { ...scope, id: data.id }), b('Unlink issue', 'remove', { ...scope, kind: 'issuelinks', id: data.id })), disclosure, back])
    }
    if (action === 'pull' || action === 'push') {
      const p = await api.inspect(ctx, data.id)
      if (JSON.stringify(p.snapshot) !== JSON.stringify(data.snapshot)) throw new Error('A status changed. Refresh the comparison first.')
      const choices = p.issue.states.filter(s => (p.provider === 'github' ? s.id === 'closed' : s.done) === (p.action.status === 'done'))
      if (action === 'push' && !choices.length) throw new Error('No matching provider transition is available. Refresh the comparison.')
      return form('Confirm status sync', 'sync', { ...data, direction: action }, [section(action === 'pull' ? `Set the Kick task to *${p.issue.done ? 'done' : 'open'}* using the provider’s status?` : `Change the external issue to match Kick’s *${p.action.status}* state?`),
        ...(action === 'push' ? [select('state', 'Provider status / transition', choices.map(s => option(s.label.slice(0, 75), s.id)), choices[0]?.id)] : []),
        context('Only status changes. The current state is checked again before applying. If the provider changes concurrently after its final check, refresh the comparison to reconcile it.'), disclosure], 'Confirm sync')
    }
    if (action === 'remove') return form('Confirm disconnect', 'remove', data, [section(data.kind === 'connections' ? 'Disconnect this provider for the entire Slack workspace? Kick will delete its stored credentials, mappings and issue links.' : data.kind === 'mappings' ? 'Remove this workflow mapping and its issue links?' : 'Remove this issue link?'),
      context('Imported channel to-dos and external issues are not deleted. Revoke the app in the provider settings as well if you want to withdraw the provider-side grant.')], 'Disconnect')
    throw new Error('Open Issue sync from Team planning.')
  }
  app.action(/^integ_/, async ({ body, action, client }) => {
    try {
      const data = JSON.parse(action.value), ctx = { team: body.team.id, user: body.user.id, config: data.c }
      await client.views.open({ trigger_id: body.trigger_id, view: await render(apiFor(client), ctx, action.action_id.slice(6), data) })
    } catch (e) { await client.views.open({ trigger_id: body.trigger_id, view: form('Please try again', 'error', {}, [section(escape(e.message))]) }) }
  })
  app.view(/^integ_.*_save$/, async ({ body, view, client, ack }) => {
    try {
      const data = JSON.parse(view.private_metadata), ctx = { team: body.team.id, user: body.user.id, config: data.c }, api = apiFor(client), action = view.callback_id.slice(6, -5)
      let next = 'hub', payload = { ...data }
      if (action === 'root') { next = 'containers'; payload.root = read(view, 'root') }
      else if (action === 'map') await api.map(ctx, { ...data, container: read(view, 'container') })
      else if (action === 'preview') { next = 'preview'; payload.remote = read(view, 'remote') }
      else if (action === 'import') { payload.id = await api.importIssue(ctx, { ...data, owner: read(view, 'owner'), due: read(view, 'due') }); next = 'inspect' }
      else if (action === 'sync') { await api.sync(ctx, data.id, data.direction, data.snapshot, read(view, 'state')); next = 'inspect' }
      else if (action === 'remove') await api.remove(ctx, data.kind, data.id)
      else throw new Error('Unsupported submission.')
      await ack({ response_action: 'update', view: await render(api, ctx, next, payload) })
    } catch (e) {
      const first = view.blocks.find(b => b.type === 'input')?.block_id
      await ack(first ? { response_action: 'errors', errors: { [first]: e.message.slice(0, 150) } } : { response_action: 'update', view: form('Please try again', 'error', {}, [section(escape(e.message))]) })
    }
  })
  return { render, apiFor }
}
module.exports = { registerIntegrations }
