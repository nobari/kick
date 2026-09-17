import { SlackButton } from "./SiteChrome";

export default function GettingStarted() {
  return (
    <>
      <ol className="steps">
        <li><span>01</span><h2>Open your workspace</h2><p>Open the Slack workspace where you installed Kick. Choose a public test channel that you belong to.</p><p><a href="https://app.slack.com/">Open Slack →</a></p></li>
        <li><span>02</span><h2>Share your first update</h2><p>Type <code>/sync</code> in the channel’s message box and send it. Fill in yesterday’s work, today’s plan, blockers, and mood in the form.</p></li>
        <li><span>03</span><h2>Review it with your team</h2><p>Submit the form to post your update in that channel. Use <code>/sync -r 7</code> to review recent updates.</p></li>
      </ol>
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
