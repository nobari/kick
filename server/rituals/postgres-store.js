const { createHash, randomUUID } = require('node:crypto')
const key = (...parts) => createHash('sha256').update(parts.join(':')).digest('hex')
const common = { id: 'id', team: 'workspace_id' }
const lifetime = { config: 'config_id', at: 'created_at', expiresAt: 'expires_at' }
const settings = { name: 'name', workflowKey: 'workflow_key', channel: 'channel_id', owner: 'owner_id', enabled: 'enabled', zone: 'timezone', time: 'checkin_time', digestTime: 'digest_time', days: 'weekdays', members: 'participants', template: 'template', questions: 'questions', roundup: 'roundup', retentionDays: 'retention_days' }
const columns = {
  configs: { ...settings, nextAt: 'next_at', updatedAt: 'updated_at', leaseOwner: 'lease_owner', leaseUntil: 'lease_until', lastError: 'last_error' },
  runs: { ...lifetime, channel: 'channel_id', date: 'local_date', members: 'participants', questions: 'questions', closesAt: 'closes_at' },
  responses: { ...lifetime, run: 'run_id', user: 'user_id', answers: 'answers', version: 'version', editedAt: 'edited_at', correction: 'correction' },
  blockers: { ...lifetime, user: 'reporter_id', helper: 'helper_id', detail: 'detail', resolvedAt: 'resolved_at', updatedBy: 'updated_by' },
  recognition: { ...lifetime, from: 'sender_id', to: 'recipient_id', reason: 'reason' },
  prefs: { user: 'user_id', zone: 'timezone', quietStart: 'quiet_start', quietEnd: 'quiet_end', disabled: 'disabled', leaveUntil: 'leave_until', snoozeUntil: 'snooze_until' },
  drafts: { ...settings, editor: 'editor_id', expiresAt: 'expires_at' },
  rotations: { ...lifetime, selected: 'selected_user', history: 'history', operations: 'operations' },
  jobs: { ...lifetime, channel: 'channel_id', kind: 'kind', run: 'run_id', user: 'user_id', blocker: 'blocker_id', since: 'since_at', selected: 'selected_user', reason: 'reason', clientId: 'client_message_id', dueAt: 'due_at', attempts: 'attempts', done: 'done', status: 'status', lastError: 'last_error', owner: 'lease_owner', leaseUntil: 'lease_until' },
  actions: { ...lifetime, user: 'creator_id', owner: 'assignee_id', detail: 'detail', due: 'due_date', status: 'status', completedAt: 'completed_at', source: 'source_kind', sourceId: 'source_id', sprint: 'sprint_id' },
  sprints: { ...lifetime, user: 'creator_id', title: 'title', goal: 'goal', start: 'start_date', end: 'end_date', status: 'status', recap: 'recap' },
  retros: { ...lifetime, user: 'creator_id', title: 'title', status: 'status' },
  topics: { ...lifetime, retro: 'retro_id', user: 'author_id', detail: 'detail', category: 'category', group: 'group_name' },
  votes: { ...lifetime, topic: 'topic_id', user: 'user_id' },
  poker: { ...lifetime, user: 'creator_id', title: 'title', status: 'status', round: 'round', members: 'participants', decision: 'decision' },
  estimates: { ...lifetime, poker: 'poker_id', user: 'user_id', round: 'round', value: 'value' },
  calendar: { ...lifetime, user: 'editor_id', date: 'local_date', skip: 'skip', time: 'checkin_time', digestTime: 'digest_time' },
  audit: { ...lifetime, user: 'actor_id', event: 'event', target: 'target_id', detail: 'detail' },
}
const historyKinds = ['actions', 'votes', 'topics', 'retros', 'estimates', 'poker', 'sprints', 'calendar', 'audit', 'responses', 'blockers', 'recognition', 'jobs', 'rotations', 'runs']
const numbers = new Set(['at', 'expiresAt', 'nextAt', 'updatedAt', 'leaseUntil', 'resolvedAt', 'snoozeUntil', 'since', 'dueAt', 'closesAt', 'editedAt', 'completedAt'])
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
    async locked(scope, fn) {
      return database.transaction(async tx => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`collaboration:${scope}`])
        return fn(createStore({ query: (...args) => tx.query(...args), transaction: work => work(tx) }))
      })
    },
    async get(kind, id) { mapping(kind); return decode(kind, (await database.query(`SELECT * FROM ritual_${kind} WHERE id=$1`, [id])).rows[0]) },
    async search(config, { query = '', user = '', status = '', from = '', to = '', offset = 0, now }) {
      if (typeof query !== 'string' || query.length > 150 || !['', 'open', 'done'].includes(status) || !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new Error('Invalid search filters.')
      const sources = [
        ['actions', 'detail', 'assignee_id', 'status'],
        ['responses', "array_to_string(answers, E'\\n') || COALESCE(E'\\nCorrection: ' || correction, '')", 'user_id', "'done'"],
        ['blockers', 'detail', 'reporter_id', "CASE WHEN resolved_at IS NULL THEN 'open' ELSE 'done' END"],
        ['recognition', 'reason', 'sender_id', "'done'"],
      ]
      const union = sources.map(([kind, body, author, state]) => `SELECT id, '${kind}' AS kind, ${body} AS detail, ${author} AS author, ${state} AS status, created_at FROM ritual_${kind} WHERE config_id=$1 AND expires_at>$2`).join(' UNION ALL ')
      const { rows } = await database.query(`SELECT * FROM (${union}) records WHERE
        ($3='' OR to_tsvector('simple',detail) @@ websearch_to_tsquery('simple',$3)) AND ($4='' OR author=$4) AND ($5='' OR status=$5)
        AND created_at >= $6 AND created_at <= $7 ORDER BY created_at DESC,id LIMIT 21 OFFSET $8`,
      [config, now, query, user, status, from ? Date.parse(from) : 0, to ? Date.parse(to) + 86400000 - 1 : Number.MAX_SAFE_INTEGER, offset])
      return rows.map(r => ({ ...r, at: Number(r.created_at) }))
    },
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
      for (const kind of [...historyKinds, 'drafts'])
        await database.query(`DELETE FROM ritual_${kind} WHERE id IN (SELECT id FROM ritual_${kind} WHERE expires_at <= $1 ORDER BY expires_at LIMIT 100)`, [now])
    },
    async shortenRetention(config, days) {
      await database.transaction(async tx => {
        for (const kind of historyKinds)
          await tx.query(`UPDATE ritual_${kind} SET expires_at=LEAST(expires_at, created_at+$2::bigint) WHERE config_id=$1`, [config, days * 86400000])
      })
    },
  }
}
module.exports = { createStore, key }
