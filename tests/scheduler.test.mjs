import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { tick } from '../scheduler/worker.mjs';
test('scheduler authenticates only to the canonical endpoint and refuses redirects', async () => {
  const secret = 'x'.repeat(40);
  assert.deepEqual(await tick({ CRON_SECRET: secret }, async (url, options) => {
    assert.equal(url, 'https://kick.bozmoz.com/api/cron/rituals');
    assert.equal(options.headers.Authorization, `Bearer ${secret}`);
    assert.equal(options.redirect, 'error');
    return Response.json({ configurations: 0, sent: 0, failed: 0 });
  }), { configurations: 0, sent: 0 });
});
test('scheduler errors are sanitized and external HTTP access is disabled', async () => {
  await assert.rejects(tick({}), /secret missing/);
  await assert.rejects(tick({CRON_SECRET: 'x'.repeat(40)}, async () => new Response('sensitive', {status: 503})), /^Error: Kick scheduler HTTP 503$/);
  await assert.rejects(tick({CRON_SECRET: 'x'.repeat(40)}, async () => Response.json({ failed: 1 })), /failed operations/);
  assert.equal(worker.fetch().status, 404);
});
