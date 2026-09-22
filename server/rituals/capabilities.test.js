const test = require('node:test')
const assert = require('node:assert/strict')
const { oauthScopes, canDirectMessage } = require('./capabilities')
test('runtime reminder activation cannot expand the published OAuth scope list', () => {
  assert.equal(oauthScopes({ KICK_RITUALS_DM_ENABLED: 'true' }).includes('im:write'), false)
  assert.equal(oauthScopes({ KICK_OAUTH_DM_SCOPE_ENABLED: 'true' }).includes('im:write'), true)
  assert.equal(oauthScopes({}).length, 6)
})
test('DM capability requires explicit installation consent', () => {
  assert.equal(canDirectMessage(null), false)
  assert.equal(canDirectMessage({ bot: { scopes: ['chat:write'] } }), false)
  assert.equal(canDirectMessage({ bot: { scopes: ['chat:write', 'im:write'] } }), true)
  assert.equal(canDirectMessage({ bot: { scopes: 'chat:write,im:write' } }), true)
})
