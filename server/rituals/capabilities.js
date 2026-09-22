// OAuth scope changes are a separate release decision from feature activation.
const BASE_SCOPES = ['channels:history', 'channels:read', 'chat:write', 'chat:write.public', 'commands', 'users:read']
function oauthScopes(env = process.env) {
  return [...BASE_SCOPES, ...(env.KICK_OAUTH_DM_SCOPE_ENABLED === 'true' ? ['im:write'] : [])]
}
function canDirectMessage(installation) {
  const scopes = installation?.bot?.scopes || []
  return (Array.isArray(scopes) ? scopes : scopes.split(',')).includes('im:write')
}
module.exports = { oauthScopes, canDirectMessage }
