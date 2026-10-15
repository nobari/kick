const { key } = require('./store')
const { DAY } = require('./domain')
const { date } = require('./collaboration')
const { seal, unseal } = require('../db/encryption.cjs')

const kinds = ['approvals', 'leaves', 'onboarding', 'steps', 'meetings', 'notes', 'handoffs']
function required(v, max = 150) {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Enter 1–${max} characters.`)
  return v.trim()
}
function page(v = 0) {
  if (!Number.isSafeInteger(v) || v < 0 || v > 10000) throw new Error('Reopen this list.')
  return v
}

function createCoordination(store, { access, authorize, clock = Date.now }) {
  const life = c => ({ team: c.team, config: c.id, at: clock(), expiresAt: clock() + c.retentionDays * DAY })
  const crypt = (r, field) => `${r.team}:${r.config}:${r.id}:${field}`
  function decode(kind, r) {
    if (kind === 'meetings') return { ...r, title: unseal(r.title, crypt(r, 'title')) }
    if (kind === 'notes') return { ...r, detail: unseal(r.detail, crypt(r, 'detail')) }
    return r
  }
  function due(value, expiry) {
    const d = date(value)
    if (Date.parse(d) + DAY > expiry) throw new Error('Choose a date within the record’s retention period.')
    return d
  }
  async function row(ctx, kind, id, tx = store, c) {
    if (!kinds.includes(kind)) throw new Error('Unknown coordination tool.')
    c ||= await access(ctx)
    const r = await tx.get(kind, id)
    if (!r || r.team !== c.team || r.expiresAt <= clock()) throw new Error('Record unavailable or expired.')
    if (kind === 'handoffs') {
      if (r.config !== c.id && !(r.target === c.id && (r.owner === ctx.user || ['accepted', 'completed'].includes(r.status)))) throw new Error('Record unavailable.')
    } else if (r.config !== c.id) throw new Error('Record unavailable.')
    if (['approvals', 'leaves', 'meetings'].includes(kind) && ![r.user, r.owner].includes(ctx.user)) throw new Error('This record is private to its participants.')
    if (kind === 'notes') await row(ctx, 'meetings', r.meeting, tx, c)
    if (kind === 'steps') await row(ctx, 'onboarding', r.onboarding, tx, c)
    return decode(kind, r)
  }
  async function list(ctx, kind, offset = 0, parent, filter = '') {
    const c = await access(ctx)
    if (kind === 'notes') await row(ctx, 'meetings', parent, store, c)
    if (kind === 'steps') await row(ctx, 'onboarding', parent, store, c)
    return (await store.coordinationPage(kind, c.team, c.id, ctx.user, clock(), page(offset), parent, filter)).map(r => decode(kind, r))
  }
  async function create(ctx, kind, data, request) {
    if (!kinds.includes(kind)) throw new Error('Unknown coordination tool.')
    const c = await access(ctx), id = key(c.id, kind, ctx.user, required(request, 100))
    const owner = required(data.owner, 80)
    await authorize(c, owner)
    if (['approvals', 'leaves', 'meetings'].includes(kind) && owner === ctx.user) throw new Error('Choose another person; self-approval is not allowed.')
    let target
    if (kind === 'handoffs') {
      target = await access({ ...ctx, config: data.target })
      if (target.id === c.id || target.channel === c.channel) throw new Error('Choose a workflow in another channel you belong to.')
      await authorize(target, owner)
    }
    if (kind === 'onboarding') await authorize(c, required(data.buddy, 80))
    if (kind === 'leaves') {
      await authorize(c, required(data.cover, 80))
      if (data.cover === ctx.user) throw new Error('Choose another teammate for coverage.')
    }
    // All remote membership checks precede the transaction.
    return store.locked(c.id, async tx => {
      if (await tx.get(kind, id)) return id
      const r = { ...life(c), user: ctx.user, owner, version: 1 }
      let parent
      if (kind === 'notes' || kind === 'steps') {
        const parentKind = kind === 'notes' ? 'meetings' : 'onboarding'
        parent = await row(ctx, parentKind, data.parent, tx, c)
        if (parent.status !== 'active') throw new Error('This checklist is closed.')
        const participants = [parent.user, parent.owner, ...(kind === 'steps' ? [parent.buddy, c.owner] : [])]
        if (!participants.includes(ctx.user)) throw new Error('Only checklist participants can add items.')
        if (kind === 'notes' && ![parent.user, parent.owner].includes(owner)) throw new Error('Follow-ups can only be assigned to the two participants.')
        r[kind === 'notes' ? 'meeting' : 'onboarding'] = parent.id
        r.expiresAt = Math.min(r.expiresAt, parent.expiresAt)
        r.detail = required(data.detail, 1500)
        r.status = 'open'
      } else {
        r.title = required(data.title)
        r.status = ['onboarding', 'meetings'].includes(kind) ? 'active' : 'pending'
      }
      if (['approvals', 'leaves', 'handoffs'].includes(kind)) r.detail = required(data.detail, 1500)
      if (kind === 'handoffs') { r.target = target.id; r.expiresAt = Math.min(r.expiresAt, clock() + target.retentionDays * DAY) }
      r.due = due(data.due, r.expiresAt)
      if (['approvals', 'leaves'].includes(kind) && Date.parse(r.due) + DAY <= clock()) throw new Error('Choose a decision deadline today or later (UTC).')
      if (kind === 'onboarding') r.buddy = data.buddy
      if (kind === 'leaves') {
        r.start = date(data.start); r.end = due(data.end, r.expiresAt); r.cover = data.cover
        if (r.start > r.end || r.due > r.start || r.start < new Date(clock()).toISOString().slice(0, 10)) throw new Error('Use future leave dates, with a decision deadline on or before the first day.')
      }
      if (kind === 'meetings') r.title = seal(r.title, crypt({ ...r, id }, 'title'))
      if (kind === 'notes') r.detail = seal(r.detail, crypt({ ...r, id }, 'detail'))
      await tx.create(kind, id, r)
      return id
    })
  }
  async function transition(ctx, kind, id, data) {
    const c = await access(ctx)
    // Handoffs use a record lock shared by both channels.
    const first = await row(ctx, kind, id, store, c)
    return store.locked(first.config, async tx => {
      const r = await row(ctx, kind, id, tx, c), status = data.status
      if (r.status === status) return // Repeated submissions are harmless.
      if (r.version !== data.version) throw new Error('This record changed. Reopen it before updating.')
      const isRequester = ctx.user === r.user, isOwner = ctx.user === r.owner
      let allowed = false
      if (['approvals', 'leaves'].includes(kind)) {
        allowed = (status === 'cancelled' && isRequester && ['pending', 'approved'].includes(r.status)) ||
          (r.status === 'pending' && isOwner && ['approved', 'declined'].includes(status))
        if (status === 'approved' && Date.parse(r.due) + DAY <= clock()) throw new Error('The decision deadline passed. Ask for a new request.')
      } else if (kind === 'handoffs') {
        allowed = (isRequester && r.config === c.id && ['pending', 'accepted'].includes(r.status) && status === 'cancelled') ||
          (isOwner && c.id === r.target && ((r.status === 'pending' && ['accepted', 'declined'].includes(status)) || (r.status === 'accepted' && status === 'completed')))
      } else if (['meetings', 'onboarding'].includes(kind)) {
        allowed = [r.user, r.owner, ...(kind === 'onboarding' ? [r.buddy, c.owner] : [])].includes(ctx.user) &&
          r.status === 'active' && ['completed', 'cancelled'].includes(status)
        if (status === 'completed' && await tx.incompleteChildren(kind === 'meetings' ? 'notes' : 'steps', id, clock())) throw new Error('Finish the open checklist items before completing this record.')
      } else {
        const parent = await row(ctx, kind === 'notes' ? 'meetings' : 'onboarding', r.meeting || r.onboarding, tx, c)
        allowed = parent.status === 'active' && [r.user, r.owner, parent.user, parent.owner, ...(kind === 'steps' ? [parent.buddy, c.owner] : [])].includes(ctx.user) && ['open', 'done'].includes(status)
      }
      if (!allowed) throw new Error('You cannot make this change. Reopen the record to check its current status.')
      const fields = { status, version: r.version + 1 }
      if (['approvals', 'leaves'].includes(kind)) { fields.decision = required(data.decision || 'No additional note.', 1500); fields.decidedAt = clock() }
      await tx.set(kind, id, fields)
    })
  }
  async function coverage(ctx, from, to) {
    const c = await access(ctx)
    date(from); date(to)
    if (from > to || Date.parse(to) - Date.parse(from) > 90 * DAY) throw new Error('Choose a date range of up to 90 days.')
    return store.coverage(c.team, c.id, clock(), from, to)
  }
  async function escalation(ctx) {
    const c = await access(ctx)
    const r = await store.get('escalations', key(c.id, 'escalation'))
    return r?.expiresAt > clock() ? r : { enabled: false, days: 2, version: 0 }
  }
  async function targets(ctx, channel) {
    await access(ctx)
    const choices = []
    for (const c of await store.list('configs', 'channel', '==', required(channel, 80), 100)) {
      if (c.team !== ctx.team) continue
      try { await access({ ...ctx, config: c.id }); choices.push(c) } catch { /* Inaccessible workflows are not disclosed. */ }
    }
    return choices
  }
  async function saveEscalation(ctx, data) {
    const c = await access(ctx, true), days = Number(data.days)
    if (!Number.isInteger(days) || days < 1 || days > 30 || typeof data.enabled !== 'boolean') throw new Error('Choose an age of 1–30 days and whether to enable reminders.')
    return store.locked(c.id, async tx => {
      const id = key(c.id, 'escalation'), stored = await tx.get('escalations', id), old = stored?.expiresAt > clock() ? stored : null
      if ((old?.version || 0) !== data.version) throw new Error('Settings changed. Reopen this form.')
      await tx.set('escalations', id, { ...(old || life(c)), user: ctx.user, enabled: data.enabled, days, version: (old?.version || 0) + 1 })
    })
  }
  return { access, row, list, create, transition, coverage, escalation, saveEscalation, targets }
}
module.exports = { createCoordination }
