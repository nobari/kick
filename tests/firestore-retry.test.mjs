import test from 'node:test';
import assert from 'node:assert/strict';
import { retryingFirestoreRequest } from '../scripts/db/firestore-inventory.mjs';

test('transient failures retry the same read without leaking upstream bodies', async () => {
  let calls = 0;
  const request = retryingFirestoreRequest({ getToken: () => 'fixture', sleep: async () => {}, fetcher: async () => {
    calls++;
    if (calls === 1) throw new DOMException('private transport detail', 'TimeoutError');
    if (calls === 2) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ documents: [] }) };
  } });
  assert.deepEqual(await request('fixture', { method: 'GET' }), { documents: [] });
  assert.equal(calls, 3);
});
test('authorization fails immediately and persistent network failures are bounded', async () => {
  for (const status of [401, 403, 400, 503]) {
    let calls = 0;
    const request = retryingFirestoreRequest({ getToken: () => 'fixture', sleep: async () => {}, fetcher: async () => {
      calls++; return { ok: false, status };
    } });
    await assert.rejects(request('fixture', { method: 'GET' }), { code: `HTTP_${status}` });
    assert.equal(calls, status === 503 ? 5 : 1);
  }
});
