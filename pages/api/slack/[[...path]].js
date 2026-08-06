import slack from '../../../server/slack.js'

export const config = {
  api: {
    bodyParser: false
  },
  maxDuration: 60
}

export default function handler(req, res) {
  if (!slack.isConfigured && req.url !== '/api/slack/health') {
    return res.status(503).json({
      error: 'Slack service is not configured',
      missingEnvironmentVariables: slack.missingEnv
    })
  }

  return slack.handler(req, res)
}
