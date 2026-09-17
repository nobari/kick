import slack from '../../../server/slack.js'

export const config = {
  api: {
    bodyParser: false
  },
  maxDuration: 60
}

export default function handler(req, res) {
  if (process.env.KICK_MAINTENANCE === '1') {
    res.setHeader('Retry-After', '60')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ error: 'Kick is temporarily unavailable for a database migration. Please retry shortly.' })
  }
  if (!slack.isConfigured && !req.url.startsWith('/api/slack/health')) {
    return res.status(503).json({
      error: 'Slack service is not configured',
      missingEnvironmentVariables: slack.missingEnv
    })
  }

  return slack.handler(req, res)
}
