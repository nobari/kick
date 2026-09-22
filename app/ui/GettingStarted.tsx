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
        <p><code>/sync preferences</code> saves your time zone, quiet hours, leave-through date, and reminder opt-out. Private reminders and helper follow-ups are pending Slack permission approval and reinstall consent. Saving preferences does not grant that permission or turn on delivery.</p>
        <p>To pause, return to <code>/sync setup</code>, select Paused, preview, and confirm. New workflow history uses your selected 7-, 30-, or 90-day retention; core command history and messages stored in Slack have separate retention rules.</p>
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
