import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { snapshotWriter, verifySnapshot, parseKey } from '../scripts/db/encrypted-snapshot.mjs';

const document = { name: 'projects/test-project/databases/(default)/documents/auth/PRIVATE-ID', createTime: '2026-09-17T00:00:00Z', fields: {
  token: { stringValue: 'PRIVATE-TOKEN' }, large: { integerValue: '9223372036854775807' },
  timestamp: { timestampValue: '2026-09-17T01:02:03.123456789Z' }, nil: { nullValue: null },
} };
function fixture() {
  const key = randomBytes(32), lines = [], writer = snapshotWriter(key, line => lines.push(line));
  writer.document(document); writer.document({ ...document, name: `${document.name}-2` });
  writer.finish({ complete: true, totals: { documents: 2 } });
  return { key, lines, writer };
}
test('encrypted snapshot roundtrip verifies and contains no plaintext identity/token', async () => {
  const { key, lines } = fixture();
  assert.doesNotMatch(lines.join('\n'), /PRIVATE-ID|PRIVATE-TOKEN|9223372036854775807/);
  assert.equal((await verifySnapshot(key, lines)).documents, 2);
});
test('truncation, wrong key, record reorder, mutation and append are rejected', async () => {
  const { key, lines } = fixture();
  await assert.rejects(verifySnapshot(key, lines.slice(0, -1)), /Incomplete/);
  await assert.rejects(verifySnapshot(randomBytes(32), lines), /authentication/);
  await assert.rejects(verifySnapshot(key, [lines[0], lines[2], lines[1], lines[3]]), /authentication/);
  const corrupted = [...lines], record = JSON.parse(corrupted[1]);
  record.data = Buffer.from('corrupt').toString('base64'); corrupted[1] = JSON.stringify(record);
  await assert.rejects(verifySnapshot(key, corrupted), /authentication/);
  await assert.rejects(verifySnapshot(key, [...lines, lines[1]]), /after snapshot footer/);
});
test('writer rejects count mismatch and further writes after finalization', () => {
  const { writer } = fixture();
  assert.throws(() => writer.document(document), /finalized/);
  const other = snapshotWriter(randomBytes(32), () => {});
  assert.throws(() => other.finish({ complete: true, totals: { documents: 1 } }), /Incomplete/);
});
test('backup keys must be full-length base64 encoded random keys', () => {
  assert.throws(() => parseKey('short'), /32 bytes/);
  const key = randomBytes(32);
  assert.deepEqual(parseKey(key.toString('base64')), key);
});
test('collected records are returned only after footer verification and within memory limit', async () => {
  const { key, lines } = fixture();
  assert.equal((await verifySnapshot(key, lines, { collect: true })).records.length, 2);
  await assert.rejects(verifySnapshot(key, lines.slice(0, -1), { collect: true }), /Incomplete/);
  await assert.rejects(verifySnapshot(key, lines, { collect: true, maxBytes: 1 }), /size limit/);
});
