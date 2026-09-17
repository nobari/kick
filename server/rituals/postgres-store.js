const { createHash, randomUUID } = require('node:crypto')
const key = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex')
const common = { id: 'id', team: 'workspace_id' }
const lifetime = { config: 'config_id', at: 'created_at', expiresAt: 'expires_at' }
const settings = { channel: 'channel_id', owner: 'owner_id', enabled: 'enabled', zone: 'timezone', time: 'checkin_time', digestTime: 'digest_time', days: 'weekdays', members: 'participants', template: 'template', questions: 'questions', roundup: 'roundup', retentionDays: 'retention_days' }
const columns = {
  configs: { ...settings, nextAt: 'next_at', updatedAt: 'updated_at', leaseOwner: 'lease_owner', leaseUntil: 'lease_until', lastError: 'last_error' },
  runs: { ...lifetime, channel: 'channel_id', date: 'local_date', members: 'participants', questions: 'questions' },
  responses: { ...lifetime, run: 'run_id', user: 'user_id', answers: 'answers' },
  blockers: { ...lifetime, user: 'reporter_id', helper: 'helper_id', detail: 'detail', resolvedAt: 'resolved_at', updatedBy: 'updated_by' },
  recognition: { ...lifetime, from: 'sender_id', to: 'recipient_id', reason: 'reason' },
  prefs: { user: 'user_id', zone: 'timezone', quietStart: 'quiet_start', quietEnd: 'quiet_end', disabled: 'disabled', leaveUntil: 'leave_until', snoozeUntil: 'snooze_until' },
  drafts: { ...settings, editor: 'editor_id', expiresAt: 'expires_at' },
  rotations: { ...lifetime, selected: 'selected_user', history: 'history', operations: 'operations' },
  jobs: { ...lifetime, channel: 'channel_id', kind: 'kind', run: 'run_id', user: 'user_id', blocker: 'blocker_id', since: 'since_at', selected: 'selected_user', reason: 'reason', clientId: 'client_message_id', dueAt: 'due_at', attempts: 'attempts', done: 'done', status: 'status', lastError: 'last_error', owner: 'lease_owner', leaseUntil: 'lease_until' },
}
const numbers = new Set(['at', 'expiresAt', 'nextAt', 'updatedAt', 'leaseUntil', 'resolvedAt', 'snoozeUntil', 'since', 'dueAt'])
function mapping(kind) {
  if (!Object.hasOwn(columns, kind)) throw new Error('Unknown ritual entity')
  return { ...common, ...columns[kind] }
}
function decode(kind, row) {
  if (!row) return null
  return Object.fromEntries(Object.entries(mapping(kind)).map(([field, column]) => [field, numbers.has(field) && row[column] != null ? Number(row[column]) : row[column]]))
}
function createStore(database) {
  async function write(tx, kind, id, data, onlyCreate = false) {
    const map = mapping(kind), entries = Object.entries({ ...data, id }).filter(([, v]) => v !== undefined)
    if (entries.some(([f]) => !Object.hasOwn(map, f))) throw new Error('Unknown ritual field')
    const fields = entries.map(([f]) => `"${map[f]}"`), values = entries.map(([f, v]) => f === 'operations' ? JSON.stringify(v) : v)
    const updates = fields.filter(f => f !== '"id"').map(f => `${f}=EXCLUDED.${f}`)
    const result = await tx.query(`INSERT INTO ritual_${kind} (${fields.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT(id) DO ${onlyCreate ? 'NOTHING' : `UPDATE SET ${updates.join(',')}`} RETURNING id`, values)
    return result.rowCount > 0
  }
  return {
    key,
    async atomic(fn) {
      return database.transaction(tx => fn(createStore({ query: (...args) => tx.query(...args), transaction: work => work(tx) })))
    },
    async get(kind, id) { mapping(kind); return decode(kind, (await database.query(`SELECT * FROM ritual_${kind} WHERE id=$1`, [id])).rows[0]) },
    async set(kind, id, data) { return this.mutate(kind, id, old => ({ ...old, ...data })) },
    async create(kind, id, data) { return write(database, kind, id, data, true) },
    async list(kind, field, op, value, limit = 10000) {
      const map = mapping(kind), operator = { '==': '=', '<=': '<=', '<': '<' }[op]
      if (!map[field] || !operator || !Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error('Invalid ritual query')
      const due = kind === 'jobs' && field === 'dueAt' ? ' AND NOT done' : kind === 'configs' && field === 'nextAt' ? ' AND enabled' : ''
      const result = await database.query(`SELECT * FROM ritual_${kind} WHERE "${map[field]}" ${operator} $1${due} ORDER BY "${map[field]}", id LIMIT $2`, [value, limit])
      return result.rows.map(row => decode(kind, row))
    },
    async mutate(kind, id, fn) {
      mapping(kind)
      return database.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`ritual:${kind}:${id}`])
        const old = decode(kind, (await tx.query(`SELECT * FROM ritual_${kind} WHERE id=$1 FOR UPDATE`, [id])).rows[0])
        const next = fn(old)
        if (!next) return null
        if (old && (next.team !== old.team || next.config !== old.config)) throw new Error('Cannot change ritual ownership')
        if (old && kind === 'configs' && next.owner !== old.owner) throw new Error('Workflow ownership changed; reopen setup')
        await write(tx, kind, id, next)
        return { ...next, id }
      })
    },
    async submit(id, response, blocker) {
      return database.transaction(async tx => {
        if (!await write(tx, 'responses', id, response, true)) return false
        if (blocker) await write(tx, 'blockers', id, blocker, true)
        return true
      })
    },
    async claim(kind, id, now, leaseMs = 120000) {
      if (!['jobs', 'configs'].includes(kind)) throw new Error('Invalid lease entity')
      const owner = randomUUID()
      const result = await database.query(`UPDATE ritual_${kind} SET lease_owner=$2, lease_until=$3 WHERE id=$1 AND lease_until <= $4 AND ${kind === 'jobs' ? 'NOT done AND due_at <= $4' : 'enabled AND next_at <= $4'} RETURNING id`, [id, owner, now + leaseMs, now])
      return result.rowCount ? owner : null
    },
    async finish(kind, id, owner, data) {
      if (!['jobs', 'configs'].includes(kind)) throw new Error('Invalid lease entity')
      const map = mapping(kind), entries = Object.entries(data)
      if (entries.some(([f]) => !map[f] || ['id', 'team', 'config'].includes(f))) throw new Error('Invalid lease update')
      return (await database.query(`UPDATE ritual_${kind} SET ${entries.map(([f], i) => `"${map[f]}"=$${i + 3}`).join(',')} WHERE id=$1 AND lease_owner=$2`, [id, owner, ...entries.map(([, v]) => v)])).rowCount > 0
    },
    async cleanup(now) {
      for (const kind of ['responses', 'blockers', 'recognition', 'jobs', 'rotations', 'runs', 'drafts'])
        await database.query(`DELETE FROM ritual_${kind} WHERE id IN (SELECT id FROM ritual_${kind} WHERE expires_at <= $1 ORDER BY expires_at LIMIT 100)`, [now])
    },
    async shortenRetention(config, days) {
      await database.transaction(async tx => {
        for (const kind of ['runs', 'responses', 'blockers', 'recognition', 'rotations', 'jobs'])
          await tx.query(`UPDATE ritual_${kind} SET expires_at=LEAST(expires_at, created_at+$2::bigint) WHERE config_id=$1`, [config, days * 86400000])
      })
    },
  }
}
module.exports = { createStore, key }
