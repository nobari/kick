import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import engineModule from '../server/rituals/engine.js';
import collaboration from '../server/rituals/collaboration.js';
import productivity from '../server/rituals/productivity.js';

test('Polls, private to-dos and comprehensive reports on isolated Postgres', { skip: process.env.KICK_DB_BRANCH !== 'br-summer-tooth-awtmudnn' }, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 6 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db), team = `productivity-${randomUUID()}`;
  let now = Date.parse('2026-10-01T10:00:00Z');
  const members = new Set(['U1', 'U2', 'U3']), sent = [];
  const engine = engineModule.createEngine(store, async () => ({ chat: { postMessage: async m => { sent.push(m); return { ts: '1' }; } } }), () => now);
  const collab = collaboration.createCollaboration(store, engine, { clock: () => now, authorize: async (_c, user) => { if (!members.has(user)) throw new Error('Not a member'); } });
  const api = productivity.createProductivity(store, engine, { access: collab.access, clock: () => now });
  const c = { id: storage.key(team, 'workflow'), team, channel: 'C1', owner: 'U1', name: 'Daily', workflowKey: 'default', enabled: false, zone: 'UTC', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: [...members], template: 'standup', questions: ['Next?'], retentionDays: 30, roundup: false, nextAt: now, updatedAt: now };
  const ctx = { team, user: 'U1', config: c.id }, other = { ...ctx, user: 'U2' }, intruder = { ...ctx, user: 'U9' };
  let personal, poll;
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1)', [team]);
    await t.test('personal tasks work before any workflow and remain owner-only', async () => {
      const payload = { detail: 'PRIVATE: appointment', due: '2026-10-03' };
      const ids = await Promise.all(Array.from({ length: 4 }, () => api.saveTodo(ctx, payload, 'personal')));
      personal = ids[0]; assert.equal(new Set(ids).size, 1);
      assert.equal((await api.todos(ctx, 0)).length, 1);
      assert.equal((await api.todos(other, 0)).length, 0);
      await assert.rejects(api.todo(other, personal), /unavailable/);
      await assert.rejects(api.todo({ ...ctx, team: 'OTHER' }, personal), /unavailable/);
      await assert.rejects(api.saveTodo(other, { ...payload, id: personal, version: 1 }, 'edit'), /unavailable/);
      assert.equal(await api.deleteTodo(other, personal), false);
      await assert.rejects(api.saveTodo(ctx, { ...payload, due: '2026-02-30' }, 'bad'), /date/);
      await api.saveTodo(ctx, { ...payload, id: personal, version: 1, status: 'done' }, 'complete');
      assert.equal((await api.todo(ctx, personal)).status, 'done');
      await assert.rejects(api.saveTodo(ctx, { ...payload, id: personal, version: 1 }, 'stale'), /changed/);
      assert.equal((await store.list('audit', 'team', '==', team)).length, 0);
      assert.equal((await store.list('jobs', 'team', '==', team)).length, 0);
    });
    await store.set('configs', c.id, c);
    await t.test('poll creation validates options and announces once on retries', async () => {
      await assert.rejects(api.createPoll(ctx, { title: 'Duplicate?', options: 'Yes\nyes' }, 'bad'), /different choices/);
      await assert.rejects(api.createPoll(intruder, { title: 'Bad?', options: 'A\nB' }, 'bad'), /member/);
      const ids = await Promise.all(Array.from({ length: 4 }, () => api.createPoll(ctx, { title: 'Demo day <!channel>?', options: 'Tuesday\nThursday' }, 'poll')));
      poll = ids[0]; assert.equal(new Set(ids).size, 1);
      assert.equal((await api.polls(ctx)).length, 1);
      assert.equal((await api.polls(ctx, 8)).length, 0);
      await assert.rejects(api.polls(intruder), /member/);
      const jobs = await store.list('jobs', 'config', '==', c.id);
      assert.equal(jobs.length, 1); assert.match(jobs[0].reason, /&lt;!channel&gt;/);
      await engine.deliver(jobs[0]); assert.equal(sent.length, 1); // Explicit notice even when check-ins paused.
    });
    await t.test('votes are unique, changeable, tenant-scoped and closed atomically', async () => {
      await Promise.all(Array.from({ length: 5 }, () => api.vote(other, poll, 0)));
      assert.deepEqual((await api.pollDetail(ctx, poll)).counts, [1, 0]);
      await api.vote(other, poll, 1);
      assert.deepEqual((await api.pollDetail(ctx, poll)).counts, [0, 1]);
      assert.equal((await api.pollDetail(other, poll)).myChoice, 1);
      assert.equal((await api.pollDetail(ctx, poll)).myChoice, null);
      await assert.rejects(api.vote(ctx, poll, 2), /option/);
      await assert.rejects(api.vote(intruder, poll, 0), /member/);
      await assert.rejects(api.pollDetail({ ...ctx, team: 'OTHER' }, poll), /unavailable/);
      await assert.rejects(api.closePoll(other, poll), /creator/);
      await Promise.all([api.closePoll(ctx, poll), api.closePoll(ctx, poll)]);
      await assert.rejects(api.vote(other, poll, 0), /closed/);
      assert.equal((await store.list('jobs', 'config', '==', c.id)).length, 2);
    });
    await t.test('shared to-dos support assignee completion, not unrelated-member edits', async () => {
      const payload = { detail: 'Prepare demo', owner: 'U2', due: '2026-09-30' };
      const id = await collab.action(ctx, payload, 'shared');
      await assert.rejects(collab.action({ ...ctx, user: 'U3' }, { ...payload, id, status: 'done' }, 'bad'), /Only/);
      await collab.action(other, { ...payload, id, status: 'done' }, 'complete');
      assert.equal((await collab.list(other, 'actions'))[0].status, 'done');
      assert.ok(!(await collab.search(ctx, { query: 'PRIVATE' })).length);
    });
    await t.test('combined reports count only selected retained workflow, respect dates, exclude private data', async () => {
      const filters = { from: '2026-10-01', to: '2026-10-01' };
      const r = await api.report(ctx, filters);
      assert.equal(r.stats.actions.total, 1); assert.equal(r.stats.actions.done, 1);
      assert.equal(r.stats.polls.total, 1); assert.equal(r.stats.polls.closed, 1); assert.equal(r.stats.ballots.total, 1);
      assert.equal(r.stats.responses.total, 0); assert.ok(!JSON.stringify(r).includes('appointment'));
      assert.equal((await api.report(ctx, { from: '2026-10-02', to: '2026-10-02' })).stats.polls.total, 0);
      await assert.rejects(api.report(intruder, filters), /member/);
      await assert.rejects(api.report(ctx, { from: '2026-01-01', to: '2026-10-01' }), /90/);
      await assert.rejects(api.report(ctx, { from: '2026-10-02', to: '2026-10-01' }), /ordered/);
      const c2 = { ...c, id: storage.key(team, 'second'), workflowKey: 'second' };
      await store.set('configs', c2.id, c2);
      assert.equal((await api.report({ ...ctx, config: c2.id }, filters)).stats.actions.total, 0);
      await api.shareReport(ctx, filters, 'share'); await api.shareReport(ctx, filters, 'share');
      const jobs = (await store.list('jobs', 'config', '==', c.id)).filter(j => j.reason.startsWith('Kick report'));
      assert.equal(jobs.length, 1); assert.ok(!jobs[0].reason.includes('appointment'));
    });
    await t.test('personal pagination, deletion and expiry; channel retention cascades to ballots', async () => {
      for (let i = 0; i < 9; i++) await api.saveTodo(ctx, { detail: `Task ${i}`, due: '2026-10-03' }, `p${i}`);
      assert.equal((await api.todos(ctx, 0)).length, 9); assert.equal((await api.todos(ctx, 8)).length, 2);
      assert.equal(await api.deleteTodo(ctx, personal), true); assert.equal(await api.deleteTodo(ctx, personal), false);
      await store.shortenRetention(c.id, 7);
      now += 8 * 86400000;
      await assert.rejects(api.pollDetail(ctx, poll), /unavailable/);
      assert.equal((await api.report(ctx, { from: '2026-10-01', to: '2026-10-01' })).stats.polls.total, 0);
      assert.equal((await api.todos(ctx, 0)).length, 9); // Independent 30-day personal retention.
      await store.cleanup(now); assert.equal((await store.list('ballots', 'config', '==', c.id)).length, 0);
      now += 23 * 86400000;
      assert.equal((await api.todos(ctx, 0)).length, 0);
      await store.cleanup(now); assert.equal((await store.list('todos', 'team', '==', team)).length, 0);
    });
  } finally { await db.query('DELETE FROM workspaces WHERE id=$1', [team]); await pool.end(); }
});
