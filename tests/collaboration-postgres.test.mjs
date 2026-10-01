import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import engineModule from '../server/rituals/engine.js';
import collaboration from '../server/rituals/collaboration.js';
import domain from '../server/rituals/domain.js';

test('Collaboration release: isolated Postgres end-to-end workflows', { skip: process.env.KICK_DB_BRANCH !== 'br-summer-tooth-awtmudnn' }, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 6 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db), team = `collab-test-${randomUUID()}`;
  let now = Date.parse('2026-10-01T01:00:00Z');
  const members = new Set(['U1', 'U2', 'U3']), sent = [];
  const client = { conversations: { members: async () => ({ members: [...members] }) }, chat: { postMessage: async m => { sent.push(m); return { ts: '1' }; } } };
  const engine = engineModule.createEngine(store, async () => client, () => now);
  const api = collaboration.createCollaboration(store, engine, { clock: () => now, authorize: async (c, u, admin) => {
    if (!members.has(u)) throw new Error('Not a member');
    if (admin && u !== c.owner) throw new Error('Owner only');
  } });
  const c = { id: engine.configId(team, 'C1'), team, name: 'Daily standup', workflowKey: 'default', channel: 'C1', owner: 'U1', enabled: true, zone: 'Asia/Tokyo', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: [...members], template: 'standup', questions: ['Done?', 'Next?'], retentionDays: 30, roundup: false, nextAt: now, updatedAt: now };
  const ctx = { team, user: 'U1', config: c.id }, second = { ...ctx, user: 'U2' }, stranger = { ...ctx, user: 'U9' };
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1)', [team]);
    await store.set('configs', c.id, c);
    await t.test('multiple workflows retain independent schedules, defaults and data', async () => {
      const another = { ...c, id: engine.configId(team, 'C1', 'wins'), name: 'Weekly wins', workflowKey: 'wins', time: '11:00' };
      await store.set('configs', another.id, another);
      assert.equal((await engine.config(team, 'C1')).id, c.id);
      assert.equal((await engine.config(team, 'C1~wins')).id, another.id);
      assert.equal((await engine.config(team, another.id)).name, 'Weekly wins');
      assert.equal(await engine.config('WRONG', another.id), null);
      assert.equal(await engine.currentRun(another), null);
      assert.ok(await engine.currentRun(c));
    });
    let action, sprint, retro, topic, poker, response;
    await t.test('actions validate ownership, dates, and idempotency under concurrency', async () => {
      const payload = { detail: 'Prepare demo', owner: 'U2', due: '2026-10-03' };
      const ids = await Promise.all(Array.from({ length: 5 }, () => api.action(ctx, payload, 'create-action')));
      action = ids[0]; assert.equal(new Set(ids).size, 1);
      assert.equal((await api.list(ctx, 'actions')).length, 1);
      await assert.rejects(api.action(ctx, { ...payload, due: '2026-02-30' }, 'invalid'), /date/);
      await assert.rejects(api.action({ ...ctx, user: 'U3' }, { ...payload, id: action, status: 'done' }, 'forged'), /Only/);
      await api.action(second, { ...payload, id: action, status: 'done' }, 'done');
      assert.equal((await api.list(ctx, 'actions'))[0].status, 'done');
    });
    await t.test('workspace, membership and foreign keys isolate every record', async () => {
      await assert.rejects(api.list(stranger, 'actions'), /member/);
      await assert.rejects(api.list({ ...ctx, team: 'WRONG' }, 'actions'), /unavailable/);
      await assert.rejects(store.create('actions', 'cross-' + team, { team: 'WRONG', config: c.id, at: now, expiresAt: now + domain.DAY, user: 'U1', owner: 'U1', detail: 'bad', due: '2026-10-01' }), e => e.code === '23503');
      await assert.rejects(api.operations(second), /Owner/);
    });
    await t.test('check-in edits replace before closing and reject stale versions', async () => {
      response = await engine.submit(c, 'U1', ['Initial', 'Prepare demo']);
      await api.editResponse(ctx, response, 1, ['Updated answer', 'Prepare demo'], 'edit-1');
      assert.equal((await store.get('responses', response)).answers[0], 'Updated answer');
      await api.editResponse(ctx, response, 1, ['Updated answer', 'Prepare demo'], 'edit-1');
      await assert.rejects(api.editResponse(ctx, response, 1, ['Stale', 'Stale'], 'edit-2'), /changed/);
      await assert.rejects(api.editResponse(second, response, 2, ['Other', 'Other'], 'edit-3'), /author/);
    });
    await t.test('sprints link actions and report actual retained updates', async () => {
      await assert.rejects(api.sprint(second, { title: 'No', goal: 'No', start: '2026-10-01', end: '2026-10-08' }, 'bad'), /Owner/);
      sprint = await api.sprint(ctx, { title: 'October sprint', goal: 'Release demo', start: '2026-10-01', end: '2026-10-08' }, 'sprint');
      await api.action(ctx, { id: action, detail: 'Prepare demo', owner: 'U2', due: '2026-10-03', status: 'done', sprint }, 'link-sprint');
      await api.sprint(ctx, { id: sprint }, 'close-sprint');
      const s = (await api.list(ctx, 'sprints'))[0];
      assert.match(s.recap, /1\/1 done/); assert.match(s.recap, /1 workflow updates/);
      await api.sprint(ctx, { id: sprint }, 'duplicate-close');
      assert.equal((await store.list('jobs', 'config', '==', c.id)).filter(j => j.id === storage.key(sprint, 'recap')).length, 1);
    });
    await t.test('retros support attributed topics, grouping, unique votes and one converted action', async () => {
      retro = await api.retro(ctx, { title: 'Release retrospective' }, 'retro');
      topic = await api.topic(second, { retro, category: 'Improve', detail: 'Reduce flaky tests' }, 'topic');
      await api.topic(ctx, { retro, id: topic, group: 'Quality' }, 'group');
      await assert.rejects(api.vote(second, topic), /not open/);
      await api.retro(ctx, { id: retro, status: 'voting' }, 'voting');
      await assert.rejects(api.topic(second, { retro, category: 'Keep', detail: 'Late' }, 'late'), /ended/);
      await Promise.all(Array.from({ length: 6 }, () => api.vote(second, topic)));
      const r = await api.retroDetail(ctx, retro);
      assert.equal(r.topics[0].user, 'U2'); assert.equal(r.topics[0].votes, 1); assert.equal(r.topics[0].group, 'Quality');
      const converted = await Promise.all(['a', 'b'].map(request => api.action(ctx, { source: 'topics', sourceId: topic, detail: 'Fix flaky tests', owner: 'U2', due: '2026-10-04' }, request)));
      assert.equal(converted[0], converted[1]);
      await api.retro(ctx, { id: retro, status: 'closed' }, 'close');
      await assert.rejects(api.vote(ctx, topic), /not open/);
    });
    await t.test('planning poker hides others’ votes, supports abstention, reveal, revote and decisions', async () => {
      poker = await api.poker(ctx, { title: 'Shipping work', members: ['U1', 'U2'] }, 'poker');
      await api.poker(ctx, { id: poker, round: 1, value: '5' }, 'vote');
      await api.poker(second, { id: poker, round: 1, value: 'abstain' }, 'vote');
      const hidden = await api.pokerDetail(ctx, poker);
      assert.equal(hidden.myVote, '5'); assert.ok(hidden.votes.every(v => !('value' in v)));
      await assert.rejects(api.poker(second, { id: poker, status: 'revealed' }, 'forged'), /facilitator/);
      await api.poker(ctx, { id: poker, status: 'revealed' }, 'reveal');
      assert.deepEqual((await api.pokerDetail(ctx, poker)).votes.map(v => v.value).sort(), ['5', 'abstain']);
      await assert.rejects(api.poker(second, { id: poker, round: 1, value: '8' }, 'late'), /not open/);
      await api.poker(ctx, { id: poker, status: 'voting' }, 'revote');
      await api.poker(ctx, { id: poker, status: 'voting' }, 'revote');
      assert.equal((await api.pokerDetail(ctx, poker)).round, 2);
      assert.equal((await api.pokerDetail(ctx, poker)).votes.length, 0);
      await assert.rejects(api.poker(second, { id: poker, round: 1, value: '8' }, 'stale-round'), /not open/);
      await api.poker(second, { id: poker, round: 2, value: '3' }, 'vote-2');
      await api.poker(ctx, { id: poker, status: 'revealed' }, 'reveal-2');
      await api.poker(ctx, { id: poker, status: 'closed', decision: '3 points' }, 'decision');
      assert.equal((await api.pokerDetail(ctx, poker)).decision, '3 points');
    });
    await t.test('calendar skips dates, supports day-off overrides, and preserves open-run deadlines', async () => {
      await assert.rejects(api.calendar(ctx, { date: '2026-10-01', skip: true }, 'already-open'), /already opened/);
      await api.calendar(ctx, { date: '2026-10-02', skip: true }, 'holiday');
      now = Date.parse('2026-10-02T01:00:00Z'); assert.equal(await engine.currentRun(c), null);
      await api.calendar(ctx, { date: '2026-10-03', skip: false, time: '10:00', digestTime: '11:00' }, 'saturday');
      now = Date.parse('2026-10-03T01:00:00Z');
      const run = await engine.currentRun(c); assert.ok(run); assert.equal(run.closesAt, Date.parse('2026-10-03T02:00:00Z'));
      assert.equal((await engine.currentRun({ ...c, digestTime: '10:01' })).closesAt, run.closesAt);
      now = Date.parse('2026-10-03T02:01:00Z'); assert.equal(await engine.currentRun(c), null);
      await engine.tickConfig(c);
      assert.ok(await store.get('jobs', storage.key(run.id, 'digest')));
    });
    await t.test('late corrections preserve original answers and enqueue exactly one notice', async () => {
      await api.editResponse(ctx, response, 2, ['Correction text', 'Correct next'], 'correction');
      await api.editResponse(ctx, response, 2, ['Correction text', 'Correct next'], 'correction');
      const r = await store.get('responses', response);
      assert.equal(r.answers[0], 'Updated answer'); assert.match(r.correction, /Correction text/);
      const j = await store.get('jobs', storage.key(response, 'correction', 'correction'));
      assert.equal(j.kind, 'notice'); await engine.deliver(j); assert.match(sent.at(-1).text, /Correction to/);
    });
    await t.test('shortcut confirms create blocker and recognition with escaped output', async () => {
      const b = await api.shortcut(ctx, 'blocker', { detail: 'Need access', owner: 'U2' }, 'shortcut-b');
      assert.equal((await store.get('blockers', b)).helper, 'U2');
      const r = await api.shortcut(ctx, 'kudos', { detail: 'Thanks <!channel>', owner: 'U2' }, 'shortcut-r');
      const j = await store.get('jobs', storage.key(r, 'notice')); assert.match(j.reason, /&lt;!channel&gt;/);
      await assert.rejects(api.shortcut(ctx, 'kudos', { detail: 'Me', owner: 'U1' }, 'self'), /teammate/);
    });
    await t.test('search filters retained own-workflow data by text, user, dates and status', async () => {
      const result = await api.search(ctx, { query: 'demo', user: 'U2', status: 'done', from: '2026-10-01', to: '2026-10-02' });
      assert.ok(result.some(r => r.id === action));
      assert.equal((await api.search(ctx, { query: 'demo', status: 'open' })).length, 0);
      assert.equal((await api.search(ctx, { query: "'; DROP TABLE workspaces; --" })).length, 0);
      await assert.rejects(api.search(stranger, { query: '' }), /member/);
    });
    await t.test('operations retry preserves message identity and rejects sent/leased jobs', async () => {
      const id = storage.key(c.id, 'retry-fixture'); await engine.queue(c, id, { kind: 'notice', reason: 'Test notice' });
      const original = await store.get('jobs', id);
      await assert.rejects(api.retry(ctx, id, 'pending'), /Only failed/);
      await store.set('jobs', id, { status: 'failed', done: true, attempts: 8 });
      await assert.rejects(api.retry(second, id, 'unauthorized'), /Owner/);
      await api.retry(ctx, id, 'retry');
      const j = await store.get('jobs', id); assert.equal(j.clientId, original.clientId); assert.equal(j.attempts, 0); assert.equal(j.status, 'retry');
      const ops = await api.operations(ctx); assert.ok(ops.audit.some(a => a.event === 'delivery_retry'));
    });
    await t.test('retention applies to all new features, search, nested votes and notices', async () => {
      await store.shortenRetention(c.id, 7);
      now += 10 * domain.DAY;
      assert.equal((await api.list(ctx, 'actions')).length, 0);
      assert.equal((await api.search(ctx, { query: 'demo' })).length, 0);
      await assert.rejects(api.pokerDetail(ctx, poker), /unavailable/);
      await store.cleanup(now);
      for (const kind of ['actions', 'sprints', 'retros', 'topics', 'votes', 'poker', 'estimates', 'audit', 'calendar']) assert.equal((await store.list(kind, 'config', '==', c.id)).length, 0, kind);
    });
  } finally {
    await db.query('DELETE FROM workspaces WHERE id=$1', [team]);
    await pool.end();
  }
});
