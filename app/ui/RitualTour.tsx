"use client";

import { useState } from "react";

const scenes = [
  { id: "home", label: "Home", title: "Browse updates and blockers.", description: "See your next step, browse team updates, and find open blockers in Kick’s Home tab. Channel membership controls what you can see." },
  { id: "checkin", label: "Check-in", title: "Share a team update.", description: "Answer your team’s questions, name a blocker, and choose someone who can help. No new account. No dashboard to keep open." },
  { id: "digest", label: "Digest", title: "Read the channel summary.", description: "An opt-in channel digest brings responses, pending updates, and blocker counts together. Read full updates in Home when you need more context." },
] as const;

export default function RitualTour() {
  const [selected, setSelected] = useState<(typeof scenes)[number]["id"]>("home");
  const scene = scenes.find(item => item.id === selected)!;
  return <div className="ritual-tour">
    <div className="tour-copy">
      <div className="tour-controls" role="group" aria-label="Explore the Kick experience">
        {scenes.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-controls="tour-preview" onClick={() => setSelected(item.id)}>{item.label}</button>)}
      </div>
      <h3>{scene.title}</h3><p>{scene.description}</p>
      <a className="text-link" href="/get-started">See the setup guide →</a>
    </div>
    <figure className="tour-figure">
      <div className="tour-window" id="tour-preview" aria-live="polite" aria-atomic="true">
        <div className="tour-window-top"><span className="tour-mark" aria-hidden="true">K</span><strong>Kick</strong><span>Illustrative preview</span></div>
        {selected === "home" ? <div className="tour-content">
          <p className="tour-eyebrow">HOME · #TEAM-CHECK-IN</p><h4>Your team, in sync</h4>
          <p className="tour-muted">Check in. Unblock. Appreciate.</p>
          <div className="tour-notice"><span aria-hidden="true">✓</span><div><strong>Your update is saved.</strong><p>Thanks for keeping your team in the loop.</p></div></div>
          <div className="tour-stats"><div><strong>4 / 5</strong><span>Updates shared</span></div><div><strong>1</strong><span>Open blocker</span></div></div>
          <div className="tour-card"><strong>Open blocker</strong><p>Waiting for access to the test environment.</p><span className="tour-chip">Helper assigned</span></div>
          <p className="tour-muted">Overview · Updates · Blockers · Team trends</p>
        </div> : selected === "checkin" ? <div className="tour-content">
          <p className="tour-eyebrow">TEAM CHECK-IN</p><h4>A little context goes a long way.</h4>
          <p className="tour-muted">Answers are shared in the channel digest.</p>
          <div className="tour-example-field"><strong>What did you finish?</strong><p>Released the onboarding improvements.</p></div>
          <div className="tour-example-field"><strong>What is next?</strong><p>Test the next release with the team.</p></div>
          <div className="tour-example-field"><strong>Anything blocking you?</strong><p>Waiting for test-environment access.</p></div>
          <span className="tour-chip">Optional: choose a helper</span>
        </div> : <div className="tour-content">
          <p className="tour-eyebrow">#TEAM-CHECK-IN · DAILY DIGEST</p><h4>The day, in perspective.</h4>
          <p className="tour-muted">4 of 5 updates · 1 pending · 1 open blocker</p>
          <div className="tour-card"><strong>Team update</strong><p>Finished: onboarding improvements.<br/>Next: test the release together.</p></div>
          <div className="tour-card"><strong>One thing to unblock</strong><p>Test-environment access. A helper is assigned so the next step is clear.</p></div>
          <div className="tour-notice"><span aria-hidden="true">↗</span><div><strong>Read the full picture in Home.</strong><p>Team context, not individual productivity scores.</p></div></div>
        </div>}
      </div>
      <figcaption>Illustrative examples with fictional data—not screenshots of a live workspace. Slack’s appearance may vary.</figcaption>
    </figure>
  </div>;
}
