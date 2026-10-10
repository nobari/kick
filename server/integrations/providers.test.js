const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { createProviders, authorization } = require('./providers')
const { createOAuthHandler } = require('./oauth')

test('provider consent uses fixed callbacks, minimal configured scopes and Linear PKCE', () => {
  const env = Object.fromEntries(['GITHUB','JIRA','LINEAR'].flatMap(p => [[`KICK_${p}_CLIENT_ID`, 'id'], [`KICK_${p}_CLIENT_SECRET`, 'private']]))
  for (const p of ['github','jira','linear']) {
    const url = new URL(authorization(p, 'state', 'verifier', env))
    assert.equal(url.searchParams.get('redirect_uri'), `https://kick.bozmoz.com/api/integrations/${p}/callback`)
    assert.equal(url.searchParams.get('state'), 'state'); assert.ok(!url.href.includes('private'))
    if (p === 'linear') assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update('verifier').digest('base64url'))
    if (p === 'jira') assert.equal(url.searchParams.get('scope'), 'read:jira-work write:jira-work offline_access')
  }
  assert.throws(() => authorization('evil', 's', 'v', env), /Unsupported/)
})
test('provider adapters read and update only selected issue states with bounded, non-redirecting requests', async () => {
  const requests = []
  const api = createProviders({ fetcher: async (url, options) => {
    requests.push({ url, options }); assert.equal(options.redirect, 'error'); assert.ok(options.signal)
    let response
    if (url.includes('/repos/org/repo/issues/42')) response = { number: 42, title: 'Example', state: 'open', updated_at: 'v1' }
    else if (url.includes('/issue/TEAM-42?')) response = { id: '42', key: 'TEAM-42', fields: { summary: 'Example', updated: 'v1', project: { id: 'project' }, status: { id: '1', statusCategory: { key: 'new' } } } }
    else if (url.endsWith('/issue/42/transitions')) response = { transitions: [{ id: '2', name: 'Finish', to: { id: '3', statusCategory: { key: 'done' } } }] }
    else if (url.endsWith('/issue/TEAM-42/transitions')) response = {}
    else if (url === 'https://api.linear.app/graphql') {
      const { query } = JSON.parse(options.body)
      response = { data: query.startsWith('query Issue') ? { issue: { id: 'linear-id', title: 'Example', updatedAt: 'v1', team: { id: 'team' }, state: { id: 'one', type: 'started' } } } : query.startsWith('query States') ? { team: { states: { nodes: [{ id: 'two', name: 'Done', type: 'completed' }] } } } : { issueUpdate: { success: true } } }
    } else throw new Error('Unexpected provider path')
    return { ok: true, status: 200, json: async () => response }
  } })
  for (const [provider, mapping, remote] of [['github',{ container: 'org/repo' },'42'], ['jira',{ root: 'site', container: 'project' },'TEAM-42'], ['linear',{ container: 'team' },'TEAM-42']]) {
    const issue = await api.issue(provider, 'secret', mapping, remote)
    assert.equal(issue.title, 'Example'); assert.equal(issue.done, false)
    await api.change(provider, 'secret', mapping, issue.id, provider === 'github' ? 'closed' : issue.states[0].id)
    await assert.rejects(api.issue(provider, 'secret', mapping, 'https://evil.example/'), /not a URL/)
  }
  await assert.rejects(api.issue('jira', 'secret', { root: 'site', container: 'other' }, 'TEAM-42'), /different project/)
  await assert.rejects(api.issue('linear', 'secret', { container: 'other' }, 'TEAM-42'), /different team/)
  assert.ok(requests.every(r => !r.url.includes('secret')))
  const writes = requests.filter(r => ['PATCH','POST'].includes(r.options.method) && !r.url.includes('graphql'))
  assert.ok(writes.every(r => !JSON.stringify(r.options.body).includes('title')))
})
test('provider failures never expose token responses or raw exception messages', async () => {
  const api = createProviders({ fetcher: async () => ({ ok: false, status: 401, json: async () => ({ error: 'secret-token' }) }) })
  await assert.rejects(api.roots('github', 'private'), e => !e.message.includes('secret-token') && /401/.test(e.message))
  const offline = createProviders({ fetcher: async () => { throw new Error('secret-token') } })
  await assert.rejects(offline.roots('github', 'private'), e => !e.message.includes('secret-token'))
})
test('OAuth HTTP handler rejects unsafe methods, malformed state and error reflection', async () => {
  let calls = 0
  const handler = createOAuthHandler({ start: async () => { calls++; throw new Error('credential-secret') }, finish: async () => { calls++; } })
  function response() { return { headers: {}, setHeader(k,v) { this.headers[k] = v }, status(n) { this.code = n; return this }, send(v) { this.body = v; return this } } }
  const method = response(); await handler({ method: 'POST', query: { path: ['github','start'] } }, method)
  assert.equal(method.code, 405); assert.equal(calls, 0)
  const invalid = response(); await handler({ method: 'GET', query: { path: ['github','callback'], state: ['bad'] } }, invalid)
  assert.equal(invalid.code, 400); assert.equal(calls, 0)
  const error = response(); await handler({ method: 'GET', query: { path: ['github','start'] } }, error)
  assert.equal(error.code, 400); assert.ok(!error.body.includes('credential-secret')); assert.equal(error.headers['Cache-Control'], 'no-store')
})
