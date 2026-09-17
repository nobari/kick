const TEST = !!process.env.TEST
const FAST = true
const GLOBAL_PREFIX = TEST ? 't' : ''
const INSTALL_LINK = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://kick.bozmoz.com'}/api/slack/install`,
  EMAIL = 'kick.bot.help@gmail.com'
const APP_CONFIG = {
  funcs: {
    pick: { cmd: `/${GLOBAL_PREFIX}pick`, back: `${GLOBAL_PREFIX}pick_submit` },
    kudos: {
      cmd: TEST ? /\/tkudos|\/tcoins/ : /\/kudos|\/coins/,
      back: `${GLOBAL_PREFIX}kudos_submit`
    },
    sync: {
      cmd: `/${GLOBAL_PREFIX}sync`,
      back: `${GLOBAL_PREFIX}sync_submit`,
      backUpdate: `${GLOBAL_PREFIX}sync_submit_update`
    }
  }
}
var _ = require('lodash')
if (process.env.KICK_STORAGE_BACKEND && process.env.KICK_STORAGE_BACKEND !== 'postgres') throw new Error('Kick requires Postgres');
const { getDatabase } = require('./db/connection.cjs');
const postgres = { query: (...args) => getDatabase().query(...args), transaction: (...args) => getDatabase().transaction(...args) };
const workflows = require('./db/workflows.cjs').createWorkflowRepository(postgres);
const postgresInstallations = require('./db/installations.cjs').createInstallationRepository(postgres, { environment: TEST ? 'test' : 'production' });
const Logger = { log() {}, error() { console.error('Slack workflow failed') } };

const {
  App,
  ExpressReceiver,
  ViewOutput,
  SlashCommand
} = require('@slack/bolt')
const {
  WebClient,
  ViewsOpenArguments,
  ViewsUpdateArguments,
  LogLevel
} = require('@slack/web-api')

const parser = require('yargs-parser')
const OAUTHDB = 'auth'

const REQUIRED_ENV = [
  'SLACK_CLIENT_ID',
  'SLACK_CLIENT_SECRET',
  'SLACK_SIGNING_SECRET',
  'SLACK_STATE_SECRET'
]
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name])
missingEnv.push(...['DATABASE_URL', 'KICK_DATA_KEY'].filter(name => !process.env[name]))
const slackConfig = {
  clientId: process.env.SLACK_CLIENT_ID || 'not-configured',
  clientSecret: process.env.SLACK_CLIENT_SECRET || 'not-configured',
  signingSecret: process.env.SLACK_SIGNING_SECRET || 'not-configured'
}
const timeout = (time) =>
  new Promise((r) => {
    setTimeout(r, time)
  })
const expressReceiver = new ExpressReceiver({
  endpoints: '/api/slack/events',
  ...slackConfig,
  processBeforeResponse: true,
  stateSecret: process.env.SLACK_STATE_SECRET || 'not-configured',
  scopes: [
    'channels:history',
    'channels:read',
    'chat:write',
    'chat:write.public',
    'commands',
    ...(process.env.KICK_RITUALS_DM_ENABLED === 'true' ? ['im:write'] : []),
    'users:read'
  ],
  installationStore: {
    storeInstallation: async (installation) => {
      return postgresInstallations.storeInstallation(installation)
    },
    fetchInstallation: async (installQuery) => {
      return postgresInstallations.fetchInstallation(installQuery)
    },
    deleteInstallation: async (installQuery) => {
      return postgresInstallations.deleteInstallation(installQuery)
    }
  },
  installerOptions: {
    directInstall: true,
    callbackOptions: require('./install-result'),
    installPath: '/api/slack/install',
    redirectUriPath: '/api/slack/oauth_redirect'
  }
})
const app = new App({
  // token: process.env.SLACK_BOT_TOKEN || functions.config().slack.bot_token,
  processBeforeResponse: true,
  // scopes,
  // clientId,
  // clientSecret,
  // stateSecret,
  // installationStore,
  // installerOptions,
  // signingSecret,
  receiver: expressReceiver
  // logLevel: LogLevel.DEBUG,
  // customRoutes: [
  //   {
  //     path: '/health-check',
  //     method: ['GET'],
  //     handler: (req, res) => {
  //       res.writeHead(200);
  //       res.end('Health check information displayed here!');
  //     },
  //   },
  // ]
})
// Other web requests are methods on receiver.router
expressReceiver.router.get('/sasha', async (req, res) => {
  // You're working with an express req and res now.
  if (req.query.test) {
    try {
      return res.send(`Salaam ${await workflows.installationCount()}!`)
    } catch (e) {
      return res.status(503).json({ error: 'Database unavailable' })
    }
  } else res.send('Salaam!')
})
expressReceiver.router.get('/', async (req, res) => {
  // You're working with an express req and res now.
  res.redirect(process.env.NEXT_PUBLIC_SITE_URL || 'https://kick.bozmoz.com')
})
expressReceiver.router.get('/api/slack/health', async (req, res) => {

    try {
      if (req.query.deep === '1') await workflows.health()
      return res.status(missingEnv.length ? 503 : 200).json({ ok: !missingEnv.length, service: 'kick-slack', database: req.query.deep === '1' ? 'connected' : 'configured', backend: 'postgres', missingEnvironmentVariables: missingEnv })
    } catch {
      return res.status(503).json({ ok: false, service: 'kick-slack', database: 'unavailable', backend: 'postgres' })
    }

})
// Global error handler
app.error(() => console.error('Slack request failed'))

function splitArrayIntoChunks(arr, chunkSize) {
  const chunks = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 *
 * @param {Promise<void>} ACK
 * @param {WebClient} client
 * @param {SlashCommand} body
 * @returns
 */
async function openDraftView(ACK, client, body, title) {
  const AT = Date.now(),
    myUserID = body.user_id,
    team = body.team_id,
    channel = body.channel_id,
    trigger_id = body.trigger_id
  try {
    const resP = client.views.open({
      trigger_id,
      view: {
        type: 'modal',
        title: {
          type: 'plain_text',
          text: title
        },
        close: {
          type: 'plain_text',
          text: 'Close'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: ':bicyclist: loading...'
            }
          }
        ]
      }
    })
    Logger.log('draftack0')
    const [res, ack] = await Promise.all([resP, ACK])
    Logger.log('draftack1')
    const view_id = res.view.id
    try {
      const ch = await client.conversations.info({ channel })
      await workflows.saveContext(team, channel, myUserID, body.team_domain, body.user_name, ch.channel, AT)
      Logger.log(`channel access ok:${JSON.stringify(ch)}`)
      return view_id
    } catch (e) {
      const errorCode = e?.data?.error
      let title = 'Error',
        text = `:warning:\nAn error occured please try again :bow:error:\n\`${errorCode}\``
      if (errorCode == 'channel_not_found') {
        title = 'Channel access is needed'
        text = `:warning:\nIt seems it is a private channel that I am not a member. Please add me to the channel as a member :bow:.\n I need to be a member so that:\n- writing message.\n- fetching the existing members of the channel.`
      }
      Logger.log(`channel access error:`, errorCode || e)
      await client.views.update({
        view_id,
        view: {
          type: 'modal',
          // callback_id: APP_CONFIG.funcs.pick.back,
          private_metadata: channel,
          close: {
            type: 'plain_text',
            text: 'Close',
            emoji: true
          },
          title: {
            type: 'plain_text',
            text: title,
            emoji: true
          },
          blocks: [
            {
              block_id: 'top',
              type: 'section',
              text: {
                type: 'mrkdwn',
                text
              }
            }
            // {
            //   type: "divider",
            // },
          ]
        }
      })
    }
  } catch (e) {
    const errorCode = e?.data?.error
    let text = `Sorry, an error occurred, please try again. :bow:\n if needed please contact us at ${EMAIL}`
    if (errorCode == 'invalid_trigger_id') {
      text = `There is an error to the token that we have, If it happens multiple time please reinstall me by following <${INSTALL_LINK}|this link> :bow:. Thanks and Sorry.`
    } else if (errorCode == 'expired_trigger_id') {
      text = 'Sorry, We were slightly busy :sweat:, please try again. :bow:'
    }
    const errSay = await client.chat.postMessage({ channel, text })

    setTimeout(() => {
      try {
        client.chat.delete({ channel, ts: errSay.ts })
      } catch (e) {}
    }, 10000)
    Logger.log(`openDraftView error:`, errorCode || e, `trigger:${trigger_id}`)
  }
}

app.message('start', async ({ client, body, logger }) => {})
// Listens to incoming messages that contain "hello"
app.message('salaam', async (t) => {
  const { say, message } = t

  // say() sends a message to the channel where the event was triggered
  await say({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Salaam you <@${message.user}> [${
            message.type == 'message' ? message.text : 'NON TEXT'
          }] > ${JSON.stringify(t.client.conversations.members)}!`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Bezan'
          },
          action_id: 'sync_click'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `test`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'test'
          },
          action_id: 'test_click'
        }
      }
    ],
    text: `Salaam there <@${message.user}>!`
  })
})

app.action('test_click', async ({ body, ack, client, action, logger }) => {
  // Acknowledge the action
  await ack()
  try {
    await client.chat.postMessage({
      // token: USER_TOKEN,
      channel: 'C03K9KS6NKD',
      thread_ts: '1666246610.686799',
      as_user: true,
      text: `test`
    })
    Logger.log('modal:body:', body.channel)
  } catch (error) {
    Logger.error(error)
  }
})

/**
 * sample output {
      m: ":slightly_frowning_face:",
      l: "1",
      t: "2",
      b: "3",
      k: ["U03A25Y0U3Z"],
    }
 * @param {ViewOutput["state"]["values"]} values
 * @returns {{[key : string]:string|Array<string>}}
 */
function extractValues(values) {
  const result = {}
  for (const blockId in values) {
    const block = values[blockId]
    if (block) {
      const input = block['input']
      if (input) {
        result[blockId] =
          input.value ||
          input.selected_option?.value ||
          input.selected_users ||
          input.selected_user ||
          input.selected_options?.map((o) => o.value)
      }
    }
  }
  return result
}
function isNewSync(old, now) {
  return old < now - 12 * 3600 * 1000
}
function sortObj(obj) {
  // let sortable = [];
  // for (var k in obj) {
  //   sortable.push([k, obj[k]]);
  // }
  const sortable = Object.entries(obj)

  sortable.sort(function (a, b) {
    return b[1] - a[1]
  })
  return sortable
}
function arrToStr(arr) {
  return arr.map((o) => `${o[0]}:${o[1]}`).join('\n')
}
//<https://google.com|gggg>
app.action('sync_click', async ({ body, ack, client, action, logger }) => {
  // Acknowledge the action
  await ack()
  try {
    const result = await client.views.open(
      getSyncView(
        body.trigger_id,
        body.user.id,
        body.channel.id,
        undefined,
        true
      )
    )
    Logger.log('modal:body:', body.channel)
  } catch (error) {
    Logger.error(error)
  }
})
/**
 *
 * @param {import("@slack/bolt").RespondFn} respond
 * @param {import("@slack/bolt").AckFn} ack
 */
async function ACKFN(respond, ack) {
  ack()
  return respond({
    text: "I'm working on your command :bow:",
    response_type: 'ephemeral'
  })
}
app.command(
  APP_CONFIG.funcs.sync.cmd,
  async ({ command, ack, say, respond, client, body }) => {
    // Acknowledge command request
    try {
      const AT = Date.now()
      const channel = body.channel_id,
        myUserID = body.user_id,
        team = body.team_id,
        trigger_id = body.trigger_id
      Logger.log(`sync0:myUserID=${myUserID}`)
      const ACK = ACKFN(respond, ack)
      Logger.log(`sync1:myUserID=${myUserID}`)
      const cmd = await getCommands(client, myUserID, command.text, trigger_id)
      Logger.log(`sync2:myUserID=${myUserID}`)
      if (cmd) {
        if (typeof cmd == 'boolean') return
        if (typeof cmd == 'string') return say(cmd)
        if (cmd.report) {
          const syncs = await getSyncs(team, channel, cmd.report, AT)
          if (!syncs?.length) {
            return say(`${getMention(myUserID)} no record ATM.`)
          }
          const moods = {},
            moodPersons = {}
          syncs.forEach((element) => {
            const m = element?.values?.m
            if (m) {
              moods[m] = (moods[m] || 0) + 1
              const person = element.f
              moodPersons[person] = (moodPersons[person] || '') + m
            }
          })
          const moodsSorted = sortObj(moods)
          const texts = [
            `Asked by ${getMention(myUserID)} to report last ${
              cmd.report
            } days of our syncs`,
            `${arrToStr(moodsSorted)}`,
            `Each member:`,
            `${arrToStr(
              Object.entries(moodPersons).map((o) => {
                o[0] = getMention(o[0])
                return o
              })
            )}`
          ]
          const blocks = []
          blocks.push(
            {
              type: 'section',
              block_id: 'm',
              text: {
                type: 'mrkdwn',
                text: texts[0]
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Summary'
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: texts[1]
                }
              ]
            },
            {
              type: 'divider'
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Each member'
                }
              ]
            },
            {
              type: 'section',
              block_id: 'p',
              text: {
                type: 'mrkdwn',
                text: texts[3]
              }
            }
          )
          Logger.log('syncR')
          return say({ blocks, text: texts.join('\n') })
        }
      }
      const viewId = await openDraftView(ACK, client, body, 'sync form...')
      Logger.log(`sync3:myUserID=${myUserID}`)
      if (!viewId) return
      let isNew = true,
        lastValues,
        isNewForMe = true
      const dailySynced = await loadDailyState(team, channel)
      Logger.log(`sync4:team:${team} channel:${channel}`)
      if (dailySynced) {
        const oldTs = dailySynced
        isNew = isNewSync(oldTs.AT, AT)
        Logger.log(`sync40:myUserID:${myUserID} isNew:${isNew}`)
        let myLastTS = oldTs.u && oldTs.u[myUserID]
        isNewForMe = isNew || !myLastTS
        if (!myLastTS) myLastTS = oldTs.last?.u && oldTs.last.u[myUserID]
        if (myLastTS) {
          Logger.log(`sync41:myUserID=${myUserID} myLastTS=${myLastTS}`)
          const result = await loadStandup(team, channel, myLastTS)
          if (result) {
            Logger.log(`sync42:myUserID=${myUserID}`)
            const myLastSync = result
            if (myLastSync) {
              lastValues = myLastSync.values
              lastValues.link = myLastSync.link
            }
          }
        }
      }
      Logger.log(`sync5:myUserID=${myUserID}`)
      const result = await client.views.update(
        getSyncView(
          viewId,
          myUserID,
          channel,
          lastValues,
          !lastValues || isNewForMe
        )
      )
      Logger.log(`sync6:myUserID=${myUserID}`)
    } catch (error) {
      Logger.error(error)
    }
  }
)
app.command(
  APP_CONFIG.funcs.kudos.cmd,
  async ({ command, respond, ack, say, client, logger, body }) => {
    // Acknowledge command request
    try {
      const channel = body.channel_id,
        myUserID = body.user_id,
        team = body.team_id,
        AT = Date.now(),
        trigger_id = body.trigger_id
      const isCoin = /coin/i.test(command.command)
      Logger.log('kudos0')
      const ACK = ACKFN(respond, ack)
      Logger.log('kudos1')
      const cmd = await getCommands(client, myUserID, command.text, trigger_id)
      if (cmd) {
        if (typeof cmd == 'boolean') return
        if (typeof cmd == 'string') return say(cmd)
        if (cmd.report) {
          const ks = await getKudos(team, cmd.report, AT)
          if (!ks?.length) {
            return say(`${getMention(myUserID)} no record ATM.`)
          }
          const koduses = {},
            kPersons = {}
          ks.forEach((element) => {
            const m = element?.k
            if (m) {
              koduses[m] = (koduses[m] || 0) + 1
              if (!kPersons[m]) kPersons[m] = []
              kPersons[m].push(
                `<${element.link}|here> from ${getMention(element.f)}`
              )
            }
          })
          const kSorted = sortObj(koduses)
          const eachMember = kSorted.map(([k, v]) => {
            return `- ${getMention(k)} :${v} by [${kPersons[k].join(', ')}]`
          })
          const texts = [
            `Asked by ${getMention(myUserID)} to report last ${
              cmd.report
            } days of our ${isCoin ? `Coins` : `Kudos :tada:`}`,
            `${kSorted.map((o) => `${getMention(o[0])} :${o[1]}`).join('\n')}`
            // `Each member:`,
            // `${eachMember.join("\n")}`,
          ]
          const blocks = []
          blocks.push(
            {
              type: 'section',
              block_id: 'm',
              text: {
                type: 'mrkdwn',
                text: texts[0]
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Summary'
                }
              ]
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: texts[1]
                }
              ]
            }
          )
          // const eachMemberText = eachMember.join("\n\n");
          // blocks.push(
          //   {
          //     type: "divider",
          //   },
          //   {
          //     type: "context",
          //     elements: [
          //       {
          //         type: "mrkdwn",
          //         text: "Each member",
          //       },
          //     ],
          //   },
          //   {
          //     type: "section",
          //     text: {
          //       type: "mrkdwn",
          //       text: eachMemberText,
          //     },
          //   }
          // );

          /*
        cannot have more than 50 blocks
        eachMember.forEach((m) => {
          blocks.push(
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: m,
              },
            },
            {
              type: "divider",
            }
          );
        });
        */

          const eachMemberText = eachMember.join('\n')
          Logger.log('kudosR:', eachMemberText)
          const summaryMsg = await say({ blocks, text: texts.join('\n\n') })
          Logger.log('kudosRdetail')
          try {
            await say({ text: eachMemberText, thread_ts: summaryMsg.ts })
            Logger.log('kudosRdetailDone')
          } catch (e) {
            Logger.log('kudosRbreak:', e)
            const chucks = splitArrayIntoChunks(eachMember, 20)
            for (const chunk of chucks)
              await say({ text: chunk.join('\n\n'), thread_ts: summaryMsg.ts })
          }
          return
        }
        if (cmd.set) {
          const result = await storeTeamCustoms(
            cmd.set,
            team,
            myUserID,
            AT,
            isCoin ? 'coins' : 'kudos'
          )
          return say(result)
        }
      }
      Logger.log('kudos2')
      const viewId = await openDraftView(
        ACK,
        client,
        body,
        `${isCoin ? `Coins` : `Kudos`} form...`
      )
      Logger.log('kudos3')
      if (!viewId) return
      const result = await client.views.update(
        await getKudosView(viewId, team, myUserID, channel, isCoin)
      )
      Logger.log('kudos4')
    } catch (error) {
      Logger.error(error)
    }
  }
)
async function storeTeamCustoms(set, team, myUserID, AT, objName) {

    await workflows.setSettings(team, objName, myUserID, set, AT)
    return `:white_check_mark: ${objName}:\n${set.join(' is set to ')}.`
}
/**
 * returns {[coins|kudos]:{AT:number,f:string,v:Object}}
 * @param {*} team
 * @returns {Promise<{[key:string]:{AT:number,f:string,v:Object}}>}
 */
async function getTeamCustoms(team) {
  return workflows.getSettings(team)
}
function getUserNamesfromString(str = '@val1, @val2, @val3') {
  const regex = /@(\w+)/g

  // `matches` will contain an array of all matches.
  // Since we're using a capturing group, we need to further process the matches if we want only the name without the @
  const matches = str.match(regex)

  // If you want to extract values without @
  const values = []

  str.replace(regex, function (match, value) {
    values.push(value)
  })
  Logger.log('getUserNamesfromString:', str, values)

  return values
}
app.command(
  APP_CONFIG.funcs.pick.cmd,
  async ({ command, client, respond, ack, body, logger, say }) => {
    const AT = Date.now(),
      myUserID = body.user_id,
      team = body.team_id,
      channel = body.channel_id,
      trigger_id = body.trigger_id
    try {
      Logger.log('pick0:' + command.text)
      const ACK = ACKFN(respond, ack)
      Logger.log('pick1')
      const cmd = await getCommands(client, myUserID, command.text, trigger_id)
      if (cmd === true) return
      /**
       * @type {string[]}
       */
      const prompt = cmd.prompt
      Logger.log(`pick2${prompt ? `:${JSON.stringify(prompt)}` : ''}`)
      const viewId =
        prompt || (await openDraftView(ACK, client, body, 'pick form...'))
      Logger.log('pick3')
      if (!viewId) return
      const users = await getConversationUsers(client, channel, team, AT)
      Logger.log('pick4')
      // Logger.log("modal:users:", users);
      const initial_users = FAST
        ? users
        : users
        ? users.map((u) => u.id)
        : undefined
      if (initial_users?.length > 1) {
        if (prompt) {
          //say the result
          const values = {
            from: initial_users,
            num: 1,
            options: []
          }
          for (const val of prompt) {
            if (val == 'q') {
              values.options.push('q')
              continue
            } else if (val.includes('=')) {
              const [k, v] = val.split('=')
              if (k == 'n') {
                values.num = safeParseInt(v)
              } else if (k == 'i') {
                //include
                values.from = getUserNamesfromString(v)
              } else if (k == 'e') {
                //exclude
                const exclude = getUserNamesfromString(v)
                values.from = _.difference(initial_users, exclude)
              } else if (k == 'm') {
                //message
                values.for = v
              }
              continue
            }
          }
          return processPick(values, channel, team, myUserID, AT, client)
        } else {
          await client.views.update(
            getPickView(viewId, channel, myUserID, initial_users)
          )
        }
        Logger.log('modal:body:updated:', body.channel_id)
      } else {
        if (prompt)
          await say({
            text: ':pensive: channel needs to have at least 2 memebrs to be able to pick from.'
          })
        else
          await client.views.update({
            view_id: viewId,
            view: {
              type: 'modal',
              private_metadata: channel,
              close: {
                type: 'plain_text',
                text: 'Close',
                emoji: true
              },
              title: {
                type: 'plain_text',
                text: 'Not enough members',
                emoji: true
              },
              blocks: [
                {
                  block_id: 'top',
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: ':pensive: channel needs to have at least 2 memebrs to be able to pick from.'
                  }
                }
              ]
            }
          })
      }
      Logger.log('pick5')
    } catch (error) {
      Logger.error(
        `error cmd: triggerid=${trigger_id} userID=${myUserID}:`,
        error?.message,
        error?.data,
        error
      )
    }
  }
)
app.view(
  APP_CONFIG.funcs.sync.back,
  async ({ body, ack, payload, client, logger, view }) => {
    // Acknowledge the action
    await ack()
    const channel = view.private_metadata,
      myUserID = body.user.id,
      team = body.team.id,
      viewId = view.id
    try {
      Logger.log(`syncBack0:myUserID=${myUserID}`)
      const values = extractValues(view.state.values)
      if (values.k && !values.k?.length) delete values.k
      const AT = Date.now()
      let cts
      const dailySynced = await loadDailyState(team, channel)
      let oldTs, myLastTS
      if (dailySynced) {
        oldTs = dailySynced
        myLastTS =
          (oldTs.u && oldTs.u[myUserID]) || //happens only for the new sync thread
          (oldTs.last?.u && oldTs.last.u[myUserID]) //happens after shifting everything to the last
        if (isNewSync(oldTs.AT, AT)) {
        } else {
          cts = oldTs.ts
          if (myLastTS && oldTs.u && oldTs.u[myUserID]) {
            //this means the user already submitted
            Logger.log(
              `sync back second submittion:myUserID=${myUserID}`,
              values
            )
            const result = await client.views.update(
              getSyncView(viewId, myUserID, channel)
            )
            return
          }
        }
      }
      if (!cts) {
        const cth = await client.chat.postMessage({
          channel,
          text: `sync`
        })
        cts = cth.ts
        const channelTS = { ts: cts, AT }
        if (oldTs) {
          channelTS.last = { ...oldTs }
          delete channelTS.last.last
        }
        await workflows.saveThread(team, channel, cts, AT)
      }
      Logger.log(`syncBack1:myUserID=${myUserID}`, values)
      let myLastSync,
        mood = values.m,
        promised
      if (myLastTS) {
        const result = await loadStandup(team, channel, myLastTS)
        if (result) {
          myLastSync = result
          if (myLastSync?.values) {
            if (myLastSync.values.m != mood)
              mood = `${myLastSync.values.m} => ${mood}`
            promised = myLastSync.values.t
          }
        }
      }
      // const lastSync = await db.collection("sync").doc(team).collection("c").doc(channel).collection(myUserID).orderBy("AT", "desc").limit(1).get();

      const blocks = []
      blocks.push(
        {
          type: 'section',
          block_id: 'm',
          text: {
            type: 'mrkdwn',
            text: `${getMention(myUserID)} ${mood}`
          }
        },
        {
          type: 'divider'
        }
      )
      if (promised) {
        blocks.push(
          {
            type: 'context',
            elements: [
              {
                type: 'plain_text',
                text: 'Promised',
                emoji: true
              }
            ]
          },
          {
            type: 'section',
            block_id: 'p',
            text: {
              type: 'mrkdwn',
              text: promised
            }
          }
        )
      }
      blocks.push(
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'Lastday',
              emoji: true
            }
          ]
        },
        {
          type: 'section',
          block_id: 'l',
          text: {
            type: 'mrkdwn',
            text: values.l
          }
        }
      )
      blocks.push(
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'Today',
              emoji: true
            }
          ]
        },
        {
          type: 'section',
          block_id: 't',
          text: {
            type: 'mrkdwn',
            text: values.t
          }
        }
      )
      if (values.b) {
        blocks.push(
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'plain_text',
                text: 'Blocker',
                emoji: true
              }
            ]
          },
          {
            type: 'section',
            block_id: 'b',
            text: {
              type: 'mrkdwn',
              text: values.b
            }
          }
        )
      }
      if (values.k) {
        blocks.push(
          {
            type: 'divider'
          },
          {
            type: 'context',
            elements: [
              {
                type: 'plain_text',
                text: 'Kudos :tada:',
                emoji: true
              }
            ]
          },
          {
            type: 'section',
            block_id: 'k',
            text: {
              type: 'mrkdwn',
              text: getUsersStr(values.k)
            }
          }
        )
        if (values.kr?.length)
          blocks.push(
            {
              type: 'context',
              elements: [
                {
                  type: 'plain_text',
                  text: 'Kudos because of',
                  emoji: true
                }
              ]
            },
            {
              type: 'section',
              block_id: 'kr',
              text: {
                type: 'mrkdwn',
                text: values.kr
              }
            }
          )
      }
      Logger.log(`syncBack2:myUserID=${myUserID}`)
      const th = await client.chat.postMessage({
        // token: USER_TOKEN,
        channel,
        thread_ts: cts,
        // as_user: true,
        text: `${getMention(myUserID)} sync:${values.t}`,
        blocks
      })
      Logger.log(`syncBack3:myUserID=${myUserID}`)

        const url = await client.chat.getPermalink({ message_ts: th.ts, channel })
        await workflows.saveStandup({ team, channel, user: myUserID, ts: th.ts, cts, values, AT, link: url.permalink })
        await rituals.recordLegacy(team, channel, myUserID, values).catch(() => Logger.error('Ritual check-in mirror failed'))
        for (const recipient of values.k || [])
          await rituals.recognize(team, channel, myUserID, recipient, values.kr, th.ts).catch(() => Logger.error('Ritual recognition mirror failed'))
        return
    } catch (e) {
      Logger.error(e)

    }
  }
)
app.view(
  APP_CONFIG.funcs.sync.backUpdate,
  async ({ body, ack, payload, client, logger, view }) => {
    // Acknowledge the action
    await ack()
    const channel = view.private_metadata,
      myUserID = body.user.id,
      team = body.team.id
    const values = extractValues(view.state.values)
    const AT = Date.now()
    let cts
    const dailySynced = await loadDailyState(team, channel)
    let oldTs, myLastTS
    if (dailySynced) {
      oldTs = dailySynced
      // if (isNewSync(oldTs.AT, AT)) {
      if (oldTs.u && oldTs.u[myUserID]) myLastTS = oldTs.u[myUserID]
      // } else {
      // cts = oldTs.ts;
      // }
    }
    if (!myLastTS) {
      Logger.error(`no previous TS to update`, myUserID, values)
      return
    }
    Logger.log(`submitted backUpdate`, myUserID, values)
    let myLastSync,
      mood = values.m,
      promised
    const result = await loadStandup(team, channel, myLastTS)
    if (result) {
      myLastSync = result
      if (myLastSync?.values) {
        mood = `${myLastSync.values.m} => ${mood}`
        promised = myLastSync.values.t
      }
    }

    const th = await client.chat.update({
      // token: USER_TOKEN,
      channel,
      thread_ts: cts,
      // as_user: true,
      // text: `${getMention(myUserID)} sync update`,
      blocks: [
        {
          type: 'section',
          block_id: 'u',
          text: {
            type: 'mrkdwn',
            text: `${getMention(myUserID)} ${mood}`
          }
        }
      ]
    })
    // await db
    //   .collection("stat")
    //   .doc(team)
    //   .collection("sc")
    //   .doc(channel)
    //   .set({ u: { [myUserID]: th.ts } }, { merge: true });
    // const url = await client.chat.getPermalink({
    //   message_ts: th.ts,
    //   channel,
    // });
    // await db.collection("sync").doc(team).collection(channel).doc(th.ts).set({
    //   // ch: channel,
    //   f: myUserID,
    //   values,
    //   cts,
    //   AT,
    //   link: url.permalink,
    // });
    // const ctsStat = { m: { [values.m]: FieldValue.arrayUnion(myUserID) }, AT };
    // const uStat = { all: FieldValue.increment(1), [channel]: FieldValue.increment(1), AT };
    // if (values.k?.length) {
    //   await storeKudos(values, team, channel, myUserID, th.ts, AT, url.permalink, cts);
    // }
    // await db.collection("statc").doc(team).collection(channel).doc(cts).set(ctsStat, { merge: true });
    // await db.collection("stat").doc(team).collection("sync").doc(myUserID).set(uStat, { merge: true });
  }
)
app.view(
  APP_CONFIG.funcs.kudos.back,
  async ({ body, ack, payload, client, logger, view }) => {
    // Acknowledge the action
    await ack()
    const privateMetadata = view.private_metadata.split('//') //`${isCoin ? 'C' : 'K'}//${emoji}//${channel_id}`
    const isCoin = privateMetadata[0] == 'C'
    const emoji = privateMetadata[1]
    const channel = privateMetadata[2]
    const title = isCoin ? `Coins` : `Kudos`
    const myUserID = body.user.id,
      team = body.team.id
    const values = extractValues(view.state.values)
    if (values.k && !values.k?.length) return
    const AT = Date.now()
    const blocks = []
    blocks.push({
      type: 'section',
      block_id: 'm',
      text: {
        type: 'mrkdwn',
        text: `${emoji} ${title} from <@${myUserID}>`
      }
    })
    blocks.push(
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'to',
            emoji: true
          }
        ]
      },
      {
        type: 'section',
        block_id: 'k',
        text: {
          type: 'mrkdwn',
          text: getUsersStr(values.k)
        }
      }
    )
    if (values.kr?.length)
      blocks.push(
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'for',
              emoji: true
            }
          ]
        },
        {
          type: 'section',
          block_id: 'kr',
          text: {
            type: 'mrkdwn',
            text: values.kr
          }
        }
      )
    const th = await client.chat.postMessage({
      // token: USER_TOKEN,
      // as_user: true,
      channel,
      text: `${emoji} ${title} to ${getUsersStr(
        values.k
      )} from <@${myUserID}> for ${values.kr}`,
      blocks
    })
    const url = await client.chat.getPermalink({
      message_ts: th.ts,
      channel
    })

    await storeKudos(
      values,
      team,
      channel,
      myUserID,
      th.ts,
      AT,
      url.permalink,
      false,
      isCoin
    )
  }
)

// Listens to incoming messages that contain "felan"
app.message('felan', async ({ message, say, client, body, logger }) => {
  // say() sends a message to the channel where the event was triggered
  await say(`be Salaamat, <@${message.user}> :wave:`)
  Logger.log('user:', message.user)
})

function getMention(u) {
  return `<@${u}>`
}
function getUsersStr(users) {
  return users.map((u) => getMention(u)).join(', ')
}
function getData(arr) {
  return arr.map((d) => d.data())
}
async function loadDailyState(team, channel) {
  return workflows.getDailyState(team, channel)
}
async function loadStandup(team, channel, ts) {
  return workflows.getStandup(team, channel, ts)
}
async function getSyncs(team, channel, days, AT) {
  const since = AT - days * 24 * 3600 * 1000
  return workflows.getStandups(team, channel, since)
}
async function getKudos(team, days, AT) {
  const since = AT - days * 24 * 3600 * 1000
  return workflows.getRecognition(team, since)
}
async function storeKudos(
  values,
  team,
  channel,
  from,
  ts,
  AT,
  link,
  cts = false,
  isCoin = false
) {
  await workflows.saveRecognition({ team, channel, from, recipients: values.k, ts, AT, link, cts, kind: isCoin ? 'coin' : 'kudos', reason: values.kr })
  for (const recipient of values.k)
    await rituals.recognize(team, channel, from, recipient, values.kr, ts).catch(() => Logger.error('Ritual recognition mirror failed'))
}

// async function addTimezoneContext({ payload, client, context, next }) {
//   const user = await client.users.info({
//     user: payload.user_id,
//     include_locale: true
//   });

//   // Add user's timezone context
//   context.tz_offset = user.tz_offset;

//   // Pass control to the next middleware function
//   await next();
// }
function randomPickArray(array, remove = true, num = 1) {
  if (!(num > 0) || !(array?.length > num)) return array
  const result = []
  const arr = remove ? array : [...array]
  while (arr.length && num--) {
    const index = Math.floor(Math.random() * arr.length)
    result.push(arr[index])
    arr.splice(index, 1)
  }
  return result
}

app.command(
  `/${GLOBAL_PREFIX}select`,
  async ({ command, ack, client, context, logger, say }) => {
    // Acknowledge command request
    await ack()
    // Get local hour of request
    let attempts = 0
    let what = 'standup'
    let txt = command.text
    const argv = parser(txt, { array: ['from', 'exclude'] })
    if (argv.for) what = argv.for
    // const forIndex = txt.indexOf(`for "`);
    // if (forIndex >= 0) {
    //   let sub = txt.substring(forIndex + 5);
    //   const to = sub.indexOf(`"`);
    //   what = sub.substring(0, to).trim();
    //   txt = txt.substring(0, forIndex) + txt.substring(forIndex + 5 + to);
    // }
    let saySTR = 'No one'
    let found

    if (argv.from) {
      found = randomPickArray(argv.from, false)[0]

      // const from = argv.from.indexOf("[") + 1;
      // let str = argv.from.substring(from, from + argv.from.lastIndexOf("]")).trim();
      // if (str.length > 0) {
      //   const arr = str
      //     .split(",")
      //     .map((x) => x.trim())
      //     .filter((x) => x.length > 0);
      //   found = randomPickArray(arr);
      // }
    } else {
      const members = await client.conversations.members({
        channel: command.channel_id
      })
      while (members?.members?.length) {
        const userID = randomPickArray(members.members)[0]
        const user = await client.users.info({ user: userID })
        attempts++
        if (user?.user?.is_bot) continue
        found = `@${user.user.name}`
        if (argv.exclude && argv.exclude.includes(found)) {
          found = undefined
          continue
        }
        break
      }
    }
    if (found) {
      saySTR = `${found?.startsWith('@') ? `<${found}>` : found} picked by <@${
        command.user_name
      }> for ${what}`
    }
    Logger.log(
      `channel[${command.channel_id}] user[${
        command.user_id
      }] found after ${attempts} attempts. argv=${JSON.stringify(argv)}`
    )
    await say(saySTR)

    /*
      // Request channel ID
      const requestChannel = "C12345";

      const requestText = `:large_blue_circle: *New request from <@${command.user_id}>*: ${command.text}`;

      // If request not inbetween 9AM and 5PM, send request tomorrow
      if (local_hour > 17 || local_hour < 9) {
        // Assume function exists to get local tomorrow 9AM from offset
        const local_tomorrow = getLocalTomorrow(context.tz_offset);

        try {
          // Schedule message
          const result = await client.chat.scheduleMessage({
            channel: requestChannel,
            text: requestText,
            post_at: local_tomorrow,
          });
        } catch (error) {
          Logger.error(error);
        }
      } else {
        try {
          // Post now
          const result = client.chat.postMessage({
            channel: requestChannel,
            text: requestText,
          });
        } catch (error) {
          Logger.error(error);
        }
      }
       */
  }
)

/**
 *
 * @param {WebClient} client
 * @param {string} channelId
 * @returns
 */
async function updateConversationUsers(
  client,
  channelId,
  team,
  usersAT,
  AT,
  exists
) {
  const isRecent = usersAT > AT - 10 * 3600 * 1000
  const tooOLD = usersAT < AT - 15 * 24 * 3600 * 1000
  Logger.log(
    `updateConversationUsers:AT:${AT} usersAT:${usersAT} isRecent:${isRecent} tooOLD:${tooOLD} exists:${exists}`
  )
  if (isRecent) return
  //it maybe old and needs update
  const users = []
  const conversation = { members: [] }
  const allUsers = { members: [] }
  let cursor
  do {
    const page = await client.conversations.members({ channel: channelId, limit: 200, ...(cursor ? { cursor } : {}) })
    conversation.members.push(...(page.members || []))
    cursor = page.response_metadata?.next_cursor
  } while (cursor)
  cursor = undefined
  do {
    const page = await client.users.list({ limit: 200, ...(cursor ? { cursor } : {}) })
    allUsers.members.push(...(page.members || []))
    cursor = page.response_metadata?.next_cursor
  } while (cursor)
  const usersObj = {},
    bots = {}
  for (const user of allUsers.members) {
    if (!user.id) continue
    // if (tooOLD)
    //   db.collection("info")
    //     .doc(team)
    //     .collection("u")
    //     .doc(user.id)
    //     .set({ ...user, usersAT }, { merge: true });
    if (conversation.members.includes(user.id)) {
      if (user.is_bot) bots[user.id] = true
      else {
        users.push(user)
        usersObj[user.id] = true
      }
    }
  }
  const toUpdate = { users: usersObj, bots, usersAT: Date.now() }

    await workflows.saveMembership(team, channelId, usersObj, bots, toUpdate.usersAT)
    return users
}

/**
 *
 * @param {WebClient} client
 * @param {string} channelId
 * @returns
 */
async function getConversationUsers(client, channelId, team, AT) {
  if (!channelId?.length) return

    const data = await workflows.getMembership(team, channelId)
    if (data && data.usersAT > AT - 10 * 3600 * 1000) return Object.keys(data.users)
    if (data) return (await updateConversationUsers(client, channelId, team, data.usersAT, AT, true))?.map(user => user.id) || []
    return (await updateConversationUsers(client, channelId, team, 0, AT, false))?.map(user => user.id) || []
}

app.view(
  APP_CONFIG.funcs.pick.back,
  async ({ body, ack, context, client, logger, view }) => {
    // Acknowledge the action
    await ack()
    //AT ~= FieldValue.serverTimestamp()
    const channel = view.private_metadata
    const AT = Date.now(),
      myUserID = body.user.id,
      team = body.team.id
    const values = extractValues(view.state.values)
    Logger.log(`submitted body`, values)
    return processPick(values, channel, team, myUserID, AT, client)
  }
)

const work = {
  steps: [
    {
      type: 'message',
      id: '5e663b41-f077-4fac-a760-be2b552ec9be',
      config: {
        user: { ref: '055a49d3-e7b3-4e04-9a25-53c7efba7538==user' },
        has_button: true,
        button_label: 'Start ▶️',
        message_text:
          'Hey {{055a49d3-e7b3-4e04-9a25-53c7efba7538==user}}! :wave:\nOur team is keen to learn about your activities:runner: /feelings:innocent: in <#C03MNS9KLQL>!',
        message_blocks: [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { text: 'Hey ', type: 'text' },
                  {
                    id: '055a49d3-e7b3-4e04-9a25-53c7efba7538==user',
                    type: 'workflowtoken',
                    property: '',
                    data_type: 'user'
                  },
                  { text: '! ', type: 'text' },
                  { name: 'wave', type: 'emoji', unicode: '1f44b' },
                  {
                    text: '\nOur team is keen to learn about your activities',
                    type: 'text'
                  },
                  { name: 'runner', type: 'emoji', unicode: '1f3c3' },
                  { text: ' /feelings', type: 'text' },
                  { name: 'innocent', type: 'emoji', unicode: '1f607' },
                  { text: ' in ', type: 'text' },
                  { type: 'channel', channel_id: 'C03MNS9KLQL' },
                  { text: '!', type: 'text' }
                ]
              }
            ]
          }
        ]
      }
    },
    {
      type: 'dialog',
      id: '5a5d5947-3602-4874-989a-5cd94166b65d',
      config: {
        user: { ref: '5e663b41-f077-4fac-a760-be2b552ec9be==user_clicked' },
        dialog_title: 'Gogh Daily Standup',
        dialog_elements: [
          {
            name: 'a08b74ac-b20e-4232-92ff-994851f994ae',
            type: 'select',
            label: 'Feeling ',
            options: [
              { label: '🤒', value: '🤒' },
              { label: '😪', value: '😪' },
              { label: '😡', value: '😡' },
              { label: '🙁', value: '🙁' },
              { label: '😐', value: '😐' },
              { label: '🙂', value: '🙂' },
              { label: '😃', value: '😃' },
              { label: '🤪', value: '🤪' },
              { label: '🧐', value: '🧐' }
            ],
            optional: false,
            data_source: 'static'
          },
          {
            name: 'be1e3c65-d73f-46dd-b15c-f19083fcfdb2',
            type: 'textarea',
            label: 'Did last day',
            optional: false
          },
          {
            name: '6e362a42-5686-4d06-9d07-88892c246ac1',
            type: 'textarea',
            label: 'Will do today',
            optional: false
          },
          {
            name: 'a193c7f1-0621-451d-8f38-a12ce016b2c5',
            type: 'textarea',
            label: 'Blockers?',
            optional: true
          },
          {
            name: 'a811e945-5433-4289-956f-c32da13e747f',
            type: 'select',
            label: 'Kudos 🎉?',
            optional: true,
            data_source: 'users'
          }
        ],
        results_channel: { value: 'C03MNS9KLQL' },
        dialog_submit_label: '',
        delivery_button_label: 'Open Form',
        delivery_message_text:
          'Hello! To get started, please fill out this form.'
      }
    },
    {
      type: 'message',
      id: 'a44900d1-72f6-4083-8535-d1ebcc38239c',
      config: {
        user: {
          ref: '5a5d5947-3602-4874-989a-5cd94166b65d==user_submitted'
        },
        has_button: false,
        message_text: 'Have a productive day :facepunch:',
        message_blocks: [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { text: 'Have a productive day ', type: 'text' },
                  { name: 'facepunch', type: 'emoji', unicode: '1f44a' }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}

function safeParseInt(str) {
  try {
    const num = Number.parseInt(str)
    return num
  } catch (e) {}
  return
}

/**
 *
 * @param {WebClient} client
 * @param {string} command
 * @returns {object|boolean} true: if no need for further processing, false: if a wrong command, otherwise an object with the command
 */
async function getCommands(client, userID, command, trigger_id) {
  const result = {}
  const argv = parser(
    command
    //, { array: ['prompt', 'p'] }
  )
  if (argv.h || argv.help) {
    await client.views.open(getHelpView(trigger_id))
    return true
  } else if (argv.r || argv.report) {
    const report = safeParseInt(argv.r || argv.report)
    if (report > 0) {
      const userInfo = await client.users.info({ user: userID })
      if (
        report <= 30 &&
        userInfo.user &&
        (userInfo.user.is_admin || userInfo.user.is_owner)
      ) {
        result.report = report
      } else {
        if (report > 30)
          return `<@${userID}> report can be asked for the last 30 days at most.`
        return `<@${userID}> report can be asked by an admin/owner.`
      }
    } else
      return `<@${userID}> please append a number between 0 and 30 after the report, e.g. -r 14`
  } else if (argv.p || argv.prompt) {
    // apply the command without openning a view
    let promptArray = argv.p || argv.prompt
    if (!promptArray || promptArray === true) {
      promptArray = []
    } else if (typeof promptArray === 'string') {
      promptArray = [promptArray]
    }
    result.prompt = promptArray
  } else if (argv.s || argv.set) {
    const setStr = argv.s || argv.set
    const set = setStr.split('=')
    if (set.length == 2) {
      const userInfo = await client.users.info({ user: userID })
      if (userInfo.user && (userInfo.user.is_admin || userInfo.user.is_owner)) {
        result.set = set
      } else {
        return `<@${userID}> settings can be modified by an admin/owner.`
      }
    } else return `<@${userID}> please append for example \`-s emoji=:tada:\``
  }
  return Object.keys(result).length ? result : false
}

function getSyncView(view_id, userID, channel_id, lastSync, isNew) {
  if (!view_id)
    throw `no viewID sync userID:${userID} channel_id:${channel_id} isNew:${isNew}`
  const blocks = []
  /**
   * @type {ViewsUpdateArguments}
   */
  const view = {
    view_id,
    view: {
      type: 'modal',
      callback_id: isNew
        ? APP_CONFIG.funcs.sync.back
        : APP_CONFIG.funcs.sync.backUpdate,
      private_metadata: channel_id,
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true
      },
      title: {
        type: 'plain_text',
        text: 'Sync form',
        emoji: true
      },
      blocks
    }
  }
  if (!isNew) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:dart: <@${userID}> ${
          lastSync?.link
            ? `you already submitted your <${lastSync.link}|sync here>`
            : `your sync is already submitted`
        }`
      }
    })
    if (false) {
      //hard to retrive previous blocks for update message
      blocks.push({
        type: 'input',
        block_id: 'u',
        label: {
          type: 'plain_text',
          text: 'Updates/Fixes',
          emoji: true
        },
        element: {
          type: 'plain_text_input',
          action_id: 'input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'write what needs to be updated/fixed since your last submission...'
          }
        },
        optional: false
      })
      view.view.submit = {
        type: 'plain_text',
        text: 'Update',
        emoji: true
      }
    }
  } else {
    view.view.submit = {
      type: 'plain_text',
      text: 'Submit',
      emoji: true
    }
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:wave: <@${userID}> Please share yours${
            lastSync?.link
              ? `, this is your <${lastSync.link}|last submission>`
              : ''
          }`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'input',
        block_id: 'm',
        label: {
          type: 'plain_text',
          text: lastSync?.m
            ? `My mood was ${lastSync.m}, how about now?`
            : 'Mood',
          emoji: true
        },
        element: {
          type: 'static_select',
          action_id: 'input',
          placeholder: {
            type: 'plain_text',
            text: 'Pick an Emoji',
            emoji: true
          },
          options: [
            {
              text: {
                type: 'plain_text',
                text: ':face_with_thermometer: Sick',
                emoji: true
              },
              value: ':face_with_thermometer:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':sleepy: Sleepy',
                emoji: true
              },
              value: ':sleepy:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':rage: Rage',
                emoji: true
              },
              value: ':rage:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':slightly_frowning_face: Sad',
                emoji: true
              },
              value: ':slightly_frowning_face:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':neutral_face: NULL',
                emoji: true
              },
              value: ':neutral_face:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':slightly_smiling_face: Happy',
                emoji: true
              },
              value: ':slightly_smiling_face:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':smiley: Excited',
                emoji: true
              },
              value: ':smiley:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':confused: Confused',
                emoji: true
              },
              value: ':confused:'
            },
            {
              text: {
                type: 'plain_text',
                text: ':face_with_monocle: Curious',
                emoji: true
              },
              value: ':face_with_monocle: Curious'
            }
          ]
        }
      }
    )
    if (lastSync?.t)
      blocks.push(
        {
          type: 'context',
          elements: [
            {
              type: 'plain_text',
              text: 'Promised',
              emoji: true
            }
          ]
        },
        {
          type: 'section',
          block_id: 'const_promised',
          text: {
            type: 'mrkdwn',
            text: lastSync.t
          }
        }
      )
    blocks.push(
      {
        type: 'input',
        block_id: 'l',
        label: {
          type: 'plain_text',
          text: 'Did last day',
          emoji: true
        },
        element: {
          type: 'plain_text_input',
          action_id: 'input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'write what you were working on your last working day...'
          }
        },
        optional: false
      },
      {
        type: 'input',
        block_id: 't',
        label: {
          type: 'plain_text',
          text: 'Will do today',
          emoji: true
        },
        element: {
          type: 'plain_text_input',
          action_id: 'input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'write what you will do today...'
          }
        },
        optional: false
      },
      {
        type: 'input',
        block_id: 'b',
        label: {
          type: 'plain_text',
          text: 'Blockers?',
          emoji: true
        },
        element: {
          type: 'plain_text_input',
          action_id: 'input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'write whatever that blocks you from proceeding today...'
          }
        },
        optional: true
      },
      {
        type: 'input',
        block_id: 'k',
        label: {
          type: 'plain_text',
          text: 'Kudos :tada:?',
          emoji: true
        },
        element: {
          type: 'multi_users_select',
          action_id: 'input'
        },
        optional: true
      },
      {
        type: 'input',
        block_id: 'kr',
        label: {
          type: 'plain_text',
          text: 'Why kudos?',
          emoji: true
        },
        element: {
          type: 'plain_text_input',
          action_id: 'input',
          multiline: true,
          placeholder: {
            type: 'plain_text',
            text: 'any further explanation on why kudosing???'
          }
        },
        optional: true
      }
    )
  }
  return view
}
async function getKudosView(view_id, team, userID, channel_id, isCoin = false) {
  if (!view_id)
    throw `no viewID kudos userID:${userID} channel_id:${channel_id} isNew:${isNew} isCoin:${isCoin}`
  const customs = await getTeamCustoms(team)
  const emoji = customs?.[isCoin ? 'coins' : 'kudos']?.v.emoji || ':tada:'
  const title = isCoin ? `Coins` : `Kudos`
  const blocks = []
  /**
   * @type {ViewsUpdateArguments}
   */
  const view = {
    view_id,
    view: {
      type: 'modal',
      callback_id: APP_CONFIG.funcs.kudos.back,
      private_metadata: `${isCoin ? 'C' : 'K'}//${emoji}//${channel_id}`,
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true
      },
      title: {
        type: 'plain_text',
        text: `${emoji} ${title}`,
        emoji: true
      },
      blocks
    }
  }
  view.view.submit = {
    type: 'plain_text',
    text: `Send ${emoji}`,
    emoji: true
  }
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `from <@${userID}>`
    }
  })
  blocks.push(
    {
      type: 'input',
      block_id: 'k',
      label: {
        type: 'plain_text',
        text: `${emoji} ${title} to`,
        emoji: true
      },
      element: {
        type: 'multi_users_select',
        action_id: 'input'
      },
      optional: false
    },
    {
      type: 'input',
      block_id: 'kr',
      label: {
        type: 'plain_text',
        text: 'Why?',
        emoji: true
      },
      element: {
        type: 'plain_text_input',
        action_id: 'input',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: `any further explanation on why ${title + 'ing'}???`
        }
      },
      optional: false
    }
  )
  return view
}
function getPickView(view_id, channel_id, userID, initial_users) {
  if (!view_id)
    throw `no viewID pick userID:${userID} channel_id:${channel_id} isNew:${isNew}`
  /**
   * @type {ViewsUpdateArguments}
   */
  const view = {
    view_id,
    view: {
      type: 'modal',
      callback_id: APP_CONFIG.funcs.pick.back,
      private_metadata: channel_id,
      submit: {
        type: 'plain_text',
        text: 'Pick',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true
      },
      title: {
        type: 'plain_text',
        text: 'Random Pick/Select',
        emoji: true
      },
      blocks: [
        {
          block_id: 'top',
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:wave: <@${userID}>`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'input',
          block_id: 'for',
          label: {
            type: 'plain_text',
            text: 'Pick for',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'input',
            multiline: false,
            placeholder: {
              type: 'plain_text',
              text: 'u may write any purpose or leave it blank'
            },
            initial_value: 'standup'
          },
          optional: true
        },
        {
          type: 'input',
          block_id: 'from',
          label: {
            type: 'plain_text',
            text: 'From',
            emoji: true
          },
          element: {
            type: 'multi_users_select',
            action_id: 'input',
            initial_users
          },
          optional: false
        },
        {
          type: 'divider'
        },
        {
          type: 'input',
          block_id: 'options',
          element: {
            action_id: 'input',
            type: 'checkboxes',
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: ':question: Ask a random Question',
                  emoji: true
                },
                value: 'q'
              }
            ]
          },
          label: {
            type: 'plain_text',
            text: 'Options',
            emoji: true
          },
          optional: true
        },
        {
          type: 'input',
          block_id: 'num',
          element: {
            action_id: 'input',
            type: 'number_input',
            is_decimal_allowed: false,
            initial_value: '1'
          },
          label: {
            type: 'plain_text',
            text: 'Number of people to select',
            emoji: true
          }
        }
      ]
    }
  }
  return view
}
/**
 * Processes the selection of users based on the provided values, sends a message to the specified channel, and optionally asks a random question.
 *
 * @param {Object} values - The values extracted from the modal submission, containing user selections and inputs.
 * The `values` object contains key-value pairs representing the user's selections and inputs from the modal. It includes:
 * - `from`: An array of user IDs from which selections are made. Example: `["U01ABCD2EFG", "U02HIJK3LMN"]`
 * - `num`: A string/number representing the number of people to select
 * - `for`: A string representing the reason for the selection. This is optional. Example: `"team meeting"`
 * - `options`: An array of strings representing additional options selected by the user. Example: `["q"]` where "q" stands for asking a random question.
 * @param {string} channel - The ID of the Slack channel where the message will be posted.
 * @param {string} team - The ID of the Slack team.
 * @param {string} myUserID - The ID of the user who initiated the process.
 * @param {number} AT - The timestamp of when the action was triggered.
 * @param {WebClient} client - The Slack WebClient instance used to interact with the Slack API.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */

async function processPick(values, channel, team, myUserID, AT, client) {
  Logger.log(`processPick`, { values, channel, myUserID, AT })
  if (!values?.from) return
  const NUM = safeParseInt(values.num)
  const selectedUsers = randomPickArray(values.from, false, NUM)
  Logger.log(`selected`, selectedUsers)
  if (!selectedUsers?.length) return
  const selectedUsersStr = getUsersStr(selectedUsers)
  const FOR = values.for?.length ? ` for \`${values.for}\`` : ''
  /**
   * @type {Parameters<WebClient["chat"]["postMessage"]>[0]}
   */
  const message = {
    channel,
    text: `${selectedUsersStr} picked${FOR} by <@${myUserID}>`
  }
  let Question
  const proofBlocks = [
    {
      type: 'context',
      elements: [
        {
          type: 'plain_text',
          text: `picked from the following list of [${values.from.length}] users`,
          emoji: true
        }
      ]
    },
    {
      type: 'section',
      block_id: 'list',
      text: {
        type: 'mrkdwn',
        text: getUsersStr(values.from)
      }
    }
  ]
  if (values.options?.includes('q')) {
    Question = randomPickArray(QUESTIONS, false)[0]
    message.text += ` and asked ${Question}`
    const blocks = []
    blocks.push(
      {
        type: 'section',
        block_id: 'm',
        text: {
          type: 'mrkdwn',
          text: `${selectedUsersStr} picked${FOR} by <@${myUserID}>.`
        }
      },
      {
        type: 'section',
        block_id: 't',
        text: {
          type: 'mrkdwn',
          text: `:question: ${selectedUsersStr} pls also answer this Random Question`
        }
      },
      {
        type: 'section',
        block_id: 'q',
        text: {
          type: 'mrkdwn',
          text: Question
        }
      }
    )
    message.blocks = blocks
  }
  const th = await client.chat.postMessage(message)
  await client.chat.postMessage({
    channel,
    thread_ts: th.ts,
    text: `picked from [${values.from.length}] users`,
    blocks: proofBlocks
  })
  return workflows.savePick({ team, channel, user: myUserID, selected: selectedUsers, candidates: values.from, purpose: values.for, question: Question, count: NUM > 0 ? NUM : selectedUsers.length, ts: th.ts, AT })
}

function getHelpView(trigger_id) {
  /**
   * @type {ViewsOpenArguments}
   */
  const view = {
    trigger_id,
    view: {
      type: 'modal',
      // private_metadata: channel_id,
      close: {
        type: 'plain_text',
        text: 'Close',
        emoji: true
      },
      title: {
        type: 'plain_text',
        text: 'Help',
        emoji: true
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "Kick is here to boost the team's productivity, not to mention this is exactly the mission and vision of `kick`\nHere you can in short see the list of existing features:"
          }
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':calendar: Sync',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "For recurring meetings, this command is to collect everyone's update\n• `/sync`: to collect\n• `/sync -r 7`: to get the report of the last 7 days of the team. 7 can be replaced by any number within [1,30]"
          }
        },
        {
          type: 'divider'
        },

        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':tada: Kudos',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'To send thanks/kudos to some member in order to appreciate them appropriately:\n• `/kudos`: to submit your token of appreciation\n• `/kudos -r 7`: to get the report of the last 7 days of the team. 7 can be replaced by any number within [1,30]'
          }
        },
        {
          type: 'divider'
        },

        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':diamonds: Coins',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'To send coins to some member:\n• `/coins`: to send coin\n• `/coins -r 7`: to get the report of the last 7 days of the team. 7 can be replaced by any number within [1,30]'
          }
        },
        {
          type: 'divider'
        },

        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':fireworks: Pick',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `To randomly selecting/picking/choosing a member [and if you will ask a random :question: question]:\n•\`/pick\`: to help you randomly select member(s).
            you can also use prompt mode (\`/pick -p\`) to instantly pick without opening any modal. This is specially useful for scheduling.
            options for prompt mode are m,n,i,e,q
            • m is for message to add for pick: \`/pick -p m="team meeting"\`: to help you randomly select member(s) for a specific purpose.
            • n is for number of people to pick: \`/pick -p n=3\`: to help you randomly select 3 members.
            • i is for include: \`/pick -p i=user1,user2,user3\`: selecting only from user1,user2 and user3.
            • e is for exclude: \`/pick -p e=user1,user2,user3\`: excluding user1,user2 and user3.
            • q is for question: \`/pick -p q\`: randomly asking a question.
            you can combine multiple options for the prompt by \`-p m="team meeting" -p n=3 -p i=user1,user2,user3 -p q\`
            `
          }
        }
      ]
    }
  }
  return view
}
//:face_with_thermometer::sleepy::rage::slightly_frowning_face::neutral_face::slightly_smiling_face::smiley::zany_face::face_with_monocle:

const QUESTIONS = [
  'Who is your hero?',
  'If you could live anywhere, where would it be?',
  'What is your biggest fear?',
  'What is your favorite vacation?',
  'What would you change about yourself if you could?',
  'What really makes you angry?',
  'What motivates you to work hard?',
  'What is your favorite thing about your career?',
  'What is your biggest complaint about your job?',
  'What is your proudest accomplishment?',
  'What is your favorite book to read?',
  'What makes you laugh the most?',
  'What was the last movie you went to? What did you think?',
  'What did you want to be when you were small?',
  'If you could choose to do anything for a day, what would it be?',
  'What is your favorite game or sport to watch and play?',
  'Would you rather ride a bike, ride a horse, or drive a car?',
  'What would you sing at Karaoke night?',
  'Which would you rather do: wash dishes, clean the bathroom, or vacuum the house?',
  'If you could hire someone to help you, would it be with cleaning, cooking, or yard work?',
  'If you could only eat one meal for the rest of your life, what would it be?',
  'Who is your favorite author?',
  'Have you ever had a nickname? What is it?',
  'Do you like or dislike surprises? Why or why not?',
  'In the evening, would you rather play a game, visit a relative, watch a movie, or read?',
  'Would you rather vacation in Hawaii or Alaska, and why?',
  'Would you rather win the lottery or work at the perfect job? And why?',
  'Who would you want to be stranded with on a deserted island?',
  'If money was no object, what would you do all day?',
  'If you could go back in time, what year would you travel to?',
  'How would your friends describe you?',
  'What are your hobbies?',
  'What is the best gift you have been given?',
  'What is the worst gift you have received?',
  'Aside from necessities, what one thing could you not go a day without?',
  'List two pet peeves.',
  'Where do you see yourself in five years?',
  'How many pairs of shoes do you own?',
  'If you were a super-hero, what powers would you have?',
  'What would you do if you won the lottery?',
  'What form of public transportation do you prefer? (air, boat, train, bus, car, etc.)',
  "What's your favorite zoo animal?",
  'If you could go back in time to change one thing, what would it be?',
  'If you could share a meal with any 4 individuals, living or dead, who would they be?',
  "What's the longest you've gone without sleep (and why)?",
  "What's the tallest building you've been to the top in?",
  'Would you rather trade intelligence for looks or looks for intelligence?',
  'How often do you buy clothes?',
  'Have you ever had a secret admirer?',
  "What's your favorite holiday?",
  "What's the most daring thing you've ever done?",
  "What's your favorite type of foreign food?",
  'Are you a clean or messy person?',
  'Who would you want to play you in a movie of your life?',
  'How long does it take you to get ready in the morning?',
  'What kitchen appliance do you use every day?',
  "What's your favorite fast food chain?",
  'Do you love or hate rollercoasters?',
  'What is your favorite childhood memory?',
  "What's your favorite movie?",
  'What three items would you take with you on a deserted island?',
  'What was your favorite subject in school?',
  "What's the most unusual thing you've ever eaten?",
  'Do you collect anything?',
  'Is there anything you wished would come back into fashion?',
  'Are you an introvert or an extrovert?',
  'Are you related or distantly related to anyone famous?',
  'What do you do to keep fit?',
  'If you were ruler of your own country what would be the first law you would introduce?',
  'Who was your favorite teacher in school and why?',
  'What three things do you think of the most each day?',
  'If you had a warning label, what would yours say?',
  'What song would you say best sums you up?',
  'What celebrity would you like to meet for a cup of coffee?',
  "What's the most interesting thing you can see out of your office or kitchen window?",
  'On a scale of 1-10 how funny would you say you are?',
  'Where do you see yourself in 10 years?',
  'If you could join any past or current music group which would you want to join?',
  'How many languages do you speak?',
  'Who is the most intelligent person you know?',
  'If you had to describe yourself as an animal, which one would it be?',
  'What is one thing you will never do again?',
  'How would you describe your approach to problem-solving?',
  'Can you share an example of a time when you had to work under pressure?',
  'How would you describe your work style or method of working?',
  'Can you describe a time when you had to adapt to a new situation or challenge at work?',
  'How do you handle stressful or difficult situations?',
  'How do you handle feedback or criticism in a professional setting?',
  'How do you approach continuing your professional development and learning new skills?',
  'How do you approach conflict resolution in a professional setting?',
  'How do you stay organized and keep track of your responsibilities?',
  'Can you describe a time when you had to go above and beyond in your work to achieve a goal?',
  'How do you handle working with a team or group when there are different opinions or ideas?',
  'Can you describe a time when you had to take initiative in your work?',
  'How do you stay motivated and maintain a positive attitude?',
  'How do you approach working with individuals from diverse backgrounds or perspectives?',
  'How do you stay current with industry trends and advancements?',
  'How do you handle working with limited information or data?'
]

const { createStore } = require('./rituals/store')
const { createEngine } = require('./rituals/engine')
const { registerRituals } = require('./rituals/slack')
const ritualStore = createStore(postgres)
const rituals = createEngine(ritualStore, async (team) => {
  const installation = await postgresInstallations.fetchInstallation({ teamId: team, isEnterpriseInstall: false });
  if (!installation.bot?.token) throw new Error('installation_missing');
  return new WebClient(installation.bot.token, { retryConfig: { retries: 0 }, timeout: 10000 });
}, Date.now, { dmEnabled: process.env.KICK_RITUALS_DM_ENABLED === 'true' });
if (rituals) registerRituals(app, ritualStore, rituals)

module.exports = {
  handler: expressReceiver.app,
  rituals,
  isConfigured: missingEnv.length === 0,
  missingEnv
}
