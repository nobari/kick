import { createHash } from 'node:crypto';
import { decodeFields, stableId, requiredText as text, optionalText as optional, instant } from './legacy-values.mjs';
import encryption from '../../server/db/encryption.cjs';

// Pure planning: no network or database writes. Unknown or invalid documents
// block import. Full source documents stay in the authenticated encrypted backup.
export function normalizedPlan(snapshot, dataKey) {
  if (!snapshot.verified || !snapshot.records) throw new Error('Verified collected snapshot required');
  const tables = Object.fromEntries([
    'enterprises', 'workspaces', 'members', 'channels', 'channel_members', 'slack_installations',
    'workspace_settings', 'standup_threads', 'standup_updates', 'recognition_events',
    'recognition_recipients', 'pick_events', 'pick_participants', 'legacy_metric_baselines',
  ].map(name => [name, new Map()]));
  const audit = [], failures = {};
  const sourceNames = new Set(snapshot.records.map(doc => doc.name));
  const put = (table, key, row) => {
    const prior = tables[table].get(key) || {};
    tables[table].set(key, { ...prior, ...Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined)) });
    return row.id || key;
  };
  const workspace = id => put('workspaces', text(id), { id });
  const member = (wid, uid, fields = {}) => {
    workspace(wid); text(uid);
    put('members', JSON.stringify([wid, uid]), { workspace_id: wid, user_id: uid, ...fields });
    return uid;
  };
  const channel = (wid, cid, fields = {}) => {
    workspace(wid); text(cid);
    put('channels', JSON.stringify([wid, cid]), { workspace_id: wid, channel_id: cid, ...fields });
    return cid;
  };
  const thread = (wid, cid, ts, at) => {
    channel(wid, cid); text(ts);
    const id = stableId('thread', wid, cid, ts);
    const previous = tables.standup_threads.get(id)?.started_at;
    put('standup_threads', id, { id, workspace_id: wid, channel_id: cid, message_ts: ts, started_at: previous && previous < at ? previous : at });
    return id;
  };
  const prefix = `projects/${snapshot.report.project}/databases/${snapshot.report.database}/documents/`;
  for (const doc of snapshot.records) {
    let path, root = 'unknown';
    try {
      if (!doc.name.startsWith(prefix)) throw new Error('Unexpected source database');
      path = doc.name.slice(prefix.length);
      const parts = path.split('/');
      root = parts[0];
      const [collection, owner, group, item] = parts;
      const d = collection === 'err' ? {} : decodeFields(doc.fields);
      const at = instant(d.AT, doc.createTime);
      let targetTable = null, targetId = null, disposition = 'imported';
      if (collection === 'err' && parts.length === 2) {
        disposition = 'archived';
      } else if (['auth', 'Dauth'].includes(collection) && parts.length === 2) {
        const enterpriseId = d.enterprise?.id || null;
        if (enterpriseId) put('enterprises', enterpriseId, { id: text(enterpriseId), name: optional(d.enterprise.name) });
        const wid = d.isEnterpriseInstall ? null : text(d.team?.id);
        if (wid) { workspace(wid); put('workspaces', wid, { id: wid, name: optional(d.team.name), enterprise_id: enterpriseId }); }
        if (d.isEnterpriseInstall && !enterpriseId) throw new Error('Missing installation enterprise');
        targetTable = 'slack_installations';
        const environments = [ ...(d.bot?.token ? ['production'] : []), ...(d.bot?.TESTtoken ? ['test'] : []) ];
        if (!environments.length) throw new Error('Missing installation credential');
        for (const environment of environments) {
          const envelope = structuredClone(d);
          if (environment === 'test') envelope.bot.token = envelope.bot.TESTtoken;
          delete envelope.bot.TESTtoken;
          const id = stableId('installation', path, environment);
          targetId ||= id;
          put(targetTable, id, { id, workspace_id: wid, enterprise_id: enterpriseId, is_enterprise: !!d.isEnterpriseInstall,
            environment, app_id: optional(d.appId), bot_id: optional(d.bot.id), bot_user_id: optional(d.bot.userId),
            installer_user_id: optional(d.user?.id), bot_scopes: d.bot.scopes || [], user_scopes: d.user?.scopes || [],
            credentials_ciphertext: encryption.seal(envelope, `installation:${id}`, dataKey), key_version: 1,
            created_at: instant(doc.createTime), updated_at: instant(doc.updateTime), revoked_at: collection === 'Dauth' ? instant(doc.updateTime) : null,
            legacy_source: `${path}:${environment}` });
        }
      } else if (collection === 'info' && parts.length === 2) {
        workspace(owner); targetTable = 'workspaces'; targetId = owner;
        put(targetTable, owner, { id: owner, domain: optional(d.domain) });
        for (const [category, setting] of Object.entries(d.set || {})) {
          for (const [name, value] of Object.entries(setting.v || {})) {
            const key = JSON.stringify([owner, category, name]);
            put('workspace_settings', key, { workspace_id: owner, category, name, value: text(value),
              updated_by: optional(setting.f), updated_at: instant(setting.AT, at) });
          }
        }
      } else if (collection === 'info' && parts.length === 4 && group === 'u') {
        targetTable = 'members'; targetId = JSON.stringify([owner, item]);
        member(owner, item, { username: optional(d.user_name || d.name), display_name: optional(d.profile?.display_name),
          is_bot: d.is_bot === undefined ? undefined : !!d.is_bot, is_deleted: !!d.deleted, refreshed_at: at });
      } else if (collection === 'info' && parts.length === 4 && group === 'c') {
        targetTable = 'channels'; targetId = JSON.stringify([owner, item]);
        channel(owner, item, { name: optional(d.name), is_private: d.is_private ?? null, is_archived: !!d.is_archived,
          purpose: optional(d.purpose?.value), topic: optional(d.topic?.value), refreshed_at: at,
          membership_refreshed_at: d.usersAT ? instant(d.usersAT) : null });
        for (const uid of new Set([...Object.keys(d.users || {}), ...Object.keys(d.bots || {})])) {
          member(owner, uid, d.bots?.[uid] ? { is_bot: true } : {});
          put('channel_members', JSON.stringify([owner, item, uid]), { workspace_id: owner, channel_id: item, user_id: uid, observed_at: at });
        }
      } else if (collection === 'sync' && parts.length === 4) {
        channel(owner, group); member(owner, d.f);
        targetTable = 'standup_updates'; targetId = stableId('standup', path);
        put(targetTable, targetId, { id: targetId, workspace_id: owner, channel_id: group, user_id: d.f,
          thread_id: d.cts ? thread(owner, group, d.cts, at) : null, message_ts: text(item),
          mood: optional(d.values?.m), previous_work: optional(d.values?.l), planned_work: optional(d.values?.t),
          blockers: optional(d.values?.b), submitted_at: at, updated_at: instant(doc.updateTime), permalink: optional(d.link), legacy_source: path });
      } else if (collection === 'kudos' && parts.length === 2) {
        const wid = text(d.team), cid = channel(wid, d.ch), kind = d.type || 'kudos';
        if (!['coin', 'kudos'].includes(kind)) throw new Error('Unknown recognition kind');
        member(wid, d.f); member(wid, d.k);
        const id = stableId('recognition', wid, cid, text(d.ts), kind, d.f);
        const event = { id, workspace_id: wid, channel_id: cid, sender_id: d.f, kind, reason: optional(d.kr),
          message_ts: d.ts, thread_ts: optional(d.cts), permalink: optional(d.link), occurred_at: at };
        const standupPath = `sync/${wid}/${cid}/${d.ts}`;
        if (sourceNames.has(`${prefix}${standupPath}`)) event.standup_id = stableId('standup', standupPath);
        const prior = tables.recognition_events.get(id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error('Conflicting recognition event');
        put('recognition_events', id, event);
        targetTable = 'recognition_recipients'; targetId = stableId('grant', path);
        put(targetTable, targetId, { id: targetId, workspace_id: wid, event_id: id, recipient_id: d.k, units: 1, legacy_source: path });
      } else if (collection === 'pick' && parts.length === 2) {
        const wid = text(d.team), cid = channel(wid, d.c);
        member(wid, d.by);
        targetTable = 'pick_events'; targetId = stableId('pick', path);
        const selected = d.ps || (d.p ? [d.p] : []);
        const count = d.n || selected.length;
        if (!Array.isArray(selected) || !Number.isInteger(count) || count <= 0 || new Set(selected).size !== selected.length) throw new Error('Invalid pick result');
        put(targetTable, targetId, { id: targetId, workspace_id: wid, channel_id: cid, requested_by: d.by,
          purpose: optional(d.for), question: optional(d.q), requested_count: count, occurred_at: at, message_ts: optional(d.ts), legacy_source: path });
        selected.forEach((uid, position) => {
          member(wid, uid);
          put('pick_participants', JSON.stringify([targetId, uid]), { workspace_id: wid, event_id: targetId, user_id: uid, selected_position: position });
        });
      } else if (collection === 'stat' && parts.length === 4 && ['sync', 'kudos', 'pick'].includes(group)) {
        member(owner, item); targetTable = 'legacy_metric_baselines';
        for (const [dimension, value] of Object.entries(d)) {
          if (dimension === 'AT') continue;
          if (typeof value !== 'bigint' && !Number.isSafeInteger(value)) throw new Error('Invalid metric baseline');
          const key = JSON.stringify([owner, item, group, dimension]);
          put(targetTable, key, { workspace_id: owner, user_id: item, metric: group, dimension, value: String(value), as_of: at });
        }
      } else if (collection === 'stat' && parts.length === 4 && ['sc', 'c'].includes(group)) {
        if (d.ts) thread(owner, item, d.ts, at);
        if (d.last?.ts) thread(owner, item, d.last.ts, instant(d.last.AT, at));
        disposition = 'derived'; targetTable = 'standup_threads';
      } else if (collection === 'statc' && parts.length === 4) {
        thread(owner, group, item, at); disposition = 'derived'; targetTable = 'standup_threads';
      } else throw new Error('Unrecognized legacy document');
      audit.push({ source_path: path, source_hash: createHash('sha256').update(JSON.stringify(doc)).digest('hex'), disposition, target_table: targetTable, target_id: targetId });
    } catch (error) {
      const safeReasons = new Set(['Unexpected source database', 'Unsupported legacy value type', 'Invalid required legacy text',
        'Invalid legacy timestamp', 'Missing installation enterprise', 'Missing installation credential', 'Unknown recognition kind',
        'Conflicting recognition event', 'Invalid pick result', 'Invalid metric baseline', 'Unrecognized legacy document',
        'Database encryption key must be 32 bytes in base64']);
      const safeRoot = Object.hasOwn(tables, root) || ['auth', 'Dauth', 'err', 'info', 'sync', 'stat', 'statc', 'kudos', 'pick'].includes(root) ? root : 'unknown';
      const category = `${safeRoot}:${safeReasons.has(error.message) ? error.message : 'Invalid legacy encoding'}`;
      failures[category] = (failures[category] || 0) + 1;
    }
  }
  // A failed document can have contributed stubs; the caller MUST reject the
  // entire plan when failures exist. Never commit a partial best-effort import.
  return { tables, audit, failures, ready: Object.keys(failures).length === 0 && audit.length === snapshot.documents };
}
