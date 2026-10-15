import { commands } from "../../server/rituals/command-catalog";

export default function CommandReference() {
  return (
    <section className="integration-details" aria-labelledby="command-reference">
      <h2 id="command-reference">A shorter path to your team’s work</h2>
      <p>Open a focused Slack form, review who can see the information, then confirm. Every command accepts <code>help</code>, <code>-h</code> and <code>--help</code>.</p>
      <p><strong>New command rollout:</strong> the ten new commands are configured in Kick’s unpublished Slack draft. They are not yet published to all workspaces. Until the Marketplace update is approved and published, use the same tools in Kick → Home. The existing <code>/sync</code>, <code>/pick</code>, <code>/kudos</code> and <code>/coins</code> commands remain available.</p>
      <dl>
        {commands.map(command => (
          <div key={command.name}>
            <dt><h3><code>{`/${command.name}`}</code> — {command.description}</h3></dt>
            <dd><code>{`/${command.name} ${command.usage}`}</code>{command.legacy ? " · Existing command" : " · New command rollout"}</dd>
          </div>
        ))}
      </dl>
      <h3>Choose the right context</h3>
      <p>Use <code>/timeoff</code> for leave requests and coverage. Slack’s own <code>/leave</code> exits a channel and is not a Kick command.</p>
      <p><code>/todo</code> opens your private list without a workflow. <code>/todo channel</code> opens shared tasks. Other team commands use the public channel you invoke them in; when it has multiple workflows, you choose one first. No workflow? Create one with <code>/sync setup</code> and leave it paused.</p>
      <p><code>/report week</code> and <code>/report month</code> prefill the last 7 or 30 days through today in UTC. You can adjust the dates and preview before sharing. <code>/approve pending</code> shows requests awaiting your decision; <code>/oneonone upcoming</code> shows your active meetings dated today or later in UTC.</p>
      <p>Use <code>/plan sync</code> for optional GitHub, Jira or Linear connections. A Slack administrator must supply their own provider consent. Status changes are manual and confirmed—not background synchronization.</p>
      <p>Slack commands can conflict with another installed app’s names. If a command opens another app or is unavailable, use Kick Home. Nothing is submitted simply by opening a form. Existing quick-post options keep their behavior; see help before using them.</p>
    </section>
  );
}
