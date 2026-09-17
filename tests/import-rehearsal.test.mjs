import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { insertRows } from '../scripts/db/import-rehearsal.mjs';
import { rehearsalConnection } from '../scripts/db/rehearsal-db.mjs';

test('bulk importer rejects unsafe SQL identifiers', async () => {
  const client = { query: () => { throw new Error('Should not execute'); } };
  await assert.rejects(insertRows(client, 'workspaces;delete', []), /Invalid table/);
  await assert.rejects(insertRows(client, 'workspaces', [{ 'id;delete': 'bad' }]), /Invalid column/);
});
test('bulk importer preserves defaults, parameterizes values and crosses batch boundaries', { skip: !process.env.KICK_DB_BRANCH }, async () => {
  const client = new pg.Client({ connectionString: rehearsalConnection() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const prefix = `fixture-${randomUUID()}`;
    const rows = Array.from({ length: 251 }, (_, index) => ({ id: `${prefix}-${index}` }));
    rows.push({ id: `${prefix}-named`, name: "quoted ' value; no SQL" });
    await insertRows(client, 'workspaces', rows);
    const result = await client.query('SELECT count(*)::int AS count FROM workspaces WHERE id LIKE $1 AND timezone=$2', [`${prefix}%`, 'UTC']);
    assert.equal(result.rows[0].count, 252);
    assert.equal((await client.query('SELECT name FROM workspaces WHERE id=$1', [`${prefix}-named`])).rows[0].name, "quoted ' value; no SQL");
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT count(*)::int AS count FROM workspaces WHERE id LIKE $1', [`${prefix}%`])).rows[0].count, 0);
  } finally { await client.query('ROLLBACK'); await client.end(); }
});
