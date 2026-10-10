import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import collaboration from '../server/rituals/collaboration.js';
import planning from '../server/rituals/planning.js';
import productivity from '../server/rituals/productivity.js';

test('Team planning on isolated Postgres: permissions, concurrency, metrics, retention and reporting', { skip: process.env.KICK_DB_BRANCH !== 'br-misty-glitter-awuyz2hu' }, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 6 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db), team = `planning-${randomUUID()}`;
  let now = Date.parse('2026-10-10T10:00Z');
  const members = new Set(['U1', 'U2', 'U3']);
  const authorize = async (_c, user) => { if (!members.has(user)) throw new Error('Not a member'); };
  const collab = collaboration.createCollaboration(store, {}, { clock: () => now, authorize });
  const api = planning.createPlanning(store, { access: collab.access, authorize, clock: () => now });
  const reports = productivity.createProductivity(store, {}, { access: collab.access, clock: () => now });
  const c = { id: storage.key(team, 'workflow'), team, channel: 'C1', owner: 'U1', name: 'Daily', workflowKey: 'default', enabled: false, zone: 'UTC', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: [...members], template: 'standup', questions: ['Next?'], retentionDays: 30, roundup: false, nextAt: now, updatedAt: now };
  const ctx = { team, user: 'U1', config: c.id }, other = { ...ctx, user: 'U2' }, intruder = { ...ctx, user: 'U9' };
  const decision = { title: 'Use weekly releases', detail: 'Release Thursdays', rationale: 'Predictable review window', owner: 'U2', review: '2026-10-20', status: 'proposed' };
  const objective = { title: 'Reduce lead time', owner: 'U2', start: '2026-10-10', end: '2026-10-30', status: 'active' };
  let decisionId, objectiveId, resultId;
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1)', [team]);
    await store.set('configs', c.id, c);
    await t.test('decisions are tenant-scoped, idempotent and protected against stale updates', async () => {
      const ids = await Promise.all(Array.from({ length: 4 }, () => api.save(ctx, 'decisions', decision, 'create')));
      decisionId = ids[0]; assert.equal(new Set(ids).size, 1);
      assert.equal((await api.list(ctx, 'decisions')).length, 1);
      await assert.rejects(api.record({ ...ctx, team: 'OTHER' }, 'decisions', decisionId), /unavailable/);
      await assert.rejects(api.list(intruder, 'decisions'), /member/);
      await assert.rejects(api.save({ ...ctx, user: 'U3' }, 'decisions', { ...decision, id: decisionId, version: 1 }, 'edit'), /Only/);
      await api.save(other, 'decisions', { ...decision, id: decisionId, status: 'accepted', version: 1 }, 'accept');
      await api.save(other, 'decisions', { ...decision, id: decisionId, status: 'accepted', version: 1 }, 'accept');
      assert.equal((await api.record(ctx, 'decisions', decisionId)).version, 2);
      await assert.rejects(api.save(other, 'decisions', { ...decision, id: decisionId, version: 1 }, 'stale'), /changed/);
      await assert.rejects(api.save(ctx, 'decisions', { ...decision, owner: 'U9' }, 'outsider'), /member/);
      await assert.rejects(api.save(ctx, 'decisions', { ...decision, review: '2027-01-01' }, 'future'), /expires/);
      await assert.rejects(api.list(ctx, 'todos'), /Invalid/);
      await assert.rejects(api.list(ctx, 'decisions', -1), /Reopen/);
    });
    await t.test('objectives and key results measure both increasing and decreasing targets', async () => {
      objectiveId = await api.save(ctx, 'objectives', objective, 'objective');
      const data = { objective: objectiveId, title: 'Lead time', owner: 'U2', unit: 'days', baseline: '10', current: '5', target: '0' };
      resultId = await api.save(other, 'results', data, 'result');
      assert.equal((await api.record(ctx, 'results', resultId)).progress, 50);
      await assert.rejects(api.save({ ...ctx, user: 'U3' }, 'results', data, 'bad'), /Only/);
      for (const n of ['NaN', 'Infinity', '', '1000000001']) await assert.rejects(api.save(ctx, 'results', { ...data, current: n }, 'invalid'), /number/);
      await assert.rejects(api.save(ctx, 'results', { ...data, target: 10 }, 'equal'), /differ/);
      await api.save(ctx, 'objectives', { ...objective, id: objectiveId, version: 1, status: 'closed' }, 'close');
      await assert.rejects(api.save(other, 'results', { ...data, id: resultId, version: 1 }, 'closed'), /Reopen/);
      await api.save(ctx, 'objectives', { ...objective, id: objectiveId, version: 2, status: 'active' }, 'reopen');
      const simultaneous = await Promise.allSettled([api.save(other, 'results', { ...data, id: resultId, version: 1, current: 3 }, 'a'), api.save(other, 'results', { ...data, id: resultId, version: 1, current: 4 }, 'b')]);
      assert.equal(simultaneous.filter(r => r.status === 'fulfilled').length, 1);
      const child = await api.record(ctx, 'results', resultId), parent = await api.record(ctx, 'objectives', objectiveId);
      assert.ok(child.expiresAt <= parent.expiresAt);
      const c2 = { ...c, id: storage.key(team, 'second'), workflowKey: 'second' };
      await store.set('configs', c2.id, c2);
      await assert.rejects(api.record({ ...ctx, config: c2.id }, 'results', resultId), /unavailable/);
      await assert.rejects(store.create('results', 'cross-tenant-result', { ...child, id: 'cross-tenant-result', config: c2.id, canEdit: undefined, progress: undefined }), e => e.code === '23503');
    });
    await t.test('capacity is self-declared and workload includes overdue tasks but excludes personal or future tasks', async () => {
      assert.equal((await api.capacity(ctx, '2026-10-10')).limit, null);
      const payload = { week: '2026-10-10', limit: 0, version: 0, user: 'U2' };
      await api.saveCapacity(ctx, payload, 'capacity');
      await api.saveCapacity(ctx, payload, 'capacity');
      assert.equal((await api.capacity(ctx, payload.week)).limit, 0);
      assert.equal((await api.capacity(other, payload.week)).limit, null); // Ignores forged owner.
      await assert.rejects(api.saveCapacity(ctx, payload, 'stale'), /changed/);
      await assert.rejects(api.saveCapacity(ctx, { ...payload, week: '2026-09-01' }, 'past'), /this week/);
      await assert.rejects(api.saveCapacity(ctx, { ...payload, limit: 1.5 }, 'fraction'), /whole/);
      await collab.action(ctx, { detail: 'Overdue task', owner: 'U1', due: '2026-10-01' }, 'late');
      await collab.action(ctx, { detail: 'Due this week', owner: 'U1', due: '2026-10-11' }, 'week');
      await collab.action(ctx, { detail: 'Future', owner: 'U1', due: '2026-10-20' }, 'future');
      await reports.saveTodo(ctx, { detail: 'Private appointment', due: '2026-10-10' }, 'personal');
      const r = (await api.workload(ctx, '2026-10-10')).people.find(p => p.user === 'U1');
      assert.deepEqual(r, { user: 'U1', tasks: 2, overdue: 1, limit: 0 });
      assert.equal((await api.workload(ctx, '2026-10-10', 8)).people.length, 0);
      await assert.rejects(api.workload(intruder), /member/);
    });
    await t.test('reports include planning totals; no saves send messages; lists paginate', async () => {
      const r = await reports.report(ctx, { from: '2026-10-10', to: '2026-10-10' });
      assert.equal(r.stats.decisions.total, 1); assert.equal(r.stats.decisions.accepted, 1);
      assert.equal(r.stats.objectives.total, 1); assert.equal(r.stats.results.total, 1);
      assert.ok(!JSON.stringify(r).includes('Private appointment'));
      assert.equal((await store.list('jobs', 'team', '==', team)).length, 0);
      for (let i = 0; i < 9; i++) await api.save(ctx, 'decisions', decision, `page-${i}`);
      assert.equal((await api.list(ctx, 'decisions', 0)).length, 9);
      assert.equal((await api.list(ctx, 'decisions', 8)).length, 2);
      members.delete('U2'); await assert.rejects(api.record(other, 'decisions', decisionId), /member/);
    });
    await t.test('shortened retention hides and cleans planning records and children', async () => {
      await store.shortenRetention(c.id, 7); now += 8 * 86400000;
      for (const [kind, id] of [['decisions', decisionId], ['objectives', objectiveId], ['results', resultId]]) await assert.rejects(api.record(ctx, kind, id), /expired/);
      assert.equal((await api.list(ctx, 'decisions')).length, 0);
      await store.cleanup(now);
      for (const kind of ['capacity', 'decisions', 'objectives', 'results']) assert.equal((await store.list(kind, 'team', '==', team)).length, 0);
    });
  } finally {
    await db.query('DELETE FROM workspaces WHERE id=$1', [team]); await pool.end();
  }
});
