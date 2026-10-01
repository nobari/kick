"use client";

import Image from "next/image";
import { useState } from "react";

const scenes = [
  { id: "01-check-ins", label: "Check-ins", title: "Less chasing. More doing.", description: "Answer your team’s questions, flag a blocker, and choose someone who can help. Start with /sync setup, then use /sync checkin to share an update.", alt: "Sample Kick check-in form with questions for completed work, next steps, and blockers" },
  { id: "02-channel-todos", label: "Channel to-dos", title: "Give every next step an owner.", description: "Turn shared work into channel to-dos with an assignee, due date, and clear status. In Kick Home, choose a workflow, open the team workspace, and select Channel to-dos.", alt: "Sample Kick channel action list showing assigned tasks, due dates, and completion controls" },
  { id: "03-personal-todos", label: "Personal to-dos", title: "Your list. Your space.", description: "Keep personal tasks separate from shared work. Open My personal to-dos in Kick Home to add, edit, or complete a task. Your list is private to you in Kick and excluded from team reports.", alt: "Sample Kick personal task list with private tasks and edit and completion controls" },
  { id: "04-polls", label: "Polls", title: "Ask once. Hear the whole team.", description: "Create a channel poll with two to ten choices. Each member gets one changeable vote; the creator or workflow owner can close voting and share results. Votes are associated with Slack IDs, not anonymous.", alt: "Sample Kick poll with answer choices, vote totals, and a voting selector" },
  { id: "05-reports", label: "Reports", title: "See the week. Choose what comes next.", description: "Preview check-ins, blockers, shared tasks, planning, and recognition for one workflow. Choose up to 90 days of retained records, then optionally share the report. Personal tasks are never included.", alt: "Sample Kick comprehensive workflow report with participation, blockers, tasks, and planning summaries" },
] as const;

export default function RitualTour() {
  const [selected, setSelected] = useState<(typeof scenes)[number]["id"]>("01-check-ins");
  const scene = scenes.find(item => item.id === selected)!;
  const image = `/assets/slack-marketplace/2026-10/${scene.id}.png`;

  return <div className="ritual-tour" id="product-tour">
    <div className="tour-controls" role="group" aria-label="Explore Kick features">
      {scenes.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} aria-controls="tour-preview" onClick={() => setSelected(item.id)}>{item.label}</button>)}
    </div>
    <div id="tour-preview">
      <figure className="tour-figure">
        <a href={image} target="_blank" rel="noopener noreferrer" aria-label={`View ${scene.label.toLowerCase()} image at full size (opens in a new tab)`}>
          <Image key={scene.id} src={image} width={1600} height={1000} alt={scene.alt} sizes="(max-width: 1200px) 92vw, 1120px" />
        </a>
        <figcaption>Illustrative app views with sample data, built from Kick’s interface—not live Slack captures. Select an image to view it full size.</figcaption>
      </figure>
      <div className="tour-copy" aria-live="polite" aria-atomic="true">
        <h3>{scene.title}</h3><p>{scene.description}</p>
      </div>
    </div>
    <a className="text-link" href="/get-started">See the setup guide →</a>
  </div>;
}
