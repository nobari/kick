// Explicitly authorized transport/renderer check. Posts only a labeled test thread.
// Rehearsal records are rolled back; this is NOT a human-interaction or DM test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { WebClient } from '@slack/web-api';
import { productionConnection } from './db/production-db.mjs';
import { rehearsalConnection } from './db/rehearsal-db.mjs';
import installations from '../server/db/installations.cjs';
import storage from '../server/rituals/postgres-store.js';
import engineModule from '../server/rituals/engine.js';
import domain from '../server/rituals/domain.js';

const team = 'T8QUK5M5M', channel = 'C8PBFSSC9';
let phase = 'authorization';
async function main() {
  assert.equal(process.argv[2], '--send-authorized-test-thread');
  const prod = new pg.Client({ connectionString: productionConnection() });
  let installation;
  try {
    await prod.connect();
    installation = await installations.createInstallationRepository(prod).fetchInstallation({ teamId: team, isEnterpriseInstall: false });
  } finally { await prod.end(); }
  const slack = new WebClient(installation.bot.token, { retryConfig: { retries: 0 }, timeout: 15000, rejectRateLimitedCalls: true });
  const identity = await slack.auth.test(); assert.equal(identity.team_id, team);
  const info = await slack.conversations.info({ channel });
  assert.equal(info.channel.is_private, false); assert.equal(info.channel.is_archived, false); assert.equal(info.channel.is_member, true);
  const rehearsal = parseEnv(readFileSync('.env.rehearsal.local', 'utf8'));
  const db = new pg.Client({ connectionString: rehearsalConnection(rehearsal) });
  let thread;
  try {
    await db.connect(); await db.query('BEGIN');
    const database = { query: (...args) => db.query(...args), transaction: fn => fn(db) };
    const store = storage.createStore(database);
    let now = Date.now();
    const stamp = randomUUID(); const user = identity.user_id;
    const resume = process.argv[3];
    if (resume) {
      assert.match(resume, /^\d+\.\d+$/);
      const prior = await slack.conversations.replies({ channel, ts: resume, limit: 2 });
      assert.equal(prior.messages.length, 1, 'Only an empty test thread can be resumed');
      assert.equal(prior.messages[0].user, identity.user_id);
      assert.ok(prior.messages[0].text.startsWith('[TEST] Kick release verification '));
      thread = { ts: resume };
    } else thread = await slack.chat.postMessage({ channel, text: `[TEST] Kick release verification ${stamp}. Bot-only sample data; no action needed. The following messages test rendering and Slack delivery against a rolled-back rehearsal database. Interactive controls are omitted. No team schedule or reminder is being enabled.`, unfurl_links: false, unfurl_media: false });
    console.log(JSON.stringify({ phase: 'thread-created', channel, ts: thread.ts }));
    const sent = [];
    const client = { conversations: slack.conversations, chat: { postMessage: async args => {
      assert.equal(args.channel, channel);
      const blocks = args.blocks?.filter(b => b.type !== 'actions').map(b => { const copy = { ...b }; delete copy.accessory; return copy; });
      const mentions = JSON.stringify({ ...args, blocks }).match(/<[@!][^>]+>/g) || [];
      assert.ok(mentions.every(m => m === `<@${user}>`));
      const result = await slack.chat.postMessage({ ...args, blocks, thread_ts: thread.ts, reply_broadcast: false, text: '[TEST] ' + args.text });
      sent.push(result.ts); return result;
    } } };
    const engine = engineModule.createEngine(store, async () => client, () => now, { dmEnabled: false });
    // A unique rehearsal channel-config ID avoids changing even an existing fixture.
    const c = { id: storage.key('release-check', stamp), team, channel, owner: user, enabled: true,
      zone: 'UTC', time: '00:00', digestTime: '23:59', days: [0,1,2,3,4,5,6], members: [user],
      questions: domain.TEMPLATES.standup, template: 'standup', retentionDays: 7, roundup: true, nextAt: now, updatedAt: now };
    assert.notEqual(domain.localTime(now, 'UTC').time, '23:59');
    phase = 'create-rehearsal-config';
    await store.create('configs', c.id, c);
    phase = 'create-run';
    const run = await engine.currentRun(c);
    phase = 'submit-fixture';
    await engine.submit(c, user, ['[TEST] Verified the release renderer.', '[TEST] Complete human acceptance testing.'], '[TEST] Sample access blocker', user);
    phase = 'render-and-deliver';
    for (const payload of [{ kind: 'prompt', run: run.id }, { kind: 'digest', run: run.id }])
      assert.equal(await engine.deliver({ ...payload, config: c.id, expiresAt: now + domain.DAY, clientId: randomUUID() }), 'sent');
    await store.create('recognition', storage.key(stamp, 'thanks'), { team, config: c.id, from: user, to: user, reason: '[TEST] Sample recognition, not a real reward.', at: now, expiresAt: now + domain.DAY });
    assert.equal(await engine.deliver({ kind: 'roundup', config: c.id, since: now - 1000, expiresAt: now + domain.DAY, clientId: randomUUID() }), 'sent');
    await engine.rotate(c, [], '[TEST] Bot-only sample rotation.', stamp);
    const job = (await store.list('jobs', 'config', '==', c.id))[0];
    assert.equal(await engine.deliver(job), 'sent');
    const permalink = await slack.chat.getPermalink({ channel, message_ts: thread.ts });
    console.log(JSON.stringify({ phase: 'verified', messages: sent.length, permalink: permalink.permalink, humanInteraction: 'not tested', directMessages: 'not tested', scheduler: 'not tested' }));
  } finally {
    try { await db.query('ROLLBACK'); console.log('Rehearsal fixture rolled back. Test messages remain in the authorized thread.'); }
    finally { await db.end(); }
  }
}
main().catch(error => {
  const code = String(error.data?.error || error.code || error.name).replace(/[^A-Za-z0-9_]/g, '').slice(0, 60);
  console.error(JSON.stringify({ failedPhase: phase, code }));
  console.error('Live check failed; inspect the existing test thread before resuming. Credentials withheld.'); process.exitCode = 1;
});
