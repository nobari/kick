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

const examples: Record<string, string> = {
  "Scheduled check-ins": "Open /sync setup: ask the delivery team for an update at 9:00 each weekday, with a digest at 11:00.",
  "Private reminders": "Set quiet hours to 18:00–09:00 in /sync preferences. When reminders are activated, a missing update gets one eligible nudge—not repeated pings.",
  "Daily digests": "At closing time, a digest shows four submitted updates and two still pending. Open Kick Home to read each update.",
  "Blockers with a next step": "During /sync checkin, write ‘Waiting for staging access’ and choose a helper. Resolve it from Home once access is restored.",
  "Guided channel setup": "Use /sync setup to preview participants and a 30-day retention period. Keep it paused until the team is ready.",
  "Custom questions": "In setup, replace the standup template with ‘What shipped?’ and ‘What did we learn?’ for a weekly reflection.",
  "Fair team rotations": "Run /pick rotate to choose the next demo host. Exclude someone who is away without removing them from future rotations.",
  "Weekly appreciation": "Enable the roundup in setup to bring the week’s thank-yous together in the channel on Friday.",
  "A personal Home in Slack": "Open Kick → Home to read the latest check-in and your assigned channel actions; My personal to-dos stays separate.",
  "Team-level insights": "Choose Team trends in Home to see whether more updates arrived this week and how many blockers remain open.",
};
const collaboration = [
  ["Channel to-dos", "Give shared work an assignee, due date, and Open or Done status. Lists belong to the selected channel workflow and are visible to its channel members.", "Channel to-dos → New action: ‘Prepare the release demo’, assigned to a teammate, due Friday. The assignee marks it Done; link it to a sprint if needed."],
  ["Personal to-dos", "Keep your own list, private to you in Kick. No channel setup is needed. Edit, complete, reopen, or delete a task; personal tasks expire after 30 days.", "Home → My personal to-dos: ‘Read the onboarding guide’, due tomorrow. It never appears in channel lists, shared search, or reports."],
  ["Channel polls", "Ask a question with 2–10 choices. Each member gets one changeable vote. The creator or workflow owner closes voting and shares results. Votes are stored with Slack IDs, not anonymously.", "Polls → Create poll: ‘Which day for the demo?’ with Tuesday and Thursday. An invitation is queued for the channel; members vote in Home, then the creator closes it."],
  ["Comprehensive reports", "Combine retained check-ins, blockers, channel to-dos, sprints, recognition, retrospectives, planning sessions, and polls for one workflow. Preview up to 90 days, then optionally share.", "Comprehensive report → choose this week. Review completed tasks, open blockers and poll activity together. Counts use UTC creation dates and current status; personal tasks and legacy command history are excluded."],
  ["Editable check-ins", "Edit before the digest closes. Afterward, share a labeled correction without rewriting the original digest.", "Read your update → Edit / correct: change ‘Waiting for review’ to ‘Review complete’. After closing, it is saved as a correction and queued separately."],
  ["Multiple workflows", "Run up to ten named workflows in one public channel, each with its own participants, questions, schedule, and retention.", "Home → Add workflow: keep ‘Daily standup’ and ‘Friday wins’ in the same channel. Select a workflow before opening its records."],
  ["Sprint goals and recaps", "Set a goal and dates, link actions, and review updates from that period. Finish with a factual recap of retained updates and completed actions.", "Sprints → New sprint: ‘Simplify onboarding’. Link three channel to-dos, then Finish & share recap to report how many were completed."],
  ["Retrospectives", "Collect attributed topics, group related ideas, vote, and turn them into actions. This is a named discussion, not anonymous feedback.", "Retrospectives → New retrospective: collect Keep, Improve and Try topics. Group build issues under ‘Delivery’, open voting, then track the chosen topic as an action."],
  ["Planning poker", "Keep estimates hidden until a shared reveal. Support unsure votes, abstention, another round, and a recorded decision.", "Planning poker → New session: estimate ‘Invite a teammate’. Voters choose cards privately; the facilitator reveals them, discusses differences, and records ‘5 points’."],
  ["Search retained history", "Find this workflow’s Kick updates, channel to-dos, blockers, and recognition by words, person, UTC dates, and status. This is not a Slack archive search.", "Search history: enter ‘demo’, choose an assignee and Done, then narrow the dates to find a completed action."],
  ["Calendar exceptions", "Owners and admins can skip a holiday or change one date’s times before its check-in opens. Other dates keep their normal schedule.", "Calendar → select a future holiday → Skip check-in. For a delayed start, save custom opening and digest times instead."],
  ["Delivery operations", "Owners and admins can inspect connectivity, delivery failures, eligible retries, and the configuration and operations audit.", "Operations → review a failed digest → Review retry. Kick rechecks expiry, workflow status and lease ownership before queuing it again."],
  ["Message shortcuts", "Review a message before saving an action or blocker, or sending thanks. Shortcuts require Slack configuration and publication; Home tools do not wait for shortcut publication.", "On a public-channel message, choose More actions → Track action. Review the copied text and select a workflow and assignee before confirming. Cancel saves nothing."],
] as const;

export default function RitualFeatures() {
  const scheduled = process.env.KICK_SCHEDULER_ENABLED === "true";
  return <section id="team-rituals" className="ritual-section section-shell" aria-labelledby="ritual-title">
    <div className="section-heading centered"><p className="kicker">Team check-ins</p><h2 id="ritual-title">Schedule updates and track follow-ups.</h2><p>Choose a schedule, collect responses, and review what needs attention.</p></div>
    <RitualTour />
    <aside className="release-notice" aria-label="Feature availability"><strong>Availability</strong><p>{scheduled ? "Scheduled delivery is checked every 15 minutes and requires explicit workflow setup. " : "Automatic delivery is not activated yet; setups can be saved as paused. "}Private reminders require permission granted to your installation and service activation. App Home requires the Home tab and event subscription. Existing slash commands remain available.</p></aside>
    <div className="ritual-feature-grid">
      {features.map(([title, description, type]) => <article className="ritual-feature" key={title}><h3>{title}</h3><p>{description}</p><p className="feature-example"><strong>Try it:</strong> {examples[title]}</p><span className="feature-availability">{type === "permission" ? "Requires installation consent and activation" : type === "scheduled" ? scheduled ? "Opt-in · 15-minute delivery checks" : "Automatic delivery awaiting activation" : type === "home" ? "Requires Slack Home configuration" : ""}</span></article>)}
    </div>
    <div className="section-heading centered"><p className="kicker">Beyond the check-in</p><h2>From updates to next steps.</h2><p>Open Kick Home, choose a workflow, then select Open team workspace. No extra account or dashboard.</p></div>
    <div className="ritual-feature-grid">
      {collaboration.map(([title, description, example]) => <article className="ritual-feature" key={title}><h3>{title}</h3><p>{description}</p><p className="feature-example"><strong>Try it:</strong> {example}</p></article>)}
    </div>
    <p>Examples above are illustrative, not customer data. Poll invitations, results, and shared reports are checked for delivery every 15 minutes. Shared records follow the workflow’s 7-, 30-, or 90-day retention; personal tasks use a separate 30-day period. <a href="/get-started">Read the full guide</a> or <a href="/privacy">review the privacy policy</a>.</p>
  </section>;
}
