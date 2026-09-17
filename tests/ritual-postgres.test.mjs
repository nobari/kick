import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import engineModule from '../server/rituals/engine.js';
import domain from '../server/rituals/domain.js';

test('Postgres rituals: real transactions, concurrent workers and all scheduled workflows', {
  skip: process.env.KICK_DB_BRANCH !== 'br-old-voice-aw1siabw',
}, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 4 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db);
  const team = `ritual-test-${randomUUID()}`, other = `ritual-test-${randomUUID()}`;
  let now = Date.parse('2026-09-11T01:00:00Z'); // Friday 10:00 Tokyo
  const sent = [], client = { conversations: {
    members: async () => ({ members: ['U1', 'U2', 'U3'], response_metadata: {} }),
    open: async () => ({ channel: { id: 'D1' } }),
  }, chat: { postMessage: async args => { sent.push(args); return { ts: '123' }; } } };
  const engine = engineModule.createEngine(store, async () => client, () => now);
  const c = { id: engine.configId(team, 'C1'), team, channel: 'C1', owner: 'U1', enabled: true,
    zone: 'Asia/Tokyo', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: ['U1','U2','U3'],
    template: 'standup', questions: domain.TEMPLATES.standup, retentionDays: 30, roundup: true, nextAt: now, updatedAt: now };
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1),($2)', [team, other]);
    await store.set('configs', c.id, c);
    await t.test('typed settings and partial preference merges round trip', async () => {
      const loaded = await engine.config(team, 'C1');
      assert.deepEqual(loaded.questions, c.questions); assert.equal(loaded.nextAt, now);
      const id = storage.key(team, 'U1');
      await store.set('prefs', id, { team, user: 'U1', disabled: true });
      await store.set('prefs', id, { snoozeUntil: now + 1 });
      assert.equal((await store.get('prefs', id)).disabled, true);
      assert.equal((await store.get('prefs', id)).snoozeUntil, now + 1);
    });
    await t.test('queries reject identifier injection', async () => {
      await assert.rejects(store.list('jobs; DROP TABLE workspaces', 'team', '==', team));
      await assert.rejects(store.list('jobs', 'bad column', '==', team));
    });
    await t.test('parallel session creation and submissions are idempotent', async () => {
      const runs = await Promise.all(Array.from({length: 6}, () => engine.currentRun(c)));
      assert.equal(new Set(runs.map(r => r.id)).size, 1);
      const ids = await Promise.all(Array.from({length: 6}, () => engine.submit(c, 'U1', ['Done','Next'], 'Need access', 'U2')));
      assert.equal(new Set(ids).size, 1);
      assert.equal((await store.list('responses', 'config', '==', c.id)).length, 1);
      assert.equal((await store.list('blockers', 'config', '==', c.id)).length, 1);
    });
    await t.test('cross-tenant links fail and response/blocker writes roll back atomically', async () => {
      const run = await engine.currentRun(c);
      const response = { team, config: c.id, run: run.id, user: 'U3', answers: ['a','b'], at: now, expiresAt: now + domain.DAY };
      await assert.rejects(store.submit(storage.key(run.id, 'U3'), response, { team: other, config: c.id, user: 'U3', helper: 'U2', detail: 'bad', at: now, expiresAt: now + domain.DAY }), e => e.code === '23503');
      assert.equal(await store.get('responses', storage.key(run.id, 'U3')), null);
      await assert.rejects(store.set('configs', c.id, { team: other }), /ownership/);
    });
    await t.test('overlapping scheduler ticks deliver a single prompt', async () => {
      await Promise.all([engine.tick(), engine.tick(), engine.tick()]);
      assert.equal(sent.filter(x => x.text.startsWith('Time for')).length, 1);
    });
    await t.test('lease takeover prevents stale completion', async () => {
      await engine.queue(c, 'lease-test-' + team, {kind: 'roundup', since: now});
      const id = 'lease-test-' + team, a = await store.claim('jobs', id, now, 10);
      assert.ok(a); assert.equal(await store.claim('jobs', id, now), null);
      const b = await store.claim('jobs', id, now + 11);
      assert.ok(b); assert.notEqual(a, b);
      assert.equal(await store.finish('jobs', id, a, {done: true}), false);
      assert.equal(await store.finish('jobs', id, b, {done: true, leaseUntil: 0}), true);
    });
    await t.test('reminders target only nonrespondents; recognition and digests use Postgres', async () => {
      now += 65 * 60000;
      await engine.tick();
      assert.equal(sent.filter(x => x.text.startsWith('A gentle')).length, 2);
      await engine.recognize(team, 'C1', 'U1', 'U2', 'Helpful', '123.456');
      await engine.recognize(team, 'C1', 'U1', 'U2', 'Helpful', '123.456');
      now = Date.parse('2026-09-11T08:05:00Z');
      await engine.tick();
      assert.equal(sent.filter(x => x.text.startsWith('Team digest')).length, 1);
      assert.equal(sent.filter(x => x.text.startsWith('Weekly appreciation')).length, 1);
      const [week] = await engine.insights(c); assert.equal(week.participation, 33);
    });
    await t.test('rotation state serializes concurrent picks and retries', async () => {
      const selections = await Promise.all(['a','b','c'].map(id => engine.rotate(c, [], 'Facilitator', id)));
      assert.equal(new Set(selections).size, 3);
      assert.equal(await engine.rotate(c, [], 'Facilitator', 'a'), selections[0]);
      assert.equal((await store.list('rotations', 'config', '==', c.id))[0].history.length, 3);
    });
    await t.test('retention reduction and cleanup remove only expired workflow data', async () => {
      await store.shortenRetention(c.id, 7);
      assert.ok((await store.list('responses', 'config', '==', c.id))[0].expiresAt <= now + 7 * domain.DAY);
      await store.cleanup(now + 8 * domain.DAY);
      assert.equal((await store.list('responses', 'config', '==', c.id)).length, 0);
      assert.ok(await engine.config(team, 'C1'));
      assert.ok(await store.get('prefs', storage.key(team, 'U1')));
    });
  } finally {
    // Only this test's uniquely identified synthetic workspaces; never real data.
    await db.query('DELETE FROM workspaces WHERE id IN ($1,$2)', [team, other]);
    await pool.end();
  }
});
