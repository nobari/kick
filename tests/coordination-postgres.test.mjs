import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import collaboration from '../server/rituals/collaboration.js';
import coordination from '../server/rituals/coordination.js';
import engineModule from '../server/rituals/engine.js';

test('Coordination: real Postgres visibility, approvals, handoffs, checklists and escalation delivery', { skip: process.env.KICK_DB_BRANCH !== 'br-misty-glitter-awuyz2hu' }, async t => {
  const pool = new pg.Pool({ connectionString: rehearsalConnection(), max: 6 });
  const db = connection.databaseForPool(pool), store = storage.createStore(db), team = `coord-${randomUUID()}`;
  let now = Date.parse('2026-10-12T18:00Z');
  const members = new Set(['U1', 'U2', 'U3']);
  const authorize = async (_c, user, admin) => { if (!members.has(user) || (admin && user !== 'U1')) throw new Error('Not authorized'); };
  const collab = collaboration.createCollaboration(store, {}, { clock: () => now, authorize });
  const api = coordination.createCoordination(store, { access: collab.access, authorize, clock: () => now });
  const c = { id: storage.key(team, 'workflow'), team, channel: 'C1', owner: 'U1', name: 'Daily', workflowKey: 'default', enabled: true, zone: 'UTC', time: '09:00', digestTime: '17:00', days: [1,2,3,4,5], members: [...members], template: 'standup', questions: ['Next?'], retentionDays: 30, roundup: false, nextAt: now, updatedAt: now };
  const target = { ...c, id: storage.key(team, 'target'), channel: 'C2', owner: 'U2' };
  const ctx = { team, user: 'U1', config: c.id }, other = { ...ctx, user: 'U2' }, third = { ...ctx, user: 'U3' };
  const data = { title: 'Request', detail: 'Private rationale', owner: 'U2', due: '2026-10-15' };
  try {
    await db.query('INSERT INTO workspaces(id) VALUES($1)', [team]);
    await store.set('configs', c.id, c); await store.set('configs', target.id, target);
    await t.test('approval decisions are participant-only, single-winner, and cannot self-approve', async () => {
      const ids = await Promise.all([api.create(ctx, 'approvals', data, 'a'), api.create(ctx, 'approvals', data, 'a')]);
      assert.equal(ids[0], ids[1]); const id = ids[0];
      assert.equal((await api.list(third, 'approvals')).length, 0);
      assert.equal((await api.list(other, 'approvals', 0, undefined, 'pending')).length, 1);
      assert.equal((await api.list(ctx, 'approvals', 0, undefined, 'pending')).length, 0);
      await assert.rejects(api.list(ctx, 'approvals', 0, undefined, "pending' OR true"), /filter/);
      await assert.rejects(api.row(third, 'approvals', id), /private/);
      await assert.rejects(api.row({ ...ctx, team: 'OTHER' }, 'approvals', id), /unavailable/);
      await assert.rejects(api.create(ctx, 'approvals', { ...data, owner: 'U1' }, 'self'), /self-approval/);
      await assert.rejects(api.transition(ctx, 'approvals', id, { status: 'approved', version: 1 }), /cannot/);
      const results = await Promise.allSettled(['approved','declined'].map(status => api.transition(other, 'approvals', id, { status, version: 1 })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await api.list(other, 'approvals', 0, undefined, 'pending')).length, 0);
      await assert.rejects(api.transition(other, 'approvals', id, { status: 'pending', version: 1 }), /changed/);
    });
    await t.test('leave coverage reveals only approved dates and proposed cover, never reasons', async () => {
      const id = await api.create(ctx, 'leaves', { ...data, start: '2026-10-16', end: '2026-10-18', cover: 'U3' }, 'leave');
      assert.equal((await api.list(ctx, 'leaves', 0, undefined, 'mine')).length, 1);
      assert.equal((await api.list(other, 'leaves', 0, undefined, 'mine')).length, 0);
      assert.equal((await api.coverage(third, '2026-10-12', '2026-10-20')).length, 0);
      await api.transition(other, 'leaves', id, { status: 'approved', version: 1, decision: 'Private decision' });
      const rows = await api.coverage(third, '2026-10-12', '2026-10-20');
      assert.deepEqual(rows, [{ user: 'U1', cover: 'U3', start: '2026-10-16', end: '2026-10-18' }]);
      await assert.rejects(api.row(third, 'leaves', id), /private/);
      await api.transition(ctx, 'leaves', id, { status: 'cancelled', version: 2 });
      assert.equal((await api.coverage(third, '2026-10-12', '2026-10-20')).length, 0);
    });
    await t.test('private one-on-one titles and notes are encrypted and excluded from admin access', async () => {
      const meeting = await api.create(other, 'meetings', { ...data, owner: 'U3', title: 'Confidential agenda' }, 'meeting');
      assert.equal((await api.list(other, 'meetings', 0, undefined, 'upcoming')).length, 1);
      assert.equal((await api.list(ctx, 'meetings', 0, undefined, 'upcoming')).length, 0);
      await assert.rejects(api.row(ctx, 'meetings', meeting), /private/); // U1 is workflow owner.
      const note = await api.create(other, 'notes', { ...data, parent: meeting, owner: 'U3', detail: 'Confidential follow-up' }, 'note');
      assert.equal((await api.list(ctx, 'meetings')).length, 0);
      await assert.rejects(api.list(ctx, 'notes', 0, meeting), /private/);
      await assert.rejects(api.row(ctx, 'notes', note), /private/);
      assert.ok(!(await store.get('meetings', meeting)).title.includes('Confidential'));
      assert.ok(!(await store.get('notes', note)).detail.includes('Confidential'));
      assert.equal((await api.row(third, 'notes', note)).detail, 'Confidential follow-up');
      await assert.rejects(api.create(other, 'notes', { ...data, parent: meeting, owner: 'U1' }, 'outside'), /two participants/);
      await assert.rejects(api.transition(other, 'meetings', meeting, { status: 'completed', version: 1 }), /Finish/);
      await api.transition(third, 'notes', note, { status: 'done', version: 1 });
      await api.transition(other, 'meetings', meeting, { status: 'completed', version: 1 });
      assert.equal((await api.list(other, 'meetings', 0, undefined, 'upcoming')).length, 0);
      await assert.rejects(api.create(other, 'notes', { ...data, parent: meeting }, 'closed'), /closed/);
    });
    await t.test('onboarding buddies track checklist completion without silently dropping open steps', async () => {
      const id = await api.create(ctx, 'onboarding', { ...data, buddy: 'U3' }, 'onboarding');
      assert.equal((await api.list(ctx, 'onboarding', 0, undefined, 'active')).length, 1);
      const step = await api.create(third, 'steps', { ...data, parent: id }, 'step');
      await assert.rejects(api.transition(ctx, 'onboarding', id, { status: 'completed', version: 1 }), /Finish/);
      await api.transition(other, 'steps', step, { status: 'done', version: 1 });
      await api.transition(third, 'onboarding', id, { status: 'completed', version: 1 });
      assert.equal((await api.list(ctx, 'onboarding', 0, undefined, 'active')).length, 0);
      await assert.rejects(api.transition(other, 'steps', step, { status: 'open', version: 2 }), /cannot/);
    });
    await t.test('handoffs require recipient acceptance before disclosure to the receiving channel', async () => {
      const id = await api.create(ctx, 'handoffs', { ...data, target: target.id }, 'handoff');
      const receiving = { ...other, config: target.id }, receivingThird = { ...third, config: target.id };
      assert.equal((await api.list(receiving, 'handoffs', 0, undefined, 'incoming')).length, 1);
      assert.equal((await api.list(ctx, 'handoffs', 0, undefined, 'incoming')).length, 0);
      assert.equal((await api.list(receivingThird, 'handoffs', 0, undefined, 'incoming')).length, 0);
      await assert.rejects(api.row(receivingThird, 'handoffs', id), /unavailable/);
      assert.equal((await api.list(receivingThird, 'handoffs')).length, 0);
      await assert.rejects(api.transition(other, 'handoffs', id, { status: 'accepted', version: 1 }), /cannot/);
      await api.transition(receiving, 'handoffs', id, { status: 'accepted', version: 1 });
      assert.equal((await api.row(receivingThird, 'handoffs', id)).status, 'accepted');
      await api.transition(receiving, 'handoffs', id, { status: 'completed', version: 2 });
      assert.equal((await api.row(ctx, 'handoffs', id)).status, 'completed');
    });
    await t.test('escalations are opt-in, admin-controlled, current-state checked and idempotent', async () => {
      const sent = [], client = { chat: { postMessage: async m => { sent.push(m); } } };
      const engine = engineModule.createEngine(store, async () => client, () => now);
      assert.equal((await api.escalation(ctx)).enabled, false);
      await assert.rejects(api.saveEscalation(other, { enabled: true, days: 2, version: 0 }), /authorized/);
      await api.saveEscalation(ctx, { enabled: true, days: 2, version: 0 });
      await collab.action(ctx, { detail: 'Old task', owner: 'U1', due: '2026-10-01' }, 'late');
      await engine.tickConfig(c); await engine.tickConfig(c);
      assert.equal((await store.list('jobs', 'config', '==', c.id)).filter(j => j.kind === 'escalation').length, 1);
      const job = { config: c.id, kind: 'escalation', since: now, expiresAt: now + 86400000, clientId: randomUUID() };
      assert.equal(await engine.deliver(job), 'sent'); assert.equal(sent.length, 1);
      assert.equal(await engine.deliver({ ...job, since: now - 23 * 3600000 }), 'skipped');
      assert.match(sent[0].text, /1 channel tasks/); assert.ok(!sent[0].text.includes('Private'));
      await api.saveEscalation(ctx, { enabled: false, days: 2, version: 1 });
      assert.equal(await engine.deliver(job), 'skipped');
      await api.saveEscalation(ctx, { enabled: true, days: 2, version: 2 });
      const a = (await store.list('actions', 'config', '==', c.id))[0]; await store.set('actions', a.id, { status: 'done' });
      assert.equal(await engine.deliver(job), 'skipped');
    });
    await t.test('all records obey retention, pagination and revoked membership', async () => {
      for (let i = 0; i < 9; i++) await api.create(ctx, 'approvals', data, `page-${i}`);
      assert.equal((await api.list(ctx, 'approvals')).length, 9); assert.equal((await api.list(ctx, 'approvals', 8)).length, 2);
      await assert.rejects(api.list(ctx, 'approvals', -1), /Reopen/);
      members.delete('U2'); await assert.rejects(api.list(other, 'approvals'), /authorized/);
      await store.shortenRetention(c.id, 7); now += 8 * 86400000; await store.cleanup(now);
      for (const kind of ['approvals', 'leaves', 'meetings', 'notes', 'onboarding', 'steps', 'handoffs', 'escalations']) assert.equal((await store.list(kind, 'team', '==', team)).length, 0);
    });
  } finally { await db.query('DELETE FROM workspaces WHERE id=$1', [team]); await pool.end(); }
});
