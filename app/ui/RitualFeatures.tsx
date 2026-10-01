import RitualTour from "./RitualTour";

const features = [
  ["Scheduled check-ins", "Choose participants, weekdays, time zone, and an opening time. Every channel starts paused.", "scheduled"],
  ["Private reminders", "One private nudge for a missing update, with quiet hours, snooze, leave, and opt-out controls.", "permission"],
  ["Daily digests", "Bring team responses and pending counts into a channel summary at the end of the check-in window.", "scheduled"],
  ["Blockers with a next step", "Assign a helper, track the status, and resolve the blocker. Private helper follow-ups require the reminder permission.", "manual"],
  ["Guided channel setup", "Choose your settings, review the preview, edit if needed, and confirm before anything starts.", "manual"],
  ["Custom questions", "Start with standup, weekly wins, or retrospective templates—or write one to five custom questions.", "manual"],
  ["Fair team rotations", "Choose the least recently selected participant, exclude someone this time, and preserve the rotation history.", "scheduled"],
  ["Weekly appreciation", "An optional Friday roundup celebrates recent kudos and coins without ranking people.", "scheduled"],
  ["A personal Home in Slack", "Switch between an overview, updates, blockers, and trends. See only channels you belong to.", "home"],
  ["Team-level insights", "Compare participation and blocker totals across two seven-day periods. No individual productivity scores.", "manual"],
] as const;

const collaboration = [
  ["Give every next step an owner", "Turn an update or blocker into an action with an assignee, due date, and Done status. Your open actions appear in Kick Home."],
  ["Keep updates accurate", "Edit a check-in before its digest closes. Afterward, share a labeled correction without rewriting the original digest."],
  ["Make room for different teams", "Run up to ten named workflows in one public channel, each with its own participants, questions, schedule, and retention. Skip a holiday or change one date’s times."],
  ["Plan a sprint together", "Set a goal and dates, link actions, and review updates from that period. Finish with a factual recap of retained updates and completed actions."],
  ["Learn, then decide", "Collect attributed retrospective topics, group related ideas, vote, and turn them into actions. Use planning poker for hidden estimates, a shared reveal, another round, and a recorded decision."],
  ["Find history and resolve delivery issues", "Search retained Kick updates, actions, blockers, and recognition by workflow, words, person, date, and status. Owners can inspect delivery failures, request a safe retry, and review the operations audit."],
] as const;

export default function RitualFeatures() {
  const scheduled = process.env.KICK_SCHEDULER_ENABLED === "true";
  return <section id="team-rituals" className="ritual-section section-shell" aria-labelledby="ritual-title">
    <div className="section-heading centered"><p className="kicker">Team check-ins</p><h2 id="ritual-title">Schedule updates and track follow-ups.</h2><p>Choose a schedule, collect responses, and review what needs attention.</p></div>
    <RitualTour />
    <aside className="release-notice" aria-label="Feature availability"><strong>Availability</strong><p>{scheduled ? "Scheduled delivery is checked every 15 minutes and requires explicit workflow setup. " : "Automatic delivery is not activated yet; setups can be saved as paused. "}Private reminders require permission granted to your installation and service activation. App Home requires the Home tab and event subscription. Existing slash commands remain available.</p></aside>
    <div className="ritual-feature-grid">
      {features.map(([title, description, type]) => <article className="ritual-feature" key={title}><h3>{title}</h3><p>{description}</p><span className="feature-availability">{type === "permission" ? "Requires installation consent and activation" : type === "scheduled" ? scheduled ? "Opt-in · 15-minute delivery checks" : "Automatic delivery awaiting activation" : type === "home" ? "Requires Slack Home configuration" : ""}</span></article>)}
    </div>
    <div className="section-heading centered"><p className="kicker">Beyond the check-in</p><h2>From updates to next steps.</h2><p>Open Kick Home, choose a workflow, then select Open team workspace. No extra account or dashboard.</p></div>
    <div className="ritual-feature-grid">
      {collaboration.map(([title, description]) => <article className="ritual-feature" key={title}><h3>{title}</h3><p>{description}</p></article>)}
    </div>
    <p>Message shortcuts let you track an action, report a blocker, or give kudos from a message after reviewing its text. These shortcuts become available after Slack configuration and publication. You can already create actions from updates and blockers in Kick Home. <a href="/get-started">Read the full guide</a>.</p>
  </section>;
}
