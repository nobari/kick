import type { Metadata } from "next";
import { SlackButton } from "../ui/SiteChrome";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help installing and using Kick Bot’s Slack commands and team workflows.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main id="main-content" className="legal-main section-shell">
      <header className="legal-hero"><p className="legal-date">Kick support</p><h1>How can we help?</h1><p>Most questions can be answered directly in Slack. For anything else, email us and include your workspace name and the command you were using.</p></header>
      <div className="support-grid">
        <section className="support-card"><h2>Command help</h2><p>Add <code>-h</code> to any Kick command—for example, <code>/sync -h</code>—to see current options inside Slack.</p></section>
        <section className="support-card"><h2>Install Kick</h2><p>Use Slack’s OAuth flow to add Kick to a workspace where you have permission to install apps.</p><p><SlackButton variant="compact"/></p></section>
        <section className="support-card"><h2>Contact support</h2><p>For installation, privacy, or workflow help, email <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>.</p></section>
      </div>
    </main>
  );
}
