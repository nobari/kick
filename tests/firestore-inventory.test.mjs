import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory } from '../scripts/db/firestore-inventory.mjs';

const root = 'projects/test-project/databases/(default)/documents';
test('inventory traverses missing parents, paginates both APIs, and prints no field contents', async () => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, options });
    if (path === `${root}:listCollectionIds`) return options.body.pageToken
      ? { collectionIds: ['auth'] } : { collectionIds: ['sync'], nextPageToken: 'collections-page-2' };
    if (path === `${root}/sync/T1:listCollectionIds`) return { collectionIds: ['C1'] };
    if (path.endsWith(':listCollectionIds')) return {};
    if (path.startsWith(`${root}/sync?`)) return { documents: [{ name: `${root}/sync/T1` }] };
    if (path.startsWith(`${root}/sync/T1/C1?`)) return path.includes('pageToken=')
      ? { documents: [{ name: `${root}/sync/T1/C1/second`, createTime: 'now' }] }
      : { documents: [{ name: `${root}/sync/T1/C1/first`, createTime: 'now', fields: { text: { stringValue: 'PRIVATE-CONTENT' } } }], nextPageToken: 'documents-page-2' };
    if (path.startsWith(`${root}/auth?`)) return { documents: [{ name: `${root}/auth/T1`, createTime: 'now', fields: { token: { stringValue: 'SECRET-TOKEN' } } }] };
    throw new Error('Unexpected request');
  };
  const result = await inventory({ project: 'test-project', request, readTime: '2026-09-17T00:00:00.000Z' });
  assert.equal(result.totals.documents, 3);
  assert.equal(result.totals.missingParents, 1);
  assert.equal(result.groups.sync.documents, 2);
  assert.equal(result.groups.auth.documents, 1);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-CONTENT|SECRET-TOKEN|T1|C1/);
  assert.ok(calls.filter(c => c.options.method === 'GET').every(c => c.path.includes('showMissing=true') && c.path.includes('readTime=')));
  assert.ok(calls.filter(c => c.options.method === 'POST').every(c => c.options.body.readTime === result.readTime));
});

test('inventory fails instead of returning a partial success at its safety limit', async () => {
  await assert.rejects(inventory({ project: 'test-project', maxRequests: 1,
    request: async () => ({ collectionIds: ['sync'] }) }), /safety limit/);
});

test('inventory rejects invalid project IDs before issuing requests', async () => {
  await assert.rejects(inventory({ project: '../bad', request: () => assert.fail('must not request') }), /Invalid project/);
});

test('an export callback failure drains all workers before returning', async () => {
  let callbacks = 0;
  const request = async (path) => {
    if (path === `${root}:listCollectionIds`) return { collectionIds: ['auth'] };
    if (path.startsWith(`${root}/auth?`)) return { documents: Array.from({ length: 12 }, (_, id) => ({ name: `${root}/auth/${id}`, createTime: 'now' })) };
    return {};
  };
  await assert.rejects(inventory({ project: 'test-project', request, onDocument: async () => {
    callbacks++;
    throw new Error('Sink failed');
  } }), /Sink failed/);
  const atFailure = callbacks;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(callbacks, atFailure);
});

test('inventory bounds concurrent requests and escapes document IDs', async () => {
  let active = 0, peak = 0;
  const seen = [];
  const request = async (path) => {
    seen.push(path); peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    if (path === `${root}:listCollectionIds`) return { collectionIds: ['auth'] };
    if (path.startsWith(`${root}/auth?`)) return { documents: Array.from({ length: 24 }, (_, id) => ({ name: `${root}/auth/id ?#${id}`, createTime: 'now' })) };
    return {};
  };
  const result = await inventory({ project: 'test-project', request });
  assert.equal(result.totals.documents, 24);
  assert.ok(peak <= 6 && peak > 1);
  assert.ok(seen.some(path => path.includes('id%20%3F%230:listCollectionIds')));
});
