// Read-only by default. The explicit optional flag refreshes only the installer's
// App Home; it never sends channel messages, DMs, or changes workflow settings.
import assert from 'node:assert/strict';
import pg from 'pg';
import { WebClient } from '@slack/web-api';
import { productionConnection } from './db/production-db.mjs';
import installations from '../server/db/installations.cjs';
import connection from '../server/db/connection.cjs';
import storage from '../server/rituals/postgres-store.js';
import engineModule from '../server/rituals/engine.js';
import slackUI from '../server/rituals/slack.js';
import capabilities from '../server/rituals/capabilities.js';

const team = 'T8QUK5M5M';
const pool = new pg.Pool({ connectionString: productionConnection(), max: 2 });
try {
  const db = connection.databaseForPool(pool);
  const installation = await installations.createInstallationRepository(db).fetchInstallation({ teamId: team, isEnterpriseInstall: false });
  assert.equal(installation.appId, 'A044BL326B1');
  const client = new WebClient(installation.bot.token, { retryConfig: { retries: 0 }, timeout: 15000, rejectRateLimitedCalls: true });
  const auth = await client.auth.test(); assert.equal(auth.team_id, team);
  const granted = auth.response_metadata?.scopes || [];
  const missing = capabilities.oauthScopes({ KICK_OAUTH_DM_SCOPE_ENABLED: 'true' }).filter(s => !granted.includes(s));
  const store = storage.createStore(db), configs = await store.list('configs', 'team', '==', team);
  console.log(JSON.stringify({ auth: auth.ok, scopeMetadataAvailable: granted.length > 0, missingScopes: missing, workflows: configs.length, enabled: configs.filter(c => c.enabled).length }));
  if (process.argv.includes('--publish-installer-home')) {
    assert.ok(installation.user?.id);
    const engine = engineModule.createEngine(store, async target => { assert.equal(target, team); return client; });
    const ui = slackUI.registerRituals({ action() {}, view() {}, event() {}, use() {}, shortcut() {} }, store, engine, { schedulerEnabled: true, dmEnabled: false });
    await ui.home(client, team, installation.user.id);
    console.log('Slack accepted the new App Home for the installer. No schedule changed and no channel message or DM was sent.');
  }
} catch (error) {
  console.error(JSON.stringify({ check: 'failed', code: String(error.data?.error || error.code || error.name).replace(/[^A-Za-z0-9_]/g, '').slice(0, 60) }));
  process.exitCode = 1;
} finally { await pool.end(); }
