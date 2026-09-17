const test = require('node:test')
const assert = require('node:assert/strict')
const { COOKIE, createReceipt, verifyReceipt, success, failure } = require('./install-result')
const secret = 'test-only-signing-secret'
const now = 1000000
function response() {
  return { headers: {}, getHeader(k) { return this.headers[k] }, setHeader(k, v) { this.headers[k] = v },
    writeHead(code, headers) { this.status = code; Object.assign(this.headers, headers) }, end() { this.ended = true } }
}
test('receipt verifies and contains no installation credentials or identity', () => {
  const value = createReceipt({ bot: { token: 'must-not-leak' }, team: { id: 'T1', name: 'Private workspace' } }, secret, now)
  assert.equal(verifyReceipt(value, secret, now).organization, false)
  const payload = Buffer.from(value.split('.')[0], 'base64url').toString()
  assert.ok(!payload.includes('must-not-leak')); assert.ok(!payload.includes('Private workspace')); assert.ok(!payload.includes('T1'))
})
test('expired, malformed, forged, and wrong-secret receipts fail closed', () => {
  const value = createReceipt({}, secret, now)
  assert.equal(verifyReceipt(value, secret, now + 600000), null)
  for (const v of [undefined, '', 'garbage', value + '.extra', 'A' + value]) assert.equal(verifyReceipt(v, secret, now), null)
  assert.equal(verifyReceipt(value, 'wrong', now), null)
  assert.equal(verifyReceipt(value, undefined, now), null)
  assert.throws(() => createReceipt({}, undefined, now))
})
test('organization-wide receipts preserve only the installation type', () => {
  assert.equal(verifyReceipt(createReceipt({ isEnterpriseInstall: true }, secret, now), secret, now).organization, true)
})
test('success sends secure cookie and same-origin redirect without dropping OAuth cookies', () => {
  const previous = process.env.SLACK_STATE_SECRET; process.env.SLACK_STATE_SECRET = secret
  try {
    const res = response(); res.setHeader('Set-Cookie', ['oauth-state=; Max-Age=0'])
    success({}, {}, {}, res)
    assert.equal(res.status, 303); assert.equal(res.headers.Location, '/installed')
    assert.equal(res.headers['Cache-Control'], 'no-store')
    assert.equal(res.headers['Set-Cookie'].length, 2)
    const cookie = res.headers['Set-Cookie'][1]
    for (const part of [COOKIE, 'Secure', 'HttpOnly', 'SameSite=Lax', 'Max-Age=600', 'Path=/']) assert.ok(cookie.includes(part))
    assert.ok(verifyReceipt(cookie.split(';')[0].slice(COOKIE.length + 1), secret))
  } finally { if (previous === undefined) delete process.env.SLACK_STATE_SECRET; else process.env.SLACK_STATE_SECRET = previous }
})
test('failure clears any stale success receipt without disclosing the error', () => {
  const res = response(); failure(new Error('secret-code'), {}, {}, res)
  assert.equal(res.status, 303); assert.equal(res.headers.Location, '/install-error')
  assert.ok(res.headers['Set-Cookie'][0].includes('Max-Age=0'))
  assert.ok(!JSON.stringify(res).includes('secret-code'))
})
