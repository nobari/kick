/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID } = require('node:crypto');

const millis = value => value ? new Date(value).valueOf() : 0;
function required(value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error('Missing workflow identifier');
  return value;
}
function createWorkflowRepository(database) {
  async function ensure(client, team, channel, users = []) {
    required(team);
    await client.query('INSERT INTO workspaces(id) VALUES($1) ON CONFLICT DO NOTHING', [team]);
    if (channel) await client.query('INSERT INTO channels(workspace_id,channel_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [team, required(channel)]);
    if (users.length) await client.query('INSERT INTO members(workspace_id,user_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING', [team, [...new Set(users.map(required))]]);
  }
  async function recognition(client, { team, channel, from, recipients, ts, AT, link, cts, kind = 'kudos', reason, standupId = null }) {
    if (!['kudos', 'coin'].includes(kind)) throw new Error('Invalid recognition kind');
    const users = [...new Set(recipients || [])];
    if (!users.length) return;
    await ensure(client, team, channel, [from, ...users]);
    const result = await client.query(`INSERT INTO recognition_events(workspace_id,channel_id,sender_id,kind,reason,message_ts,thread_ts,permalink,occurred_at,standup_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(workspace_id,channel_id,message_ts,kind,sender_id) DO NOTHING RETURNING id`,
    [team, channel, from, kind, reason || null, required(ts), cts || null, link || null, new Date(AT), standupId]);
    if (!result.rows.length) return; // Event and all grants commit together.
    await client.query('INSERT INTO recognition_recipients(workspace_id,event_id,recipient_id) SELECT $1,$2,unnest($3::text[])', [team, result.rows[0].id, users]);
  }
  function standup(row) {
    return row ? { f: row.user_id, values: { m: row.mood, l: row.previous_work, t: row.planned_work, b: row.blockers },
      cts: row.thread_ts || false, AT: millis(row.submitted_at), link: row.permalink } : undefined;
  }
  return {
    async health() { await database.query('SELECT 1'); },
    async installationCount() { return (await database.query("SELECT count(*)::int AS count FROM slack_installations WHERE revoked_at IS NULL AND environment='production'")).rows[0].count; },
    async saveContext(team, channel, user, domain, username, info, AT) {
      await database.transaction(async client => {
        await ensure(client, team, channel, [user]);
        await client.query('UPDATE workspaces SET domain=COALESCE($2,domain),updated_at=$3 WHERE id=$1', [team, domain || null, new Date(AT)]);
        await client.query('UPDATE members SET username=COALESCE($3,username),refreshed_at=$4 WHERE workspace_id=$1 AND user_id=$2', [team, user, username || null, new Date(AT)]);
        await client.query('UPDATE channels SET name=$3,is_private=$4,is_archived=$5,purpose=$6,topic=$7,refreshed_at=$8 WHERE workspace_id=$1 AND channel_id=$2',
          [team, channel, info.name || null, info.is_private ?? null, !!info.is_archived, info.purpose?.value || null, info.topic?.value || null, new Date(AT)]);
      });
    },
    async getSettings(team) {
      const { rows } = await database.query('SELECT category,name,value,updated_by,updated_at FROM workspace_settings WHERE workspace_id=$1', [required(team)]);
      const settings = Object.create(null);
      for (const row of rows) {
        settings[row.category] ||= { AT: millis(row.updated_at), f: row.updated_by, v: Object.create(null) };
        settings[row.category].v[row.name] = row.value;
      }
      return settings;
    },
    async setSettings(team, category, user, pairs, AT) {
      if (pairs.length % 2) throw new Error('Settings require name/value pairs');
      await database.transaction(async client => {
        await ensure(client, team, null, [user]);
        for (let index = 0; index < pairs.length; index += 2) {
          await client.query(`INSERT INTO workspace_settings(workspace_id,category,name,value,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6)
            ON CONFLICT(workspace_id,category,name) DO UPDATE SET value=EXCLUDED.value,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`,
          [team, category, String(pairs[index]), String(pairs[index + 1]), user, new Date(AT)]);
        }
      });
    },
    async getDailyState(team, channel) {
      const { rows } = await database.query('SELECT id,message_ts,started_at FROM standup_threads WHERE workspace_id=$1 AND channel_id=$2 ORDER BY started_at DESC,message_ts DESC LIMIT 2', [required(team), required(channel)]);
      if (!rows.length) return undefined;
      const updates = await database.query('SELECT thread_id,user_id,message_ts FROM standup_updates WHERE workspace_id=$1 AND channel_id=$2 AND thread_id=ANY($3::uuid[]) ORDER BY submitted_at,message_ts', [team, channel, rows.map(row => row.id)]);
      const states = rows.map(row => ({ ts: row.message_ts, AT: millis(row.started_at), u: Object.fromEntries(updates.rows.filter(update => update.thread_id === row.id).map(update => [update.user_id, update.message_ts])) }));
      return { ...states[0], ...(states[1] ? { last: states[1] } : {}) };
    },
    async saveThread(team, channel, ts, AT) {
      await database.transaction(async client => {
        await ensure(client, team, channel);
        await client.query('INSERT INTO standup_threads(workspace_id,channel_id,message_ts,started_at) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,channel_id,message_ts) DO NOTHING', [team, channel, required(ts), new Date(AT)]);
      });
    },
    async getStandup(team, channel, ts) {
      const { rows } = await database.query(`SELECT s.*,t.message_ts AS thread_ts FROM standup_updates s LEFT JOIN standup_threads t ON t.id=s.thread_id AND t.workspace_id=s.workspace_id
        WHERE s.workspace_id=$1 AND s.channel_id=$2 AND s.message_ts=$3`, [required(team), required(channel), required(ts)]);
      return standup(rows[0]);
    },
    async getStandups(team, channel, since) {
      const { rows } = await database.query(`SELECT s.*,t.message_ts AS thread_ts FROM standup_updates s LEFT JOIN standup_threads t ON t.id=s.thread_id AND t.workspace_id=s.workspace_id
        WHERE s.workspace_id=$1 AND s.channel_id=$2 AND s.submitted_at >= $3 ORDER BY s.message_ts`, [required(team), required(channel), new Date(since)]);
      return rows.map(standup);
    },
    async saveStandup({ team, channel, user, ts, cts, values, AT, link }) {
      await database.transaction(async client => {
        await ensure(client, team, channel, [user]);
        const thread = await client.query('SELECT id FROM standup_threads WHERE workspace_id=$1 AND channel_id=$2 AND message_ts=$3', [team, channel, required(cts)]);
        if (!thread.rows.length) throw new Error('Standup thread missing');
        const result = await client.query(`INSERT INTO standup_updates(workspace_id,channel_id,thread_id,user_id,mood,previous_work,planned_work,blockers,submitted_at,message_ts,permalink)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(workspace_id,channel_id,message_ts) DO NOTHING RETURNING id`,
        [team, channel, thread.rows[0].id, user, values.m || null, values.l || null, values.t || null, values.b || null, new Date(AT), required(ts), link || null]);
        if (result.rows.length && values.k?.length) await recognition(client, { team, channel, from: user, recipients: values.k, ts, AT, link, cts, reason: values.kr, standupId: result.rows[0].id });
      });
    },
    async getRecognition(team, since) {
      const { rows } = await database.query(`SELECT e.*,r.recipient_id,r.units FROM recognition_events e JOIN recognition_recipients r ON r.workspace_id=e.workspace_id AND r.event_id=e.id
        WHERE e.workspace_id=$1 AND e.occurred_at >= $2 ORDER BY e.occurred_at,e.id,r.id`, [required(team), new Date(since)]);
      return rows.flatMap(row => Array.from({ length: row.units }, () => ({ team: row.workspace_id, ch: row.channel_id, k: row.recipient_id, f: row.sender_id,
        kr: row.reason || false, cts: row.thread_ts || false, ts: row.message_ts, AT: millis(row.occurred_at), link: row.permalink, type: row.kind })));
    },
    async saveRecognition(event) { await database.transaction(client => recognition(client, event)); },
    async savePick({ team, channel, user, selected, candidates, purpose, question, count, ts, AT }) {
      if (!Number.isInteger(count) || count < 1 || !selected.length) throw new Error('Invalid pick quantity');
      if (new Set(selected).size !== selected.length || selected.some(user => !candidates.includes(user))) throw new Error('Invalid pick selection');
      await database.transaction(async client => {
        await ensure(client, team, channel, [user, ...candidates]);
        const result = await client.query(`INSERT INTO pick_events(id,workspace_id,channel_id,requested_by,purpose,question,requested_count,occurred_at,message_ts)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,channel_id,message_ts) DO NOTHING RETURNING id`,
        [randomUUID(), team, channel, user, purpose || null, question || null, count, new Date(AT), required(ts)]);
        if (!result.rows.length) return;
        const users = [...new Set(candidates)];
        await client.query('INSERT INTO pick_participants(workspace_id,event_id,user_id,selected_position) SELECT $1,$2,u,p FROM unnest($3::text[],$4::int[]) AS participants(u,p)',
          [team, result.rows[0].id, users, users.map(user => selected.includes(user) ? selected.indexOf(user) : null)]);
      });
    },
    async getMembership(team, channel) {
      const result = await database.query('SELECT membership_refreshed_at FROM channels WHERE workspace_id=$1 AND channel_id=$2', [required(team), required(channel)]);
      if (!result.rows[0]?.membership_refreshed_at) return undefined;
      const { rows } = await database.query('SELECT cm.user_id,m.is_bot FROM channel_members cm JOIN members m ON m.workspace_id=cm.workspace_id AND m.user_id=cm.user_id WHERE cm.workspace_id=$1 AND cm.channel_id=$2 AND NOT m.is_deleted', [team, channel]);
      return { usersAT: millis(result.rows[0].membership_refreshed_at), users: Object.fromEntries(rows.filter(row => !row.is_bot).map(row => [row.user_id, true])), bots: Object.fromEntries(rows.filter(row => row.is_bot).map(row => [row.user_id, true])) };
    },
    async saveMembership(team, channel, users, bots, AT) {
      await database.transaction(async client => {
        await ensure(client, team, channel, [...Object.keys(users), ...Object.keys(bots)]);
        await client.query('SELECT 1 FROM channels WHERE workspace_id=$1 AND channel_id=$2 FOR UPDATE', [team, channel]);
        await client.query('DELETE FROM channel_members WHERE workspace_id=$1 AND channel_id=$2', [team, channel]);
        await client.query('INSERT INTO channel_members(workspace_id,channel_id,user_id,observed_at) SELECT $1,$2,unnest($3::text[]),$4', [team, channel, [...new Set([...Object.keys(users), ...Object.keys(bots)])], new Date(AT)]);
        if (Object.keys(bots).length) await client.query('UPDATE members SET is_bot=true WHERE workspace_id=$1 AND user_id=ANY($2::text[])', [team, Object.keys(bots)]);
        await client.query('UPDATE channels SET membership_refreshed_at=$3 WHERE workspace_id=$1 AND channel_id=$2', [team, channel, new Date(AT)]);
      });
    },
  };
}
module.exports = { createWorkflowRepository };
