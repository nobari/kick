"use client";
import { useState } from "react";
import Image from "next/image";
import styles from "./home.module.css";
const examples = [
  { id: "checkins", label: "Check-ins", title: "Ask better questions. Get useful updates.", copy: "Choose your questions and schedule, flag blockers, and find someone who can help. A digest brings the responses together.", command: "/sync setup", example: "Ask ‘What shipped?’ and ‘What needs a hand?’ every weekday.", note: "New workflows start paused. Preview and confirm before enabling." },
  { id: "tasks", label: "To-dos", title: "A next step with a name next to it.", copy: "Assign channel to-dos with due dates and a clear status. Keep your own personal list separate, private and easy to reach.", command: "/todo channel", example: "‘Prepare the release demo’, assigned to a teammate, due Friday.", note: "Personal to-dos use /todo mine, require no workflow and never enter team reports." },
  { id: "polls", label: "Polls", title: "Less back-and-forth. A clear choice.", copy: "Ask the channel a question with 2–10 options. Members can change their vote until the poll closes; share results when ready.", command: "/poll create", example: "‘Which day for the demo?’ Let the team choose Tuesday or Thursday.", note: "Votes are associated with Slack IDs, not anonymous. The creator or workflow owner closes voting." },
  { id: "planning", label: "Planning", title: "Make room for the right work.", copy: "Compare open channel tasks with self-declared capacity. Add objectives and measurable key results, or prepare a sprint together.", command: "/plan workload", example: "Five open tasks against a declared limit of four? Discuss priorities before adding more.", note: "An unset capacity stays unknown. No hours tracking or individual productivity scores." },
  { id: "people", label: "People", title: "Give important conversations a home.", copy: "Prepare a one-on-one agenda and follow-ups. Coordinate onboarding, time off, handoffs and approvals through focused forms.", command: "/oneonone new", example: "Prepare ‘What support would help next week?’ before your next conversation.", note: "One-on-ones are participant-only and excluded from reports. Both participants can read the agenda." },
  { id: "reports", label: "Reports", title: "The week’s work. The whole picture.", copy: "Bring retained check-ins, tasks, blockers, recognition, decisions, objectives, onboarding and handoffs into one workflow report.", command: "/report week", example: "Review this week’s completed actions and open blockers before sharing with the channel.", note: "Choose up to 90 UTC days. Counts use creation dates and current status; private records and legacy command history are excluded." },
] as const;
export default function ProductExplorer() {
  const [selected, setSelected] = useState(0);
  const current = examples[selected];
  return <div className={styles.explorer}>
    <div className={styles.explorerControls} role="group" aria-label="Explore Kick workflows">{examples.map((item, index) => <button type="button" key={item.id} aria-pressed={index === selected} aria-controls="product-example" onClick={() => setSelected(index)}>{item.label}</button>)}</div>
    <div id="product-example" className={styles.explorerBody}><div className={styles.exampleArt}><Image src={`/assets/site-v3/${current.id}.svg`} width={640} height={430} alt={`Illustrative ${current.label.toLowerCase()} example with sample data, not a Slack screenshot`} sizes="(max-width: 800px) 90vw, 55vw"/><p>Illustrative workflow · sample data, not a Slack screenshot</p></div><div className={styles.exampleCopy} aria-live="polite" aria-atomic="true"><code>{current.command}</code><h3>{current.title}</h3><p>{current.copy}</p><blockquote>{current.example}</blockquote><p className={styles.small}>{current.note}</p><a className={styles.arrowLink} href="/get-started">How to use it ↗</a></div></div>
  </div>;
}
