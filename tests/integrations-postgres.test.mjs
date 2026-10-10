import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import collaboration from '../server/rituals/collaboration.js';
import integrations from '../server/integrations/service.js';
import oauthModule from '../server/integrations/oauth.js';

test('Issue sync on isolated Postgres: OAuth, org boundaries, explicit import, conflicts and disconnect', { skip: process.env.KICK_DB_BRANCH !== 'br-misty-glitter-awuyz2hu' }, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 6 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db), team = `integrations-${randomUUID()}`;
  let now = Date.parse('2026-10-12T18:00Z'), adminEnabled = true, refreshed = 0, changed = 0;
  const remote = { id: '42', title: 'Ship the launch', status: 'open', done: false, revision: 'v1', states: [{ id: 'open', label: 'Open' }, { id: 'closed', label: 'Closed' }] };
  const env = { KICK_GITHUB_CLIENT_ID: 'test-client', KICK_GITHUB_CLIENT_SECRET: 'test-secret' };
  const admin = async ctx => { if (!adminEnabled || ctx.user !== 'U1') throw new Error('Admin required'); };
  const authorize = async (_c, user) => { if (!['U1','U2'].includes(user)) throw new Error('Not a member'); };
  const providerApi = {
    exchange: async () => ({ access: 'access-secret', refresh: 'refresh-secret', expires: now + 1000 }),
    refresh: async () => { refreshed++; return { access: 'new-access', refresh: 'new-refresh', expires: now + 86400000 }; },
    roots: async () => [{ id: 'root', label: 'Example Org' }],
    containers: async (_p, _t, root) => root === 'root' ? [{ id: 'org/repo', label: 'Example repo' }] : [],
    issue: async (_p, _t, m, id) => { assert.equal(m.container, 'org/repo'); assert.equal(id, '42'); return structuredClone(remote); },
    change: async (_p, _t, _m, id, state) => { assert.equal(id, '42'); changed++; remote.status = state; remote.done = state === 'closed'; remote.revision = `changed-${changed}`; },
  };
  const collab = collaboration.createCollaboration(store, {}, { authorize, clock: () => now });
  const api = integrations.createIntegrations(store, { access: collab.access, admin, member: authorize, providerApi, env, clock: () => now });
  const oauth = oauthModule.createOAuth(store, { admin, providerApi, env, clock: () => now });
  const c = { id: storage.key(team, 'workflow'), team, channel: 'C1', owner: 'U1', name: 'Daily', workflowKey: 'default', enabled: false, zone: 'UTC', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: ['U1','U2'], template: 'standup', questions: ['Next?'], retentionDays: 30, roundup: false, nextAt: now, updatedAt: now };
  const ctx = { team, user: 'U1', config: c.id };
  let conn, mapping, link, action;
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1)', [team]); await store.set('configs', c.id, c);
    await t.test('OAuth state is browser-bound, tenant-bound and consumed once; credentials never enter lists', async () => {
      await assert.rejects(api.ticket({ ...ctx, user: 'U2' }, 'github'), /Admin/);
      const url = new URL(await api.ticket(ctx, 'github')), ticket = url.searchParams.get('ticket');
      const start = await oauth.start(ticket, 'github');
      await assert.rejects(oauth.start(ticket, 'github'), /expired/);
      await assert.rejects(oauth.finish('github', start.state, 'x'.repeat(43), 'code'), /browser/);
      await assert.rejects(oauth.finish('linear', start.state, start.browser, 'code'), /browser/);
      await oauth.finish('github', start.state, start.browser, 'code');
      await assert.rejects(oauth.finish('github', start.state, start.browser, 'code'), /expired/);
      const connections = await api.list(ctx, 'connections'); conn = connections[0];
      assert.equal(connections.length, 1); assert.equal(conn.credentials, undefined);
      assert.ok(!(await store.get('connections', conn.id)).credentials.includes('access-secret'));
      const responses = await Promise.all([api.roots(ctx, conn.id), api.roots(ctx, conn.id)]);
      assert.equal(responses.length, 2); assert.equal(refreshed, 1);
      await assert.rejects(api.roots({ ...ctx, team: 'OTHER' }, conn.id), /unavailable/);
    });
    await t.test('mapping is explicit and scoped; import is deduplicated and copies no private records', async () => {
      await assert.rejects(api.map(ctx, { connection: conn.id, root: 'bad', container: 'org/repo' }), /accessible/);
      mapping = await api.map(ctx, { connection: conn.id, root: 'root', container: 'org/repo' });
      assert.equal(await api.map(ctx, { connection: conn.id, root: 'root', container: 'org/repo' }), mapping);
      const payload = { mapping, remote: '42', revision: 'v1', owner: 'U2', due: '2026-10-20' };
      const ids = await Promise.all([api.importIssue(ctx, payload), api.importIssue(ctx, payload)]);
      assert.equal(ids[0], ids[1]); link = ids[0];
      const p = await api.inspect(ctx, link); action = p.action.id;
      assert.equal(p.action.detail, remote.title); assert.equal(p.action.owner, 'U2');
      const listed = (await api.list(ctx, 'issuelinks'))[0];
      assert.equal(typeof listed.syncedAt, 'number'); assert.ok(new Date(listed.syncedAt).toISOString());
      assert.equal((await store.list('actions', 'config', '==', c.id)).length, 1);
      await assert.rejects(api.inspect({ ...ctx, user: 'U2' }, link), /Admin/);
      assert.equal((await store.list('jobs', 'config', '==', c.id)).length, 0);
    });
    await t.test('two-way status sync rejects stale previews and exposes conflicts without automatic overwrite', async () => {
      const first = await api.inspect(ctx, link);
      await store.set('actions', action, { status: 'done' });
      await assert.rejects(api.sync(ctx, link, 'push', first.snapshot, 'closed'), /changed/);
      assert.equal(changed, 0);
      const p = await api.inspect(ctx, link);
      await assert.rejects(api.sync(ctx, link, 'push', p.snapshot, 'open'), /matching/);
      await api.sync(ctx, link, 'push', p.snapshot, 'closed'); assert.equal(changed, 1);
      await assert.rejects(api.sync(ctx, link, 'push', p.snapshot, 'closed'), /changed/); assert.equal(changed, 1);
      await store.set('actions', action, { status: 'open' }); remote.status = 'in-progress'; remote.done = false; remote.revision = 'v3';
      const conflict = await api.inspect(ctx, link); assert.equal(conflict.conflict, true);
      await api.sync(ctx, link, 'pull', conflict.snapshot);
      assert.equal((await store.get('actions', action)).status, 'open'); assert.equal(changed, 1);
      await assert.rejects(api.sync(ctx, link, 'delete', conflict.snapshot), /direction/);
    });
    await t.test('disconnect erases credentials and links, preserves tasks, and blocks further provider access', async () => {
      await api.remove(ctx, 'connections', conn.id);
      assert.equal(await store.get('connections', conn.id), null);
      assert.equal(await store.get('mappings', mapping), null);
      assert.equal(await store.get('issuelinks', link), null);
      assert.ok(await store.get('actions', action));
      await assert.rejects(api.roots(ctx, conn.id), /disconnected/);
    });
    await t.test('expired tickets and removed admins cannot finish authorization', async () => {
      const url = new URL(await api.ticket(ctx, 'github')), start = await oauth.start(url.searchParams.get('ticket'), 'github');
      adminEnabled = false;
      await assert.rejects(oauth.finish('github', start.state, start.browser, 'code'), /Admin/);
      adminEnabled = true;
      const expired = new URL(await api.ticket(ctx, 'github')); now += 11 * 60000;
      await assert.rejects(oauth.start(expired.searchParams.get('ticket'), 'github'), /expired/);
      await store.cleanup(now);
      assert.equal((await store.list('oauth', 'team', '==', team)).length, 0);
    });
  } finally { await db.query('DELETE FROM workspaces WHERE id=$1', [team]); await pool.end(); }
});
