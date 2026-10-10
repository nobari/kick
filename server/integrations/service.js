const { randomUUID } = require('node:crypto')
const { key } = require('../rituals/store')
const { seal, unseal } = require('../db/encryption.cjs')
const { date } = require('../rituals/collaboration')
const { createOAuth } = require('./oauth')
const DAY = 86400000
function createIntegrations(store, { access, admin, member, providerApi, clock = Date.now, env = process.env }) {
  async function allowed(ctx) { await admin(ctx); return access(ctx) }
  async function connection(ctx, id, tx = store) {
    const r = await tx.get('connections', id)
    if (!r || r.team !== ctx.team || r.expiresAt <= clock()) throw new Error('Connection expired or disconnected. Reconnect in Slack.')
    return r
  }
  async function scoped(ctx, kind, id, tx = store) {
    if (!['mappings', 'issuelinks', 'actions'].includes(kind)) throw new Error('Unsupported sync record.')
    const r = await tx.get(kind, id)
    if (!r || r.team !== ctx.team || r.config !== ctx.config || r.expiresAt <= clock()) throw new Error('Sync record unavailable or expired.')
    return r
  }
  async function token(ctx, id) {
    // Serialize rotating refresh tokens, with a bounded eight-second provider call.
    return store.locked(`token:${id}`, async tx => {
      const c = await connection(ctx, id, tx), context = `connection:${c.team}:${id}`
      let credentials = unseal(c.credentials, context)
      if (credentials.expires < clock() + 60000) {
        if (!credentials.refresh) throw new Error('Reconnect this provider to renew access.')
        credentials = await providerApi.refresh(c.provider, credentials.refresh)
        await tx.set('connections', id, { credentials: seal(credentials, context), version: c.version + 1 })
      }
      return { provider: c.provider, value: credentials.access }
    })
  }
  async function list(ctx, kind, offset = 0) {
    await allowed(ctx)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new Error('Reopen this list.')
    const rows = await store.integrationPage(kind, ctx.team, ctx.config, clock(), offset)
    return rows.map(({ credentials, ...r }) => r)
  }
  async function roots(ctx, id) {
    await allowed(ctx); const t = await token(ctx, id)
    return providerApi.roots(t.provider, t.value)
  }
  async function containers(ctx, id, root) {
    await allowed(ctx); const t = await token(ctx, id)
    return providerApi.containers(t.provider, t.value, root)
  }
  async function map(ctx, data) {
    const c = await allowed(ctx), t = await token(ctx, data.connection)
    const chosen = (await providerApi.containers(t.provider, t.value, data.root)).find(r => r.id === data.container)
    if (!chosen) throw new Error('Choose an accessible project, team or repository.')
    const id = key(c.id, data.connection)
    return store.locked(c.id, async tx => {
      const conn = await connection(ctx, data.connection, tx), old = await tx.get('mappings', id)
      if (old?.expiresAt > clock()) {
        if (old.root === data.root && old.container === data.container) return id
        throw new Error('Remove the existing mapping before selecting another project.')
      }
      if (old) await tx.removeIntegration('mappings', ctx.team, id)
      await tx.create('mappings', id, { team: c.team, config: c.id, connection: conn.id, root: data.root, container: data.container,
        label: chosen.label.slice(0, 150), user: ctx.user, at: clock(), expiresAt: Math.min(conn.expiresAt, clock() + c.retentionDays * DAY) })
      return id
    })
  }
  async function preview(ctx, mappingId, remote) {
    await allowed(ctx)
    const mapping = await scoped(ctx, 'mappings', mappingId), t = await token(ctx, mapping.connection)
    const issue = await providerApi.issue(t.provider, t.value, mapping, remote)
    return { mapping, issue, provider: t.provider }
  }
  async function importIssue(ctx, data) {
    const c = await allowed(ctx), p = await preview(ctx, data.mapping, data.remote)
    await member(c, data.owner)
    date(data.due)
    if (Date.parse(data.due) + DAY > p.mapping.expiresAt) throw new Error('Choose a due date within the mapping retention period.')
    if (p.issue.revision !== data.revision) throw new Error('The issue changed. Preview it again before importing.')
    const id = key(p.mapping.id, p.issue.id), action = key(id, 'action')
    return store.locked(c.id, async tx => {
      await scoped(ctx, 'mappings', data.mapping, tx); await connection(ctx, p.mapping.connection, tx)
      if (await tx.get('issuelinks', id)) return id
      const life = { team: c.team, config: c.id, at: clock(), expiresAt: p.mapping.expiresAt }
      const status = p.issue.done ? 'done' : 'open'
      await tx.create('actions', action, { ...life, user: ctx.user, owner: data.owner, detail: p.issue.title.slice(0, 1500), due: data.due, status, completedAt: p.issue.done ? clock() : null })
      await tx.create('issuelinks', id, { ...life, mapping: p.mapping.id, action, remote: p.issue.id, user: ctx.user,
        localStatus: status, remoteStatus: p.issue.status, syncedAt: clock(), version: 1 })
      await tx.create('audit', key(id, 'import'), { ...life, user: ctx.user, event: 'issue_imported', target: action, detail: `Explicit ${p.provider} issue import; title and status only.` })
      return id
    })
  }
  async function inspect(ctx, id) {
    await allowed(ctx)
    const link = await scoped(ctx, 'issuelinks', id), action = await scoped(ctx, 'actions', link.action)
    const p = await preview(ctx, link.mapping, link.remote)
    return { ...p, link, action, conflict: action.status !== link.localStatus && p.issue.status !== link.remoteStatus,
      snapshot: { version: link.version, local: action.status, remote: p.issue.status, revision: p.issue.revision } }
  }
  async function sync(ctx, id, direction, snapshot, state) {
    const c = await allowed(ctx), link = await scoped(ctx, 'issuelinks', id), mapping = await scoped(ctx, 'mappings', link.mapping)
    const t = await token(ctx, mapping.connection)
    if (!['pull', 'push'].includes(direction)) throw new Error('Choose a sync direction.')
    // Disconnect and sync share a connection lock. Local edits share the workflow lock.
    return store.locked(`token:${mapping.connection}`, outer => outer.locked(c.id, async tx => {
      const current = await scoped(ctx, 'issuelinks', id, tx), action = await scoped(ctx, 'actions', current.action, tx)
      await scoped(ctx, 'mappings', mapping.id, tx); await connection(ctx, mapping.connection, tx)
      const remote = await providerApi.issue(t.provider, t.value, mapping, current.remote)
      if (snapshot.version !== current.version || snapshot.local !== action.status || snapshot.remote !== remote.status || snapshot.revision !== remote.revision) throw new Error('One side changed since the preview. Refresh and choose again; nothing was overwritten.')
      let nextRemote = remote.status, nextLocal = action.status
      if (direction === 'pull') {
        nextLocal = remote.done ? 'done' : 'open'
        await tx.set('actions', action.id, { status: nextLocal, completedAt: nextLocal === 'done' ? action.completedAt || clock() : null })
      } else {
        const choice = remote.states.find(s => s.id === state)
        const done = t.provider === 'github' ? state === 'closed' : choice?.done
        if (!choice || done !== (action.status === 'done')) throw new Error('Choose an available provider status matching the Kick task’s open/done state.')
        await providerApi.change(t.provider, t.value, mapping, remote.id, state)
        nextRemote = choice.status || state
      }
      await tx.set('issuelinks', id, { localStatus: nextLocal, remoteStatus: nextRemote, syncedAt: clock(), version: current.version + 1 })
      await tx.create('audit', randomUUID(), { team: c.team, config: c.id, at: clock(), expiresAt: current.expiresAt, user: ctx.user, event: `issue_${direction}`, target: action.id, detail: `Explicit ${t.provider} status sync.` })
    }))
  }
  async function remove(ctx, kind, id) {
    await allowed(ctx)
    if (kind === 'connections') await connection(ctx, id)
    else await scoped(ctx, kind, id)
    if (!['connections', 'mappings', 'issuelinks'].includes(kind)) throw new Error('Invalid disconnect operation.')
    // Delete credentials and cascading mappings/links, never tasks or remote issues.
    return store.locked(kind === 'connections' ? `token:${id}` : ctx.config, tx => tx.removeIntegration(kind, ctx.team, id))
  }
  const oauth = createOAuth(store, { admin: async ctx => { await allowed(ctx) }, providerApi, clock, env })
  return { allowed, list, roots, containers, map, preview, importIssue, inspect, sync, remove, ticket: oauth.ticket }
}
module.exports = { createIntegrations }
