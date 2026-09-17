const { timingSafeEqual } = require('node:crypto')
function createCronHandler(slack, env = process.env) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }
    const secret = env.CRON_SECRET
    const expected = Buffer.from(`Bearer ${secret || ''}`)
    const provided = Buffer.from(typeof req.headers.authorization === 'string' ? req.headers.authorization : '')
    if (!secret || secret.length < 32 || expected.length !== provided.length || !timingSafeEqual(expected, provided))
      return res.status(401).json({ error: 'Unauthorized' })
    if (!slack.isConfigured || !slack.rituals) return res.status(503).json({ error: 'Slack service not configured' })
    if (env.KICK_SCHEDULER_ENABLED !== 'true') return res.status(503).json({ error: 'Scheduler activation required' })
    try { return res.status(200).json(await slack.rituals.tick()) }
    catch { return res.status(500).json({ error: 'Scheduler failed; inspect server logs and retry.' }) }
  }
}
module.exports = { createCronHandler }
