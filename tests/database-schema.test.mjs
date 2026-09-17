import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';

test('rehearsal guard refuses absent, production, pooled and insecure URLs', () => {
  for (const env of [{}, { KICK_DB_BRANCH: 'main' }, {
    KICK_DB_BRANCH: 'br-old-voice-aw1siabw',
    DATABASE_URL_UNPOOLED: 'postgresql://user:secret@ep-jolly-snow-aw8g6rfs-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=verify-full',
  }, {
    KICK_DB_BRANCH: 'br-old-voice-aw1siabw',
    DATABASE_URL_UNPOOLED: 'postgresql://user:secret@ep-jolly-snow-aw8g6rfs.c-12.us-east-1.aws.neon.tech/neondb?sslmode=disable',
  }]) assert.throws(() => rehearsalConnection(env));
});

test('normalized schema enforces tenant boundaries, uniqueness and valid quantities', {
  skip: process.env.KICK_DB_BRANCH !== 'br-old-voice-aw1siabw',
}, async () => {
  const client = new pg.Client({ connectionString: rehearsalConnection(), connectionTimeoutMillis: 15000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    const a = `test-${randomUUID()}`, b = `test-${randomUUID()}`;
    await client.query('INSERT INTO workspaces(id) VALUES ($1), ($2)', [a, b]);
    await client.query("INSERT INTO members(workspace_id,user_id) VALUES ($1,'U1'), ($2,'U2')", [a, b]);
    await client.query("INSERT INTO channels(workspace_id,channel_id) VALUES ($1,'C1'), ($2,'C2')", [a, b]);
    async function rejected(sql, params, expected) {
      await client.query('SAVEPOINT constraint_check');
      let code;
      try { await client.query(sql, params); } catch (error) { code = error.code; }
      await client.query('ROLLBACK TO SAVEPOINT constraint_check');
      assert.equal(code, expected);
    }
    await rejected("INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES ($1,'C1','U2')", [a], '23503');
    await rejected("INSERT INTO pick_events(workspace_id,channel_id,requested_by,requested_count,occurred_at) VALUES ($1,'C1','U1',0,now())", [a], '23514');
    const install = 'INSERT INTO slack_installations(workspace_id,credentials_ciphertext) VALUES ($1,$2)';
    await client.query(install, [a, 'synthetic-encrypted-fixture']);
    await rejected(install, [a, 'synthetic-encrypted-fixture'], '23505');
    await client.query('UPDATE slack_installations SET revoked_at=now() WHERE workspace_id=$1', [a]);
    await client.query(install, [a, 'synthetic-encrypted-fixture']);
    const { rows: [thread] } = await client.query("INSERT INTO standup_threads(workspace_id,channel_id,message_ts,started_at) VALUES ($1,'C2','123.000001',now()) RETURNING id", [b]);
    await rejected("INSERT INTO standup_updates(workspace_id,channel_id,user_id,thread_id,message_ts,submitted_at) VALUES ($1,'C1','U1',$2,'123.000002',now())", [a, thread.id], '23503');
    const request = "INSERT INTO processed_requests(workspace_id,request_key,expires_at) VALUES ($1,'retry',now()+interval '1 day')";
    await client.query(request, [a]);
    await rejected(request, [a], '23505');
    await client.query(request, [b]);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
