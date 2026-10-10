import integrationRuntime from '../../../server/integrations/runtime'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

export default async function handler(req, res) {
  try { return await integrationRuntime.handler(req, res) }
  catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).send('Connections are temporarily unavailable. Please try again from Slack.')
  }
}
