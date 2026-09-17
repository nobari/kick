const test = require('node:test')
const assert = require('node:assert/strict')
const { createCronHandler } = require('./cron')
const secret = 'test-only-secret-'.repeat(3)
async function invoke(env, req = {}, tick = async () => ({ configurations: 0, sent: 0, failed: 0 })) {
  let calls = 0
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(n) { this.code = n; return this }, json(body) { this.body = body; return this } }
  await createCronHandler({ isConfigured: true, rituals: { tick: async () => { calls++; return tick() } } }, env)({ method: 'GET', headers: {authorization: `Bearer ${secret}`}, ...req }, response)
  return { ...response, calls }
}
test('cron rejects absent, short and wrong secrets without running jobs', async () => {
  for (const env of [{}, {CRON_SECRET: 'short'}, {CRON_SECRET: 'wrong'.repeat(10)}]) {
    const r = await invoke(env); assert.equal(r.code, 401); assert.equal(r.calls, 0)
  }
})
test('cron rejects non-GET and array authorization headers', async () => {
  const r = await invoke({CRON_SECRET: secret}, {method: 'POST'})
  assert.equal(r.code, 405); assert.equal(r.headers.Allow, 'GET'); assert.equal(r.calls, 0)
  assert.equal((await invoke({CRON_SECRET: secret}, {headers: {authorization: ['bad']}})).code, 401)
})
test('cron fails closed until explicitly activated', async () => {
  const r = await invoke({CRON_SECRET: secret}); assert.equal(r.code, 503); assert.equal(r.calls, 0)
})
test('authorized active cron returns aggregate results without caching', async () => {
  const r = await invoke({CRON_SECRET: secret, KICK_SCHEDULER_ENABLED: 'true'})
  assert.equal(r.code, 200); assert.equal(r.calls, 1); assert.equal(r.headers['Cache-Control'], 'no-store')
})
test('cron never exposes raw Slack or database errors', async () => {
  const r = await invoke({CRON_SECRET: secret, KICK_SCHEDULER_ENABLED: 'true'}, {}, async () => { throw new Error('sensitive token') })
  assert.equal(r.code, 500); assert.ok(!JSON.stringify(r.body).includes('sensitive'))
})
