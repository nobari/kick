const { createHash } = require('node:crypto')
const ORIGIN = 'https://kick.bozmoz.com'
const providers = ['github', 'jira', 'linear']
const callback = p => `${ORIGIN}/api/integrations/${p}/callback`
const part = value => encodeURIComponent(String(value))
function settings(provider, env = process.env) {
  if (!providers.includes(provider)) throw new Error('Unsupported provider.')
  const prefix = `KICK_${provider.toUpperCase()}`
  const client_id = env[`${prefix}_CLIENT_ID`], client_secret = env[`${prefix}_CLIENT_SECRET`]
  if (!client_id || !client_secret) throw new Error('This provider is not configured yet.')
  return { client_id, client_secret }
}
function authorization(provider, state, verifier, env = process.env) {
  const { client_id } = settings(provider, env)
  const urls = { github: 'https://github.com/login/oauth/authorize', jira: 'https://auth.atlassian.com/authorize', linear: 'https://linear.app/oauth/authorize' }
  const url = new URL(urls[provider])
  const params = { client_id, redirect_uri: callback(provider), state, response_type: 'code' }
  if (provider === 'jira') Object.assign(params, { audience: 'api.atlassian.com', scope: 'read:jira-work write:jira-work offline_access', prompt: 'consent' })
  if (provider === 'linear') Object.assign(params, { scope: 'read,write', actor: 'app', prompt: 'consent', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.href
}
function createProviders({ fetcher = fetch, env = process.env, clock = Date.now } = {}) {
  async function request(url, { token, method = 'GET', body, form = false } = {}) {
    // All URLs originate in fixed provider endpoints below. Never follow redirects
    // with an Authorization header, including repository moves.
    let res
    try {
      res = await fetcher(url, { method, redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json', 'User-Agent': 'Kick-Team-Sync', ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}),
          ...(url.startsWith('https://api.github.com/') ? { 'X-GitHub-Api-Version': '2026-03-10' } : {}) },
        ...(body ? { body: form ? new URLSearchParams(body).toString() : JSON.stringify(body) } : {}) })
    } catch { throw new Error('Provider request could not finish. Retry from Slack; no credentials were logged.') }
    if (!res.ok) throw new Error(res.status === 429 ? 'Provider rate limit reached. Try again later.' : `Provider rejected the request (${res.status}). Check access or reconnect.`)
    if (res.status === 204) return {}
    let data
    try { data = await res.json() } catch { throw new Error('Provider returned an unreadable response.') }
    if (data.error || data.errors?.length) throw new Error('Provider rejected the operation. Check permissions and retry.')
    return data
  }
  async function token(provider, values) {
    const urls = { github: 'https://github.com/login/oauth/access_token', jira: 'https://auth.atlassian.com/oauth/token', linear: 'https://api.linear.app/oauth/token' }
    const r = await request(urls[provider], { method: 'POST', body: { ...settings(provider, env), ...values }, form: provider !== 'jira' })
    if (typeof r.access_token !== 'string' || !r.access_token) throw new Error('Provider authorization failed.')
    const seconds = Number(r.expires_in || 3600)
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Provider token expiry is invalid.')
    return { access: r.access_token, refresh: r.refresh_token || values.refresh_token, expires: clock() + seconds * 1000 }
  }
  const exchange = (p, code, verifier) => token(p, { grant_type: 'authorization_code', code, redirect_uri: callback(p), ...(p === 'linear' ? { code_verifier: verifier } : {}) })
  const refresh = (p, value) => token(p, { grant_type: 'refresh_token', refresh_token: value })
  const gh = (token, path, method, body) => request(`https://api.github.com${path}`, { token, method, body })
  const jira = (token, site, path, method, body) => request(`https://api.atlassian.com/ex/jira/${part(site)}/rest/api/3${path}`, { token, method, body })
  async function linear(token, query, variables = {}) { return (await request('https://api.linear.app/graphql', { token, method: 'POST', body: { query, variables } })).data }
  async function roots(provider, token) {
    if (provider === 'github') {
      const r = await gh(token, '/user/installations?per_page=100')
      if (r.total_count > 100) throw new Error('More than 100 installations are available. Narrow this GitHub account’s app access first.')
      return r.installations.filter(i => i.permissions?.issues === 'write').map(i => ({ id: String(i.id), label: i.account.login }))
    }
    if (provider === 'jira') return (await request('https://api.atlassian.com/oauth/token/accessible-resources', { token })).filter(s => s.scopes.includes('read:jira-work') && s.scopes.includes('write:jira-work')).map(s => ({ id: s.id, label: s.name }))
    const r = await linear(token, '{ organization { id name } }')
    return [{ id: r.organization.id, label: r.organization.name }]
  }
  async function containers(provider, token, root) {
    if (!(await roots(provider, token)).some(r => r.id === root)) throw new Error('That organization or site is no longer accessible.')
    if (provider === 'github') {
      const r = await gh(token, `/user/installations/${part(root)}/repositories?per_page=100`)
      if (r.total_count > 100) throw new Error('Limit this app installation to at most 100 selected repositories in GitHub.')
      return r.repositories.filter(r => r.has_issues && !r.archived && r.permissions?.push).map(r => ({ id: r.full_name, label: r.full_name }))
    }
    if (provider === 'jira') {
      const r = await jira(token, root, '/project/search?maxResults=100')
      if (!r.isLast) throw new Error('More than 100 Jira projects are accessible. Narrow access for the connected account.')
      return r.values.map(p => ({ id: p.id, label: `${p.key} · ${p.name}` }))
    }
    const r = await linear(token, '{ teams(first:100) { nodes { id name } pageInfo { hasNextPage } } }')
    if (r.teams.pageInfo.hasNextPage) throw new Error('More than 100 Linear teams are accessible. Narrow app access first.')
    return r.teams.nodes.map(t => ({ id: t.id, label: t.name }))
  }
  async function issue(provider, token, mapping, identifier) {
    if (typeof identifier !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(identifier)) throw new Error('Use an issue number or issue key, not a URL.')
    let r
    if (provider === 'github') {
      if (!/^\d+$/.test(identifier) || !/^[\w.-]+\/[\w.-]+$/.test(mapping.container)) throw new Error('Enter a GitHub issue number.')
      r = await gh(token, `/repos/${mapping.container}/issues/${identifier}`)
      if (r.pull_request) throw new Error('Pull requests are not supported; choose an issue.')
      return { id: String(r.number), title: r.title, status: r.state, done: r.state === 'closed', revision: r.updated_at, states: [{ id: 'open', label: 'Open' }, { id: 'closed', label: 'Closed' }] }
    }
    if (provider === 'jira') {
      r = await jira(token, mapping.root, `/issue/${part(identifier)}?fields=summary,status,project,updated`)
      if (r.fields.project.id !== mapping.container) throw new Error('This issue belongs to a different project.')
      const transitions = await jira(token, mapping.root, `/issue/${part(r.id)}/transitions`)
      return { id: r.key, title: r.fields.summary, status: r.fields.status.id, done: r.fields.status.statusCategory.key === 'done', revision: r.fields.updated,
        states: transitions.transitions.map(t => ({ id: t.id, label: t.name, status: t.to.id, done: t.to.statusCategory?.key === 'done' })) }
    }
    r = (await linear(token, 'query Issue($id:String!){ issue(id:$id) { id title updatedAt team { id } state { id type } } }', { id: identifier })).issue
    if (!r || r.team.id !== mapping.container) throw new Error('This issue belongs to a different team or is unavailable.')
    const states = (await linear(token, 'query States($id:String!){ team(id:$id) { states { nodes { id name type } } } }', { id: mapping.container })).team.states.nodes
    return { id: r.id, title: r.title, status: r.state.id, done: ['completed', 'canceled'].includes(r.state.type), revision: r.updatedAt,
      states: states.map(s => ({ id: s.id, label: s.name, done: ['completed', 'canceled'].includes(s.type) })) }
  }
  async function change(provider, token, mapping, remote, state) {
    // Callers must first re-fetch and validate the issue, revision and offered state.
    if (provider === 'github') return gh(token, `/repos/${mapping.container}/issues/${part(remote)}`, 'PATCH', { state })
    if (provider === 'jira') return jira(token, mapping.root, `/issue/${part(remote)}/transitions`, 'POST', { transition: { id: state } })
    const r = await linear(token, 'mutation UpdateIssue($id:String!,$state:ID!){ issueUpdate(id:$id,input:{stateId:$state}) { success } }', { id: remote, state })
    if (!r.issueUpdate.success) throw new Error('Linear did not confirm the status change.')
  }
  return { exchange, refresh, roots, containers, issue, change }
}
module.exports = { ORIGIN, providers, settings, authorization, createProviders }
