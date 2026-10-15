const { commands, parseCommand } = require('./command-catalog')
const { escape } = require('./domain')

function registerCommands({ app, store, member, tools, ui, modalClient, background, test = !!process.env.TEST }) {
  const { modal, section, context, button, select, option, read } = ui
  const cmd = name => `/${test ? 't' : ''}${name}`
  function help(name, invalid = false) {
    const entry = commands.find(c => c.name === name)
    return modal('Kick command guide', 'kick_command_read', '', [
      section(`${invalid ? 'That option is not supported. Nothing was changed.\n\n' : ''}*${cmd(name)}* — ${entry.description}\n\`${cmd(name)} ${entry.usage}\``),
      context('Opening a form saves nothing. Review its visibility notice and submit to save or share. Team tools require membership in a public channel and a Kick workflow.'),
      ...commands.filter(c => c.name !== name).map(c => section(`*${cmd(c.name)}* — ${c.description}\n\`${cmd(c.name)} help\``)),
      section('Personal to-dos need no workflow. For shared tools, create a paused workflow with `' + cmd('sync') + ' setup`. If a command is unavailable or belongs to another app, use Kick Home instead.'),
    ], null)
  }
  function failure() {
    return modal('Unable to open tool', 'kick_command_read', '', [section('Check that you still belong to this public channel and that its Kick workflow exists. Reopen the command to try again. You can also use Kick Home or contact kick.bot.help@gmail.com. Nothing was submitted by this command.')], null)
  }
  async function show(client, body, parsed, selected) {
    if (parsed.help) return help(parsed.name, parsed.invalid)
    const personal = parsed.tool === 'work' && ['todos', 'new_todo'].includes(parsed.action)
    let config
    if (!personal) {
      await member(client, body.channel_id, body.user_id)
      // Fetch only this channel; filter workspace before showing any names.
      const configs = (await store.list('configs', 'channel', '==', body.channel_id, 100)).filter(c => c.team === body.team_id)
      if (!configs.length) return modal('Set up a workflow', 'kick_command_read', '', [section(`This public channel has no Kick workflow yet. Run \`${cmd('sync')} setup\` and save it as Paused. You can use team tools without turning on scheduled messages.`)], null)
      if (selected) config = configs.find(c => c.id === selected)
      else if (configs.length === 1) config = configs[0]
      else return modal('Choose a workflow', 'kick_command_choose', JSON.stringify({ name: parsed.name, sub: body.text, channel: body.channel_id }), [
        section('Choose where to work. No records or schedules will be changed by this selection.'),
        select('workflow', 'Workflow', configs.map(c => option(c.name.slice(0, 75), c.id)), configs[0].id),
      ], 'Continue')
      if (!config) throw new Error('Workflow unavailable')
    }
    const tool = tools[parsed.tool], ctx = { team: body.team_id, user: body.user_id, config: config?.id }
    const view = await tool.render((tool.apiFor || tool.service)(client), ctx, parsed.action, { ...parsed.data, c: config?.id }, client)
    // Consistent context without replacing any tool's privacy or retention notice.
    view.blocks.unshift(context(`Kick · ${cmd(parsed.name)}${config ? ` · ${config.name.slice(0, 80)}` : ' · Private to you'}`))
    return view
  }
  app.use(async args => {
    const parsed = parseCommand(args.body.command, args.body.text, test)
    if (!parsed) return args.next()
    await args.ack() // No database or Slack API work before acknowledgment.
    background(async () => {
      let client
      try {
        client = await modalClient(args.client, args.body.trigger_id)
        await client.views.open({ view: await show(client, args.body, parsed) })
      } catch {
        if (client) await client.views.open({ view: failure() })
        else if (args.respond) await args.respond({ response_type: 'ephemeral', text: `Kick couldn’t open the form. Run ${cmd(parsed.name)} again or open Kick Home. Nothing was submitted.` })
      }
    })
  })
  app.view('kick_command_choose', async ({ body, view, client, ack }) => {
    try {
      const data = JSON.parse(view.private_metadata)
      const parsed = parseCommand(cmd(data.name), data.sub, test)
      if (!parsed || parsed.help || !data.channel) throw new Error('Invalid selection')
      await ack({ response_action: 'update', view: await show(client, { team_id: body.team.id, user_id: body.user.id, channel_id: data.channel, text: data.sub }, parsed, read(view, 'workflow')) })
    } catch { await ack({ response_action: 'update', view: failure() }) }
  })
  app.action('kick_command_help', async ({ body, client }) => {
    await client.views.open({ trigger_id: body.trigger_id, view: help('sync') })
  })
  return { show, help }
}
module.exports = { registerCommands }
