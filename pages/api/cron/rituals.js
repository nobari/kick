import slack from '../../../server/slack.js'
import cron from '../../../server/rituals/cron.js'

export const config = { maxDuration: 60 }

export default cron.createCronHandler(slack)
