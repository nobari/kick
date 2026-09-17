// Explicitly authorized, bot-only live Slack smoke test. Never runs in production DB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import pg from 'pg';
import { rehearsalConnection } from './rehearsal-db.mjs';
import installations from '../../server/db/installations.cjs';
import workflows from '../../server/db/workflows.cjs';

const team = 'T8QUK5M5M', channel = 'C8PBFSSC9';
const sent = [];
// Recheck rolled-back DB assertions using recorded successful Slack responses;
// this mode never posts again and does not claim a fresh live end-to-end run.
const replay = process.argv[2] === '--verify-recorded-responses';
const recorded = replay ? (process.argv[3] || '').split(',') : [];
let root, permalink, client;
try {
  assert.ok(replay || process.argv[2] === '--post-authorized-test-thread');
  if (replay) { assert.equal(recorded.length, 6); assert.ok(recorded.every(ts => /^\d+\.\d+$/.test(ts))); }
  const release = '/tmp/kick-postgres-release-Y7h3p8/server/slack.js';
  const require = createRequire(release);
  client = new pg.Client({ connectionString: rehearsalConnection(), connectionTimeoutMillis: 15000 });
  await client.connect();
  await client.query('BEGIN');
  const database = { query: (...args) => client.query(...args), transaction: async fn => {
    await client.query('SAVEPOINT smoke');
    try { const result = await fn(client); await client.query('RELEASE SAVEPOINT smoke'); return result; }
    catch (error) { await client.query('ROLLBACK TO SAVEPOINT smoke'); throw error; }
  } };
  const installation = await installations.createInstallationRepository(database).fetchInstallation({ teamId: team, isEnterpriseInstall: false });
  const { WebClient } = createRequire(require.resolve('@slack/bolt'))('@slack/web-api');
  const api = new WebClient(installation.bot.token, { retryConfig: { retries: 0 }, timeout: 15000, rejectRateLimitedCalls: true });
  const identity = await api.auth.test();
  assert.equal(identity.team_id, team);
  assert.equal(new URL(identity.url).hostname, 'saamoj.slack.com');
  const info = await api.conversations.info({ channel });
  assert.equal(info.channel.is_member, true);
  assert.equal(info.channel.is_archived, false);
  const user = identity.user_id;
  assert.equal(user, 'U044P8DUYF7');
  const views = new Map();
  let errors = 0, acks = 0;
  class App { command() {} view(name, fn) { views.set(name, fn); } action() {} message() {} error() {} }
  class ExpressReceiver { constructor() { this.app = {}; this.router = { get() {} }; } }
  const sandbox = { module: { exports: {} }, process: { env: {
    KICK_STORAGE_BACKEND: 'postgres', DATABASE_URL: 'injected-rehearsal', KICK_DATA_KEY: 'injected-rehearsal',
    SLACK_CLIENT_ID: 'test', SLACK_CLIENT_SECRET: 'test', SLACK_SIGNING_SECRET: 'test', SLACK_STATE_SECRET: 'test',
  } }, console: { log() {}, warn() {}, error() { errors++; } }, setTimeout, clearTimeout,
  require: name => {
    if (name === '@slack/bolt') return { App, ExpressReceiver };
    if (name === '@google-cloud/firestore') return { Firestore: class { constructor() { throw new Error('Firestore prohibited'); } } };
    if (name === './db/connection.cjs') return { getDatabase: () => database };
    return require(name);
  } };
  vm.runInNewContext(readFileSync(release, 'utf8'), sandbox, { filename: release });
  assert.equal(sandbox.module.exports.isConfigured, true);
  const label = 'Kick migration smoke test — bot-only, no action needed';
  root = replay ? { ts: recorded[0] } : await api.chat.postMessage({ channel, text: `${label}. Testing standup, kudos, coins and pick against an isolated Postgres rehearsal. Production remains on Firestore; test database changes will be rolled back.`, unfurl_links: false, unfurl_media: false });
  assert.ok(root.ts);
  sent.push(root.ts);
  console.log(JSON.stringify({ phase: replay ? 'recorded-thread' : 'thread-created', channel, ts: root.ts }));
  permalink = (await api.chat.getPermalink({ channel, message_ts: root.ts })).permalink;
  const repository = workflows.createWorkflowRepository(database);
  await repository.saveThread(team, channel, root.ts, Date.now());
  const slack = { chat: {
    postMessage: async args => {
      assert.equal(args.channel, channel);
      // Restrict any generated mentions to the bot, including rich-block text.
      const mentions = JSON.stringify(args).match(/<[@!][^>]+>/g) || [];
      assert.ok(mentions.every(mention => mention === `<@${user}>`));
      const result = replay ? { ts: recorded[sent.length] } : await api.chat.postMessage({ ...args, channel, thread_ts: root.ts, reply_broadcast: false,
        text: `[TEST] ${args.text || label}`, unfurl_links: false, unfurl_media: false,
        blocks: args.blocks ? [{ type: 'context', elements: [{ type: 'plain_text', text: label }] }, ...args.blocks] : undefined });
      assert.ok(result.ts);
      sent.push(result.ts);
      console.log(JSON.stringify({ phase: replay ? 'recorded-response' : 'message-sent', channel, ts: result.ts }));
      return result;
    },
    getPermalink: args => { assert.equal(args.channel, channel); return api.chat.getPermalink(args); },
  } };
  const body = { team: { id: team }, user: { id: user } };
  const values = { m: { input: { selected_option: { value: ':smiley:' } } },
    l: { input: { value: '[TEST] Rehearsed normalized Postgres import.' } },
    t: { input: { value: '[TEST] Verify live Slack messages; production unchanged.' } },
    k: { input: { selected_users: [user] } }, kr: { input: { value: '[TEST] Bot-only migration check, not a real reward.' } } };
  const call = (name, metadata, state) => views.get(name)({ body, ack: async () => { acks++; }, client: slack,
    view: { id: 'smoke-test', private_metadata: metadata, state: { values: state } } });
  await call('sync_submit', channel, values);
  await call('kudos_submit', `K//:tada://${channel}`, values);
  await call('kudos_submit', `C//:coin://${channel}`, values);
  await call('pick_submit', channel, { from: { input: { selected_users: [user] } }, num: { input: { value: '1' } } });
  assert.equal(acks, 4);
  assert.equal(errors, 0);
  assert.equal(sent.length, 6);
  assert.equal((await repository.getStandups(team, channel, 0)).filter(row => row.cts === root.ts).length, 1);
  const recognition = (await repository.getRecognition(team, 0)).filter(row => sent.includes(row.ts));
  assert.equal(recognition.length, 3);
  assert.equal(recognition.filter(row => row.type === 'coin').length, 1);
  assert.equal((await client.query('SELECT count(*)::int n FROM pick_events WHERE workspace_id=$1 AND message_ts=ANY($2::text[])', [team, sent])).rows[0].n, 1);
  await client.query('ROLLBACK');
  console.log(JSON.stringify({ result: 'passed', mode: replay ? 'database verification with recorded Slack responses' : 'live Slack API', permalink, messages: sent.length, databaseChanges: 'rolled back', production: 'unchanged', limitation: 'Direct modal callbacks; not inbound HTTP, OAuth or modal UI testing.' }));
} catch (error) {
  console.error(JSON.stringify({ result: 'failed', code: typeof error.code === 'string' ? error.code : 'check-failed', missingModule: error.code === 'MODULE_NOT_FOUND' ? error.message.match(/Cannot find module '([^']+)'/)?.[1] : undefined, permalink, sent, warning: 'Do not blindly rerun: Slack messages may already exist.' }));
  process.exitCode = 1;
} finally {
  if (client) { try { await client.query('ROLLBACK'); } finally { await client.end(); } }
}
