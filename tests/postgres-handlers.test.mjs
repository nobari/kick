import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';
import workflowsModule from '../server/db/workflows.cjs';

test('published handlers use Postgres for sync, kudos, coins and pick without live Slack calls', { skip: !process.env.KICK_DB_BRANCH }, async () => {
  const client = new pg.Client({ connectionString: rehearsalConnection() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const database = { query: (...args) => client.query(...args), transaction: async fn => {
      await client.query('SAVEPOINT workflow');
      try { const result = await fn(client); await client.query('RELEASE SAVEPOINT workflow'); return result; }
      catch (error) { await client.query('ROLLBACK TO SAVEPOINT workflow'); throw error; }
    } };
    const commands = new Map(), views = new Map(), routes = new Map(), errors = [];
    let receiverOptions;
    class App {
      command(name, fn) { commands.set(String(name), fn); }
      view(name, fn) { views.set(name, fn); }
      action() {} message() {} error() {} event() {} use() {}
    }
    class ExpressReceiver {
      constructor(options) { receiverOptions = options; this.app = {}; this.router = { get: (path, fn) => routes.set(path, fn) }; }
    }
    const realRequire = createRequire(new URL('../server/slack.js', import.meta.url));
    const sandbox = { module: { exports: {} }, process: { env: {
      KICK_STORAGE_BACKEND: 'postgres', DATABASE_URL: 'configured-by-test', KICK_DATA_KEY: 'configured-by-test',
      SLACK_CLIENT_ID: 'fixture', SLACK_CLIENT_SECRET: 'fixture', SLACK_SIGNING_SECRET: 'fixture', SLACK_STATE_SECRET: 'fixture',
    } }, console: { log() {}, warn() {}, error: (...args) => errors.push(args) }, setTimeout, clearTimeout,
    require: name => {
      if (name === '@slack/bolt') return { App, ExpressReceiver };
      if (name === './db/connection.cjs') return { getDatabase: () => database };
      return realRequire(name);
    } };
    vm.runInNewContext(readFileSync(new URL('../server/slack.js', import.meta.url), 'utf8'), sandbox, { filename: 'slack.js' });
    assert.equal(sandbox.module.exports.isConfigured, true);
    assert.equal(receiverOptions.scopes.includes('im:write'), false);
    const suffix = randomUUID(), team = `T-${suffix}`, channel = `C-${suffix}`, user = `U-${suffix}`, recipient = `R-${suffix}`;
    const repository = workflowsModule.createWorkflowRepository(database);
    let messages = 0, acks = 0;
    const slack = { chat: { postMessage: async () => ({ ts: `1800000000.${String(++messages).padStart(6, '0')}` }),
      getPermalink: async () => ({ permalink: 'https://example.test/message' }) }, views: { update: async () => ({ ok: true }) } };
    const body = { team: { id: team }, user: { id: user } };
    const values = { m: { input: { selected_option: { value: ':smiley:' } } }, l: { input: { value: 'Yesterday' } }, t: { input: { value: 'Today' } }, k: { input: { selected_users: [recipient] } }, kr: { input: { value: 'Thanks' } } };
    const call = (name, metadata, state) => views.get(name)({ body, ack: async () => { acks++; }, client: slack, view: { id: 'fixture-view', private_metadata: metadata, state: { values: state } } });
    await call('sync_submit', channel, values);
    assert.equal((await repository.getStandups(team, channel, 0)).length, 1);
    assert.equal((await repository.getDailyState(team, channel)).u[user], '1800000000.000002');
    await assert.rejects(repository.saveStandup({ team, channel, user, ts: '1800000000.999999', cts: '1800000000.000001', AT: Date.now(), values: { t: 'Must roll back', k: [''] } }), /identifier/);
    assert.equal((await repository.getStandups(team, channel, 0)).length, 1, 'Recognition failure must roll back its standup');
    await call('kudos_submit', `K//:tada://${channel}`, values);
    await call('kudos_submit', `C//:coin://${channel}`, values);
    const recognition = await repository.getRecognition(team, 0);
    assert.equal(recognition.length, 3);
    assert.equal(recognition.filter(row => row.type === 'coin').length, 1);
    await call('pick_submit', channel, { from: { input: { selected_users: [user, recipient] } }, num: { input: { value: '1' } } });
    assert.equal((await client.query('SELECT count(*)::int AS n FROM pick_events WHERE workspace_id=$1', [team])).rows[0].n, 1);
    assert.equal((await client.query('SELECT count(*)::int AS n FROM pick_participants WHERE workspace_id=$1', [team])).rows[0].n, 2);
    assert.equal(acks, 4);
    assert.equal(errors.length, 0, 'Handlers must not silently swallow database errors');
    assert.equal((await repository.getStandups(`other-${suffix}`, channel, 0)).length, 0);
    // Natural message identity makes database retries idempotent.
    await repository.saveRecognition({ team, channel, from: user, recipients: [recipient], ts: recognition[1].ts, AT: recognition[1].AT, kind: recognition[1].type });
    assert.equal((await repository.getRecognition(team, 0)).length, 3);
    await repository.setSettings(team, 'coins', user, ['emoji', ':coin:'], Date.now());
    assert.equal((await repository.getSettings(team)).coins.v.emoji, ':coin:');
    await repository.saveMembership(team, channel, { [user]: true }, { [recipient]: true }, Date.now());
    assert.equal((await repository.getMembership(team, channel)).bots[recipient], true);
    await repository.saveMembership(team, channel, { [user]: true }, {}, Date.now());
    assert.equal(Object.keys((await repository.getMembership(team, channel)).bots).length, 0);
    const reports = [];
    slack.users = { info: async () => ({ user: { is_admin: true } }) };
    const reportArgs = { command: { command: '/sync', text: '-r 7' }, body: { team_id: team, channel_id: channel, user_id: user, trigger_id: 'fixture' },
      ack: async () => {}, respond: async () => {}, say: async report => { reports.push(report); return { ts: 'fixture-report-ts' }; }, client: slack };
    await commands.get('/sync')(reportArgs);
    await commands.get([...commands.keys()].find(name => name.includes('kudos')))({ ...reportArgs, command: { command: '/kudos', text: '-r 7' } });
    assert.equal(reports.length, 3);
    assert.ok(reports.slice(0, 2).every(report => Array.isArray(report.blocks)), 'Report summaries should render Slack blocks');
    assert.equal(reports[2].thread_ts, 'fixture-report-ts');
    assert.equal(errors.length, 0);
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
