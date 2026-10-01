import { SlackButton } from "./SiteChrome";

export default function GettingStarted() {
  const scheduled = process.env.KICK_SCHEDULER_ENABLED === "true";
  return (
    <>
      <ol className="steps">
        <li><h2>Open your workspace</h2><p>Open the Slack workspace where you installed Kick. Choose a public test channel that you belong to.</p><p><a href="https://app.slack.com/">Open Slack →</a></p></li>
        <li><h2>Share your first update</h2><p>Type <code>/sync</code> in the channel’s message box and send it. Fill in yesterday’s work, today’s plan, blockers, and mood in the form.</p></li>
        <li><h2>Review it with your team</h2><p>Submit the form to post your update in that channel. Use <code>/sync -r 7</code> to review recent updates.</p></li>
      </ol>
      <section className="integration-details" aria-labelledby="guided-rituals">
        <h2 id="guided-rituals">Set up scheduled check-ins</h2>
        <p>In a public channel, run <code>/sync setup</code>. Choose active human participants who belong to the channel, weekdays, an IANA time zone (for example, <code>Asia/Tokyo</code>), check-in and digest times, and a template. You can also write one to five custom questions.</p>
        <p>New setups start <strong>Paused</strong>. Select Enabled when you are ready, review the preview, then Confirm. Only the workflow owner or a workspace admin can change an existing setup. {scheduled ? "The scheduler checks for due work every 15 minutes. Delivery may be later during an outage or backlog." : "Automatic scheduling is not activated yet; save your setup as Paused for now."} Leave at least 15 minutes between the check-in opening and digest so a scheduler run can occur.</p>
        <h3>Check in, then follow through</h3>
        <p>During the configured window, use <code>/sync checkin</code> or the Share update button. Answer the questions, optionally add a blocker and a helper, and submit. Each participant submits once per session. At digest time, the channel receives a summary; the full updates remain available in Kick Home.</p>
        <p>Open Kick under Apps in Slack and select Home. Choose a channel, then Overview, Updates, Blockers, or Team trends. Use <code>/sync home</code> to refresh it. Home requires the Slack Home tab and <code>app_home_opened</code> subscription; if the tab is unavailable, the existing slash commands still work.</p>
        <h3>Rotate fairly and celebrate contributions</h3>
        <p><code>/pick rotate</code> uses the participant list in an enabled channel ritual to choose the least recently selected person. Exclusions apply to that pick only. The result is queued for the next scheduler run; <code>/pick</code> remains an immediate random pick. Enable the optional Friday appreciation roundup in channel settings to recap new kudos and coins.</p>
        <h3>Keep reminders on your terms</h3>
        <p><code>/sync preferences</code> saves your time zone, quiet hours, leave-through date, and reminder opt-out. Private reminders and helper follow-ups require permission granted to your installation and service activation. Saving preferences does not grant permission or turn on delivery.</p>
        <p>To pause, return to <code>/sync setup</code>, select Paused, preview, and confirm. New workflow history uses your selected 7-, 30-, or 90-day retention; core command history and messages stored in Slack have separate retention rules.</p>
      </section>
      <section className="integration-details" aria-labelledby="team-workspace">
        <h2 id="team-workspace">Your team workspace in Slack</h2>
        <p>Open Kick → Home, select a workflow, then choose <strong>Open team workspace</strong>. All records are limited to current members of that public channel. These tools do not require a separate login.</p>
        <h3>Multiple workflows and calendar exceptions</h3>
        <p>Use <strong>Add workflow</strong> in Home for an independent schedule in the same channel (up to ten). Give it a distinct name. The original <code>/sync setup</code>, <code>/sync checkin</code>, and <code>/pick rotate</code> commands target the channel’s default workflow; Home buttons target the selected workflow. Owners and workspace admins can use Calendar to skip a date or override its opening and digest times, before that check-in opens. Dates must fall within the workflow retention window.</p>
        <h3>Actions and editable updates</h3>
        <p>Choose Actions → New action, or Track action while reading an update or blocker. Review the text, choose an assignee and due date, and optionally link a sprint. The assignee, creator, or workflow owner can mark it Done. Your open actions appear in Home.</p>
        <p>Read your submitted check-in and choose Edit / correct. Before the digest closes, your saved answers are replaced. After closing, Kick preserves the original and queues a labeled correction. These edits apply to scheduled workflow check-ins, not legacy <code>/sync</code> command records.</p>
        <h3>Sprint goals and recaps</h3>
        <p>Owners and workspace admins can create a sprint with a goal and start/end dates. Link actions when creating or editing them. Its detail view includes workflow updates from those dates. Finish &amp; share recap closes the sprint and queues a summary of retained records for the channel. Counts are not productivity ratings.</p>
        <h3>Retrospectives</h3>
        <p>Create a retrospective, then add Keep, Improve, or Try topics. The facilitator can group related topics by a shared label, open voting, and close the retrospective. Each member can vote once per topic. Topics can become assigned actions. Names are visible: this is not anonymous feedback.</p>
        <h3>Planning poker</h3>
        <p>Create a session and select channel members as voters. Choose an estimate, ? for unsure, or Abstain. Values stay hidden until the facilitator reveals them. After discussion, start another round or record a final decision. Other members should use Refresh to see the latest phase.</p>
        <h3>Search and operations</h3>
        <p>Search history searches only the selected workflow’s retained Kick updates, actions, blockers, and recognition—not your Slack message history. Filter by words, person, UTC dates, and status. Owners and admins can inspect installation connectivity, configuration, retained delivery failures, and the audit in Operations. Retry is limited to failed, unleased, unexpired jobs; Slack delivery is not guaranteed exactly once.</p>
        <h3>Message shortcuts</h3>
        <p>After the shortcuts are configured and published in Slack, open a public-channel message’s More actions menu and choose Track action, Report blocker, or Give kudos. Select a workflow and review the copied text before confirming. Cancel saves nothing. Kudos queues a channel message; actions and blockers are saved in Kick. Attachments and surrounding messages are not copied.</p>
        <p>Scheduled sends and explicitly queued recaps, corrections, and thanks are normally checked every 15 minutes. Pausing a workflow stops automatic check-in prompts; explicitly requested channel notices can still be delivered. Workflow records expire after 7, 30, or 90 days; linked child records may expire earlier with their parent.</p>
      </section>
      <section className="integration-details" aria-labelledby="try-next">
        <h2 id="try-next">Try your next team ritual</h2>
        <p><code>/kudos</code> thanks a teammate with a reason. <code>/coins</code> sends virtual recognition points—not money. <code>/pick</code> randomly selects eligible teammates. These workflows can post results visible to the channel.</p>
        <h3>Need a hand?</h3>
        <p>Type <code>/sync -h</code> for command help. If Slack cannot find a command, check that you selected the workspace where Kick was installed, or ask your workspace admin to approve the app. If Kick reports missing channel access, invite it to that channel and try again.</p>
        <p>Kick’s core workflows are free and need no separate account. If you have not installed it yet, use the button below and complete Slack’s authorization screen.</p>
        <p><SlackButton /></p>
        <p>Read the <a href="/privacy">Privacy policy</a> before sharing sensitive information. For help, visit <a href="/support">Support</a> or email <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>.</p>
      </section>
    </>
  );
}
