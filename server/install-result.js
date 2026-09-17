const { createHmac, timingSafeEqual } = require('node:crypto')
const COOKIE = '__Host-kick-install'
const MAX_AGE = 600
const sign = (payload, secret) => createHmac('sha256', secret).update(`kick-install:${payload}`).digest('base64url')

function createReceipt(installation, secret, now = Date.now()) {
  if (!secret) throw new Error('Installation receipt signing is not configured')
  // This is only proof of a recent completed installation, never an access token.
  const payload = Buffer.from(JSON.stringify({ version: 1, expires: now + MAX_AGE * 1000,
    organization: Boolean(installation.isEnterpriseInstall) })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}
function verifyReceipt(value, secret, now = Date.now()) {
  if (!value || !secret || value.length > 1024) return null
  try {
    const [payload, signature, extra] = value.split('.')
    if (!payload || !signature || extra !== undefined) return null
    const expected = Buffer.from(sign(payload, secret)), received = Buffer.from(signature)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    const result = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (result.version !== 1 || typeof result.organization !== 'boolean' || !Number.isFinite(result.expires) || result.expires <= now || result.expires > now + MAX_AGE * 1000) return null
    return result
  } catch { return null }
}
function redirect(res, path, cookie) {
  const current = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', [...(current ? Array.isArray(current) ? current : [current] : []), cookie])
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.writeHead(303, { Location: path })
  res.end()
}
function success(installation, _options, _req, res) {
  const receipt = createReceipt(installation, process.env.SLACK_STATE_SECRET)
  redirect(res, '/installed', `${COOKIE}=${receipt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`)
}
function failure(_error, _options, _req, res) {
  redirect(res, '/install-error', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
}
module.exports = { COOKIE, createReceipt, verifyReceipt, success, failure }
