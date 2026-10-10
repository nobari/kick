const { randomBytes, randomUUID } = require('node:crypto')
const { key } = require('../rituals/store')
const { seal, unseal } = require('../db/encryption.cjs')
const { ORIGIN, settings, authorization } = require('./providers')
const random = () => randomBytes(32).toString('base64url')
const valid = v => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v)
function createOAuth(store, { admin, providerApi, clock = Date.now, env = process.env }) {
  async function ticket(ctx, provider) {
    settings(provider, env)
    await admin(ctx)
    const token = random(), id = key(token)
    await store.create('oauth', id, { team: ctx.team, config: ctx.config, user: ctx.user, provider, phase: 'ticket', used: false, at: clock(), expiresAt: clock() + 10 * 60000 })
    return `${ORIGIN}/api/integrations/${provider}/start?ticket=${token}`
  }
  async function take(token, provider, phase, browser) {
    if (!valid(token)) throw new Error('Invalid authorization link.')
    const id = key(token)
    return store.locked(`oauth:${id}`, async tx => {
      const r = await tx.get('oauth', id)
      if (!r || r.used || r.expiresAt <= clock() || r.provider !== provider || r.phase !== phase || (phase === 'state' && (!valid(browser) || r.browser !== key(browser)))) throw new Error('Authorization expired or browser verification failed. Start again in Slack.')
      await tx.set('oauth', id, { used: true })
      return r
    })
  }
  async function start(token, provider) {
    const r = await take(token, provider, 'ticket')
    await admin(r)
    const state = random(), browser = random(), verifier = random(), id = key(state)
    await store.create('oauth', id, { team: r.team, config: r.config, user: r.user, provider, phase: 'state', browser: key(browser),
      verifier: seal(verifier, `oauth:${id}`), used: false, at: clock(), expiresAt: clock() + 10 * 60000 })
    return { state, browser, url: authorization(provider, state, verifier, env) }
  }
  async function finish(provider, state, browser, code) {
    if (typeof code !== 'string' || !code || code.length > 2048) throw new Error('Missing authorization code.')
    const r = await take(state, provider, 'state', browser)
    await admin(r) // An administrator removed during consent cannot finish.
    const credentials = await providerApi.exchange(provider, code, unseal(r.verifier, `oauth:${r.id}`))
    if (!(await providerApi.roots(provider, credentials.access)).length) throw new Error('No eligible provider organizations found. Install the GitHub app or grant the required provider permissions, then reconnect.')
    const id = randomUUID()
    await store.locked(`connection:${r.team}:${provider}`, async tx => {
      const existing = (await tx.integrationPage('connections', r.team, r.config, 0)).find(c => c.provider === provider)
      if (existing?.expiresAt > clock()) throw new Error('This workspace already has this provider connected. Disconnect it in Slack before replacing the account.')
      if (existing) await tx.removeIntegration('connections', r.team, existing.id)
      await tx.create('connections', id, { team: r.team, user: r.user, provider, credentials: seal(credentials, `connection:${r.team}:${id}`), version: 1, at: clock(), expiresAt: clock() + 90 * 86400000 })
    })
    return { team: r.team }
  }
  return { ticket, start, finish }
}
function createOAuthHandler(oauth) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'")
    const [provider, action] = Array.isArray(req.query.path) ? req.query.path : []
    if (!['github', 'jira', 'linear'].includes(provider) || !['start', 'callback'].includes(action)) return res.status(404).send('Not found')
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).send('Method not allowed') }
    try {
      if (action === 'start') {
        const r = await oauth.start(req.query.ticket, provider)
        res.setHeader('Set-Cookie', `__Host-kick-${provider}-${r.state.slice(0, 12)}=${r.browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)
        return res.redirect(302, r.url)
      }
      if (!valid(req.query.state)) throw new Error('Invalid state')
      const cookie = `__Host-kick-${provider}-${req.query.state.slice(0, 12)}`
      const r = await oauth.finish(provider, req.query.state, req.cookies?.[cookie], req.query.code)
      res.setHeader('Set-Cookie', `${cookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      const team = /^[A-Z0-9]+$/.test(r.team) ? r.team : ''
      return res.status(200).send(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connected · Kick</title></head><body><main><h1>Provider connected</h1><p>No issues have been imported or changed.</p><p>Return to Kick Home → Team planning → Issue sync. Choose your project or repository, then preview an issue before sharing it with your channel.</p><p><a href="https://app.slack.com/client/${team}">Return to Slack</a></p></main></body></html>`)
    } catch {
      // OAuth errors must never echo codes, tokens, provider responses or query strings.
      return res.status(400).send('Connection could not be completed. Return to Kick → Issue sync and start again. Check provider access; disconnect an existing connection before replacing it.')
    }
  }
}
module.exports = { createOAuth, createOAuthHandler }
