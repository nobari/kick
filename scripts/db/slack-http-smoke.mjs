import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { productionConnection } from './production-db.mjs';

// Uses existing app credentials in memory only. Never prints payloads or secrets.
async function main() {
  const [mode, deployment] = process.argv.slice(2);
  assert.ok(['challenge', 'pick'].includes(mode));
  assert.equal(deployment, 'kick-owl740osf-nobari.vercel.app');
  const legacy = JSON.parse(execFileSync('gcloud', ['run', 'services', 'describe', 'grun', '--region', 'asia-northeast1', '--project', 'slack-manage', '--format=json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const env = Object.fromEntries(legacy.spec.template.spec.containers[0].env.filter(e => e.value).map(e => [e.name, e.value]));
  assert.equal(env.SLACK_CLIENT_ID, '296971191191.4147683074375');
  assert.ok(env.SLACK_SIGNING_SECRET);
  const marker = `Kick migration verification ${randomUUID()}`;
  const payload = mode === 'challenge' ? { type: 'url_verification', challenge: marker } : {
    type: 'view_submission', api_app_id: 'A044BL326B1', is_enterprise_install: false,
    team: { id: 'T8QUK5M5M', domain: 'saamoj' }, user: { id: 'U044P8DUYF7', team_id: 'T8QUK5M5M' },
    view: { id: 'migration-smoke-test', type: 'modal', callback_id: 'pick_submit', private_metadata: 'C8PBFSSC9',
      state: { values: { from: { input: { type: 'multi_users_select', selected_users: ['U044P8DUYF7'] } },
        num: { input: { type: 'plain_text_input', value: '1' } },
        for: { input: { type: 'plain_text_input', value: `[TEST] ${marker}; bot-only, no action needed` } } } } },
  };
  const body = mode === 'challenge' ? JSON.stringify(payload) : new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = 'v0=' + createHmac('sha256', env.SLACK_SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex');
  const response = mode === 'pick' ? await (async () => {
    const result = await fetch('https://kick.bozmoz.com/api/slack/events', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Slack-Request-Timestamp': timestamp, 'X-Slack-Signature': signature },
      body, signal: AbortSignal.timeout(65000) });
    assert.ok(result.ok);
    return result.text();
  })() : execFileSync('vercel', ['curl', '/api/slack/events', '--deployment', deployment, '--', '--silent', '--show-error', '--fail-with-body', '--max-time', '65',
    '--request', 'POST', '--header', `Content-Type: ${mode === 'challenge' ? 'application/json' : 'application/x-www-form-urlencoded'}`,
    '--header', `X-Slack-Request-Timestamp: ${timestamp}`, '--header', `X-Slack-Signature: ${signature}`, '--data-raw', body],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 75000 });
  if (mode === 'challenge') {
    assert.ok(response.includes(marker));
    console.log('Signed deployed Slack challenge passed. No workflow data written.');
    return;
  }
  const client = new pg.Client({ connectionString: productionConnection() });
  await client.connect();
  try {
    const result = await client.query('SELECT message_ts FROM pick_events WHERE workspace_id=$1 AND channel_id=$2 AND requested_by=$3 AND purpose=$4', ['T8QUK5M5M', 'C8PBFSSC9', 'U044P8DUYF7', payload.view.state.values.for.input.value]);
    assert.equal(result.rows.length, 1);
    console.log(JSON.stringify({ deployedPick: 'passed', productionDatabaseWrite: 'verified', permalink: `https://saamoj.slack.com/archives/C8PBFSSC9/p${result.rows[0].message_ts.replace('.', '')}` }));
  } finally { await client.end(); }
}
main().catch(() => { console.error('Deployed smoke test failed. Do not automatically repeat a pick: it may already have posted.'); process.exitCode = 1; });
