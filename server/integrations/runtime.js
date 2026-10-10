const { WebClient } = require('@slack/web-api')
const { getDatabase } = require('../db/connection.cjs')
const { createInstallationRepository } = require('../db/installations.cjs')
const { createStore } = require('../rituals/store')
const { createProviders } = require('./providers')
const { createOAuth, createOAuthHandler } = require('./oauth')

async function assertAdmin(client, ctx) {
  const r = await client.users.info({ user: ctx.user })
  const user = r.user
  if (!user || user.team_id !== ctx.team || user.deleted || user.is_bot || user.is_restricted || user.is_ultra_restricted || !(user.is_admin || user.is_owner)) throw new Error('Only an active administrator of this Slack workspace can manage issue sync.')
}
function handler(req, res) {
  const db = getDatabase(), store = createStore(db)
  const installations = createInstallationRepository(db, { environment: process.env.TEST ? 'test' : 'production' })
  const oauth = createOAuth(store, {
    providerApi: createProviders(),
    admin: async ctx => {
      const c = await store.get('configs', ctx.config)
      if (!c || c.team !== ctx.team) throw new Error('Workflow unavailable.')
      const install = await installations.fetchInstallation({ teamId: ctx.team, isEnterpriseInstall: false })
      const client = new WebClient(install.bot.token, { retryConfig: { retries: 0 }, timeout: 8000 })
      await assertAdmin(client, ctx)
      let cursor, found = false
      do {
        const r = await client.conversations.members({ channel: c.channel, cursor, limit: 200 })
        found ||= r.members.includes(ctx.user); cursor = r.response_metadata?.next_cursor
      } while (cursor && !found)
      if (!found) throw new Error('Channel access removed.')
    },
  })
  return createOAuthHandler(oauth)(req, res)
}
module.exports = { assertAdmin, handler }
