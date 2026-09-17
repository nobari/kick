import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decodeValue, stableId } from '../scripts/db/legacy-values.mjs';
import { normalizedPlan } from '../scripts/db/normalized-plan.mjs';
import encryption from '../server/db/encryption.cjs';

test('legacy values preserve large integers and timestamp precision', () => {
  assert.equal(decodeValue({ integerValue: '9223372036854775807' }), 9223372036854775807n);
  assert.equal(decodeValue({ timestampValue: '2026-09-17T00:00:00.123456789Z' }), '2026-09-17T00:00:00.123456789Z');
  assert.throws(() => decodeValue({ referenceValue: 'unsupported' }));
  assert.equal(stableId('a', 'b'), stableId('a', 'b'));
  assert.notEqual(stableId('a', 'b'), stableId('b', 'a'));
});
test('credential encryption binds ciphertext to installation and key', () => {
  const key = randomBytes(32).toString('base64');
  const value = { bot: { token: 'fixture-token' } };
  const ciphertext = encryption.seal(value, 'installation:1', key);
  assert.doesNotMatch(ciphertext, /fixture-token/);
  assert.deepEqual(encryption.unseal(ciphertext, 'installation:1', key), value);
  assert.throws(() => encryption.unseal(ciphertext, 'installation:2', key));
  assert.throws(() => encryption.unseal(ciphertext, 'installation:1', randomBytes(32).toString('base64')));
});
const encode = value => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { integerValue: String(value) };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
};
function snapshot(entries) {
  return { verified: true, documents: entries.length, report: { project: 'test-project', database: '(default)' }, records: entries.map(([path, data]) => ({
    name: `projects/test-project/databases/(default)/documents/${path}`, createTime: '2026-09-17T00:00:00Z', updateTime: '2026-09-17T00:00:00Z', fields: encode(data).mapValue.fields,
  })) };
}
test('normalization groups recognition recipients and preserves exact message timestamps', () => {
  const event = { team: 'T1', ch: 'C1', f: 'U1', ts: '1758067200.000001', AT: 1758067200000, type: 'kudos' };
  const plan = normalizedPlan(snapshot([
    ['kudos/grant1', { ...event, k: 'U2' }], ['kudos/grant2', { ...event, k: 'U3' }],
    ['pick/pick1', { team: 'T1', c: 'C1', by: 'U1', ps: ['U2', 'U3'], n: 2, ts: '1758067200.000002' }],
  ]));
  assert.equal(plan.ready, true);
  assert.equal(plan.tables.recognition_events.size, 1);
  assert.equal(plan.tables.recognition_recipients.size, 2);
  assert.equal(plan.tables.pick_participants.size, 2);
  assert.equal([...plan.tables.recognition_events.values()][0].message_ts, event.ts);
  assert.equal(plan.audit.length, 3);
});
test('unknown collections and invalid references block the entire import', () => {
  const plan = normalizedPlan(snapshot([['unknown/1', {}], ['sync/T1/C1/123.000001', { values: {} }]]));
  assert.equal(plan.ready, false);
  assert.equal(Object.values(plan.failures).reduce((a, b) => a+b, 0), 2);
});
test('installation migration separates production/test tokens and encrypts each envelope', () => {
  const key = randomBytes(32).toString('base64');
  const plan = normalizedPlan(snapshot([['auth/T1', { team: { id: 'T1' }, bot: { token: 'prod', TESTtoken: 'test', scopes: ['commands'] } }]]), key);
  assert.equal(plan.ready, true);
  const rows = [...plan.tables.slack_installations.values()];
  assert.equal(rows.length, 2);
  for (const row of rows) {
    const value = encryption.unseal(row.credentials_ciphertext, `installation:${row.id}`, key);
    assert.equal(value.bot.token, row.environment === 'test' ? 'test' : 'prod');
    assert.equal(value.bot.TESTtoken, undefined);
  }
});
