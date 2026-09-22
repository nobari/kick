import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kick Bot collects, uses, stores, and retains Slack data, and how to request access, an export, or deletion.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-main section-shell">
      <header className="legal-hero">
        <p className="legal-date">Last updated September 16, 2026</p>
        <h1>Kick Bot privacy policy</h1>
        <p>This policy covers Kick Bot, an independent integration for Slack, and its website at kick.bozmoz.com. “We” and “our” refer to the team operating Kick Bot. It explains how we handle data received from Slack, people using Kick, and visitors to our website.</p>
      </header>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="Privacy policy sections">
          <strong>On this page</strong>
          <a href="#collect">What we collect</a><a href="#use">How we use data</a><a href="#storage">Storage and sharing</a><a href="#permissions">Slack permissions</a><a href="#retention">Retention and uninstalling</a><a href="#rights">Access, export, and deletion</a><a href="#contact-privacy">Contact and changes</a>
        </nav>
        <div className="legal-content">
          <section id="collect">
            <h2>What we collect</h2>
            <h3>Installation and workspace information</h3>
            <p>Slack supplies workspace names and IDs, installer and bot identifiers, granted permissions, and OAuth authorization tokens. We store installation records so Kick can authenticate requests and communicate with the correct Slack workspace.</p>
            <h3>Information submitted to Kick</h3>
            <p>We process and store standup answers, mood selections, blockers, kudos, virtual-coin explanations, and team-pick inputs and results. Records can include Slack member IDs, usernames, channel IDs and channel metadata, timestamps, and Slack message links. Please avoid submitting sensitive information that your team does not need.</p>
            <p>Opt-in team rituals also store channel schedules, selected participants, question templates, check-in sessions and answers, blocker helpers and resolution status, fair-rotation history, and delivery jobs. Personal preferences include time zones, quiet hours, reminder choices, snooze times, and leave dates.</p>
            <h3>Slack API responses and technical information</h3>
            <p>Kick receives channel membership and member-profile information to display and select participants. These responses may include fields, such as profile images, that Kick does not use as a product feature. Kick does not request the users:read.email permission or maintain a member email directory.</p>
            <p>Slack requests and diagnostic logs can contain command text, submitted fields, identifiers, timestamps, and error information. Our hosting services also process ordinary request information, such as IP addresses, browser details, requested URLs, and response status, to deliver and protect the website and app.</p>
            <h3>Installation cookies</h3>
            <p>After installation, Kick sets a secure, HTTP-only confirmation cookie that expires after ten minutes. It records an expiry time and whether the installation was organization-wide; it contains no Slack access token, workspace name, or member identifier and is not used for advertising. Slack’s OAuth flow also uses a temporary security cookie to validate the installation request.</p>
            <h3>Support requests</h3>
            <p>If you contact us, we receive your email address and the information you include. This is separate from Slack member information. Do not send passwords, Slack tokens, or other credentials in support email.</p>
          </section>
          <section id="use">
            <h2>How we use data</h2>
            <p>We use data to operate Kick’s commands and forms, associate updates with their workspace and channel, post results in Slack, generate requested reports, maintain installations, troubleshoot errors, prevent abuse, and respond to support or data requests.</p>
            <p>When enabled for a channel, team-ritual data supports scheduled check-ins, reminders, summaries, blocker follow-ups, recognition roundups, and aggregate team insights. App Home checks channel membership before displaying that channel’s workflow records.</p>
            <p>Submitted updates and recognition are shared with the relevant Slack conversation. Other people who can access that conversation may be able to read them. Kick does not sell Slack data, use it for advertising, or send it to a generative-AI service for processing or model training.</p>
          </section>
          <section id="storage">
            <h2>Where data is stored and who receives it</h2>
            <p>Kick runs on Vercel, which processes incoming website and Slack requests and operational logs. App installation records and workflow data are stored in Postgres hosted by Neon. Slack installation credentials are additionally encrypted by the app before storage. Slack receives the API requests and messages needed to deliver the integration. Support correspondence is handled through our Gmail support mailbox.</p>
            <p>Cloudflare Workers is used for the external scheduling component when activated. It calls a fixed Kick endpoint using a scheduler secret and receives aggregate processing counts, not Slack credentials or submitted team content. Scheduler operational logs may include request timing and failure status.</p>
            <p>The original records in our previous datastore were deleted after the database migration was verified. Encrypted migration snapshots remain as recovery copies and are not used to serve normal app workflows. These snapshots have no automatic deletion schedule yet; verified data-deletion requests also cover these recovery copies.</p>
            <p>These service providers process data to host, store, secure, and operate the service. Data may be processed outside your country according to their infrastructure and service arrangements. We do not promise a particular data-residency region.</p>
            <p>Access to app data is limited to the operator and services needed to run and support Kick. We may disclose information when required by law. The app uses HTTPS for data in transit and service credentials for access to storage; no online system can guarantee absolute security.</p>
          </section>
          <section id="permissions">
            <h2>How Kick uses Slack permissions</h2>
            <p>Commands permissions enable slash commands. Channel and member permissions identify the conversation and eligible participants. Messaging permissions let Kick post workflow results. Public-channel history access supports workflow context and message-related operations. The Slack installation screen shows the permissions you are being asked to grant.</p>
            <p>The proposed direct-message permission allows Kick to open a private conversation for an opted-in check-in reminder or assigned-blocker follow-up. It does not grant access to your existing private-message history. This feature remains unavailable until the required permission is approved and granted to your workspace installation. You can disable private reminders in your preferences.</p>
            <p>Kick is an independent third-party integration. Slack controls its own platform, workspace retention settings, and handling of messages stored within Slack.</p>
          </section>
          <section id="retention">
            <h2>How long data is kept</h2>
            <p>Core command history, cached channel/member information, and installation records currently have no automatic age-based deletion schedule. They remain stored until removed through a verified deletion request or service maintenance. This includes records created by the original version of Kick.</p>
            <p>New team-ritual sessions, responses, blockers, recognition copies, rotation state, and delivery jobs expire after the channel’s selected 7, 30, or 90 days. Expired records are hidden from workflow views and deleted in bounded batches by the scheduler; physical deletion may be delayed during downtime or a backlog. Setup previews expire after 15 minutes. Channel settings and personal preferences remain until removed by a verified deletion request or service maintenance. This retention does not shorten core command history or Slack’s own message retention.</p>
            <p>Tokens are used while an installation is authorized. Uninstalling the app revokes its Slack access, but does not automatically erase all stored workflow data, installation archives, or logs. Request deletion separately using the contact details below.</p>
            <p>Operational logs are retained according to the hosting provider’s configured log-retention period. Support correspondence is kept until the request is resolved and as needed to document its handling; you can request its deletion. Contact us if you need information about a specific record or retention period.</p>
            <p>Deleting data from Kick does not delete messages already posted to Slack or copies retained by other workspace members. Slack workspace retention and deletion controls apply to those copies.</p>
          </section>
          <section id="rights">
            <h2>Request access, an export, or deletion</h2>
            <p>Any individual may request access to, correction of, an export of, or deletion of their personal data held by Kick. Workspace owners may also request an export or deletion of their workspace’s Kick records. You do not need a separate Kick account or to uninstall first to contact us.</p>
            <p>Email <a href="mailto:kick.bot.help@gmail.com?subject=Kick%20data%20request">kick.bot.help@gmail.com</a> with the subject “Kick data request.” Tell us which action you want, your Slack workspace name or ID, and your Slack member ID if the request concerns your own data. We will verify your identity and authority before providing or deleting records, and will not disclose other members’ data to an unauthorized requester.</p>
            <p>We aim to provide requested access or an export within 14 days and confirm deletion within 30 days after verification. If a request requires more time, or specific information must be retained for a legal reason, we will explain this when responding. Exports can be provided in a machine-readable format so you can transfer your data.</p>
          </section>
          <section id="contact-privacy">
            <h2>Contact and policy changes</h2>
            <p>For questions about this policy or how your data is handled, contact the Kick Bot team at <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>. Our <a href="/support">support page</a> is also available without signing in.</p>
            <p>We will publish policy changes on this page and update the date above. Review this policy before installing the app or sharing information through it.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
