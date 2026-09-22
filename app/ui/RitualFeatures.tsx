import RitualTour from "./RitualTour";

const features = [
  ["01", "Scheduled check-ins", "Choose participants, weekdays, time zone, and an opening time. Every channel starts paused.", "scheduled"],
  ["02", "Gentle reminders", "One private nudge for a missing update, with quiet hours, snooze, leave, and opt-out controls.", "permission"],
  ["03", "Daily digests", "Bring team responses and pending counts into a channel summary at the end of the check-in window.", "scheduled"],
  ["04", "Blockers with a next step", "Assign a helper, track the status, and resolve the blocker. Private helper follow-ups require the reminder permission.", "manual"],
  ["05", "Guided channel setup", "Choose your settings, review the preview, edit if needed, and confirm before anything starts.", "manual"],
  ["06", "Your questions, your ritual", "Start with standup, weekly wins, or retrospective templates—or write one to five custom questions.", "manual"],
  ["07", "Fair team rotations", "Choose the least recently selected participant, exclude someone this time, and preserve the rotation history.", "scheduled"],
  ["08", "Weekly appreciation", "An optional Friday roundup celebrates recent kudos and coins without ranking people.", "scheduled"],
  ["09", "A personal Home in Slack", "Switch between an overview, updates, blockers, and trends. See only channels you belong to.", "home"],
  ["10", "Team-level insights", "Compare participation and blocker totals across two seven-day periods. No individual productivity scores.", "manual"],
] as const;

export default function RitualFeatures() {
  const scheduled = process.env.KICK_SCHEDULER_ENABLED === "true";
  return <section id="team-rituals" className="ritual-section section-shell" aria-labelledby="ritual-title">
    <div className="section-heading centered"><p className="kicker">The team-rituals release</p><h2 id="ritual-title">Less chasing.<br/>More moving forward.</h2><p>A connected rhythm for check-ins, follow-through, and appreciation—inside Slack.</p></div>
    <RitualTour />
    <aside className="release-notice" aria-label="Feature availability"><strong>Clear expectations, before you install.</strong><p>{scheduled ? "Scheduled delivery is checked every 15 minutes and requires explicit channel setup. " : "Automatic delivery is not activated yet; channel setups can be saved as paused. "}Private reminders and helper follow-ups are pending Slack permission approval and reinstall consent. App Home requires the Home tab and event subscription to be enabled for the app. Existing slash commands remain available.</p></aside>
    <div className="ritual-feature-grid">
      {features.map(([number, title, description, type]) => <article className="ritual-feature" key={number}><span className="feature-number">{number}</span><h3>{title}</h3><p>{description}</p><span className="feature-availability">{type === "permission" ? "Pending Slack permission approval" : type === "scheduled" ? scheduled ? "Opt-in · 15-minute delivery checks" : "Automatic delivery awaiting activation" : type === "home" ? "Requires Slack Home configuration" : "Included in the team-rituals release"}</span></article>)}
    </div>
  </section>;
}
