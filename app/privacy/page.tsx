import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kick Bot collects, uses, retains, and deletes Slack workspace and workflow data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-main section-shell">
      <header className="legal-hero">
        <p className="legal-date">Effective November 30, 2022</p>
        <h1>Privacy policy</h1>
        <p>A plain-language explanation of what Kick needs, why it needs it, and how workspace owners can control their data.</p>
      </header>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="Privacy policy sections">
          <strong>On this page</strong>
          <a href="#collect">What we collect</a><a href="#permissions">Slack permissions</a><a href="#use">How data is used</a><a href="#retention">Retention</a><a href="#rights">Your choices</a><a href="#contact-privacy">Contact</a>
        </nav>
        <div className="legal-content">
          <section id="collect"><h2>What we collect</h2><p>When Kick is installed, it stores the Slack workspace name, workspace ID, installer and bot identifiers, and the authorization token required to operate the app.</p><p>When people use Kick, it stores the workflow information needed for features such as standup reports, kudos, coins, and team picks. This can include Slack member IDs, channel IDs, submitted text, timestamps, and links to relevant Slack messages.</p><p>Kick does not store team members’ email addresses.</p></section>
          <section id="permissions"><h2>Slack permissions</h2><h3>Read channels and members</h3><p>Kick reads public-channel and member information to determine eligible participants and run workflows in the channel where a command is used.</p><h3>Use slash commands</h3><p>This permission makes Kick’s commands available in your workspace.</p><h3>Post messages</h3><p>Kick posts workflow prompts, confirmations, and results in the relevant Slack conversation.</p><h3>Read message history</h3><p>Kick uses relevant public-channel history when a workflow needs context or a link to a Slack message.</p></section>
          <section id="use"><h2>How data is used</h2><p>Kick uses the information above only to provide its Slack workflows, maintain installation records, generate requested reports, monitor reliability, prevent abuse, and resolve errors.</p><p>Interactions with Kick may be logged for monitoring and error handling. Kick does not sell personal data or use stored Slack data for advertising.</p></section>
          <section id="retention"><h2>Retention and security</h2><p>Workflow and installation data may be retained for up to three years unless a workspace owner requests deletion sooner. Authorization tokens are retained while the app remains installed and are used only to communicate with Slack.</p><p>Kick uses HTTPS for data in transit and restricts production data access to the services needed to operate the app. No online service can guarantee absolute security.</p></section>
          <section id="rights"><h2>Your choices</h2><p>A workspace owner may request an export of Kick data. We aim to provide the export within 14 days.</p><p>After uninstalling Kick, a workspace owner may request deletion. Include the business name, Slack workspace name, and a responsible party’s name and contact details so the request can be verified. We aim to confirm deletion within 30 days.</p></section>
          <section id="contact-privacy"><h2>Contact</h2><p>For privacy questions, exports, or deletion requests, email <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>.</p></section>
        </div>
      </div>
    </main>
  );
}
