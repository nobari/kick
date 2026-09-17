import test from 'node:test';
import assert from 'node:assert/strict';
import connection from '../server/db/connection.cjs';

test('transactions commit on success and always release pooled clients', async () => {
  const calls = [];
  const client = { query: async sql => calls.push(sql), release: discard => calls.push(['release', discard]) };
  const database = connection.databaseForPool({ connect: async () => client });
  assert.equal(await database.transaction(async () => 42), 42);
  assert.deepEqual(calls, ['BEGIN', "SET LOCAL statement_timeout='15s'", 'COMMIT', ['release', false]]);
});
test('transactions preserve the original failure and discard a connection when rollback fails', async () => {
  const failure = new Error('fixture failure'), calls = [];
  const client = { query: async sql => { calls.push(sql); if (sql === 'ROLLBACK') throw new Error('connection lost'); }, release: discard => calls.push(['release', discard]) };
  const database = connection.databaseForPool({ connect: async () => client });
  await assert.rejects(database.transaction(async () => { throw failure; }), error => error === failure);
  assert.deepEqual(calls.at(-1), ['release', true]);
  assert.equal(calls.includes('COMMIT'), false);
});
