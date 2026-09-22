import Image from "next/image";
import { SlackButton } from "./SiteChrome";
import RitualFeatures from "./RitualFeatures";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://kick.bozmoz.com";

const workflows = [
  {
    id: "sync",
    eyebrow: "Async standups",
    title: "Turn daily updates into team clarity.",
    description:
      "Kick collects yesterday, today, blockers, mood, and optional kudos in one focused Slack modal. Review recent updates whenever the team needs context.",
    command: "/sync",
    detail: "Use /sync -r 7 for a seven-day report.",
    image: "/assets/img/features/sync.png",
    imageWidth: 512,
    imageHeight: 932,
    alt: "Kick Sync form in Slack with fields for mood, yesterday, today, blockers, and kudos",
  },
  {
    id: "kudos",
    eyebrow: "Recognition",
    title: "Make appreciation visible.",
    description:
      "Send specific kudos while the good work is still fresh. Teams can choose their own celebration emoji and look back at recent recognition.",
    command: "/kudos",
    detail: "Use /kudos -r 7 to review recent kudos.",
    image: "/assets/img/features/kudos.png",
    imageWidth: 512,
    imageHeight: 407,
    alt: "Kick Kudos form in Slack for selecting teammates and explaining why",
  },
  {
    id: "pick",
    eyebrow: "Fair participation",
    title: "Pick people without the awkward pause.",
    description:
      "Randomly choose one or more eligible channel members for a task or question. For recurring responsibilities, /pick rotate uses least-recent selection in a configured team ritual.",
    command: "/pick",
    detail: "Choose the group, number of people, and optional question.",
    image: "/assets/img/features/pick.png",
    imageWidth: 512,
    imageHeight: 514,
    alt: "Kick random picker in Slack with selection count and random question option",
  },
  {
    id: "coins",
    eyebrow: "Team rewards",
    title: "Create a lightweight reward ritual.",
    description:
      "Send a coin with a short explanation, then use reports to see the contributions your team has celebrated over time.",
    command: "/coins",
    detail: "Use /coins -s emoji=:sparkles: to set the team’s coin.",
    image: "/assets/img/features/coins.png",
    imageWidth: 512,
    imageHeight: 414,
    alt: "Kick Coins form in Slack for sending a coin with an explanation",
  },
] as const;

const faqs = [
  {
    question: "What is Kick Bot for Slack?",
    answer:
      "Kick is an independent Slack app for check-ins, team kudos, virtual rewards, fair picks, and opt-in team rituals. Use slash commands, focused forms, and a personal App Home without a separate account or external dashboard.",
  },
  {
    question: "How do Slack standups work with Kick?",
    answer:
      "Run /sync in a public Slack channel. Kick opens a form for mood, yesterday’s work, today’s plan, blockers, and optional kudos. Use /sync -r followed by a number from 1 to 30 to review recent team updates.",
  },
  {
    question: "Which Slack commands does Kick provide?",
    answer:
      "The main commands are /sync for standups, /kudos for recognition, /coins for team rewards, and /pick for random selection. Add -h to a command to see its current help.",
  },
  {
    question: "Does Kick require a separate account?",
    answer:
      "No. Kick uses Slack’s installation and identity flow. Team members use it directly inside Slack without creating another login or sharing their email address with Kick.",
  },
  {
    question: "Is Kick free?",
    answer:
      "Kick includes its core team workflows for free. There is no separate paid account required to install and try the app in a Slack workspace.",
  },
  {
    question: "How do scheduled check-ins and private reminders work?",
    answer:
      "Use /sync setup to choose participants, questions, weekdays, a time zone, and a digest time. Review and confirm before enabling. Scheduled delivery is checked every 15 minutes when activated. Private reminders and helper follow-ups require Slack permission approval and reinstall consent; they are not yet available through the published installation flow.",
  },
  {
    question: "Is a fair rotation the same as a random pick?",
    answer:
      "No. /pick selects randomly. /pick rotate selects the least recently chosen eligible participant from an enabled channel workflow. You can exclude people for one turn without removing them from the rotation. Rotation results are delivered on the next scheduler run.",
  },
  {
    question: "What Slack data does Kick store?",
    answer:
      "Kick stores the workspace information and authorization needed to operate, plus workflow records such as submitted standups and recognition. It does not store team members’ email addresses. See the privacy policy for retention and deletion details.",
  },
] as const;

function Icon({ name }: { name: "sync" | "kudos" | "pick" | "coins" | "shield" | "bolt" | "people" }) {
  const paths = {
    sync: <><path d="M6 8h12M6 12h8M6 16h10"/><path d="m16 15 2 2 4-5"/></>,
    kudos: <><path d="M12 21s-7-4.6-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.4-7 11-7 11Z"/><path d="m8 3 .7 1.6L10 5.3l-1.3.7L8 7.5 7.3 6 6 5.3l1.3-.7L8 3Z"/></>,
    pick: <><path d="M7 7h10v10H7z"/><path d="m4 4 3 3m10 10 3 3m0-16-3 3M7 17l-3 3"/></>,
    coins: <><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  };

  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SlackPreview() {
  return <figure className="product-screenshot">
    <Image src="/assets/img/features/sync.png" width={512} height={932} alt="Kick standup form in Slack" sizes="(max-width: 340px) 90vw, 300px" loading="eager" />
    <figcaption>The standup form, opened with <code>/sync</code>.</figcaption>
  </figure>;
}

export default function HomePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Kick Bot",
        alternateName: "Kick Productivity Bot",
        description: "An independent Slack app for team check-ins, blockers, kudos, and fair rotations, with opt-in schedules and an App Home.",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#app`,
        name: "Kick Bot",
        url: siteUrl,
        image: `${siteUrl}/assets/img/logo.png`,
        description: "Run async standups, share kudos, send team coins, and make fair random picks without leaving Slack.",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Team collaboration and productivity",
        operatingSystem: "Slack",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: ["Async Slack standups", "Kudos and peer recognition", "Virtual team coins", "Random team member picker", "Guided channel setup", "Custom check-in templates", "Blocker tracking", "Membership-aware App Home", "Aggregate team insights"],
        author: { "@type": "Organization", name: "Kick Bot" },
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <main id="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Team standups<br/>in Slack.</h1>
          <p className="hero-lede">Use Kick to share updates, track blockers, thank teammates, and rotate responsibilities. Everything stays in your workspace.</p>
          <div className="hero-actions">
            <SlackButton />
            <a className="text-link" href="#workflows">See how Kick works</a>
          </div>
          <p className="installation-disclosure">Before installing, read our <a href="/privacy">Privacy policy</a> to learn what Slack data Kick collects, where it is stored, and how to request deletion. <a href="/support">Get support</a>.</p>
          <ul className="trust-list" aria-label="Product highlights">
            <li>Free core workflows</li>
            <li>No separate account</li>
          </ul>
        </div>
        <div className="hero-visual"><SlackPreview /></div>
      </section>

      <section className="proof-strip" aria-label="Kick’s core outcomes">
        <div className="section-shell proof-grid">
          <div><Icon name="bolt"/><strong>Less ceremony</strong><span>One command starts each workflow.</span></div>
          <div><Icon name="people"/><strong>More participation</strong><span>Quiet teammates get an equal path in.</span></div>
          <div><Icon name="shield"/><strong>Fewer tools</strong><span>Slack stays the home for team rituals.</span></div>
        </div>
      </section>

      <section className="intro-section section-shell" aria-labelledby="why-kick">
        <div className="section-heading">
          <p className="kicker">Why Kick</p>
          <h2 id="why-kick">Keep team updates in one place.</h2>
        </div>
        <div className="intro-copy">
          <p>Team rituals are useful. Chasing updates, choosing a volunteer, and remembering to recognize good work are not.</p>
          <p>Kick makes those moments consistent and lightweight, with clear prompts inside the place your team already works.</p>
        </div>
      </section>

      <RitualFeatures />

      <section id="workflows" className="workflows-section" aria-labelledby="workflows-title">
        <div className="section-shell">
          <div className="section-heading centered">
            <p className="kicker">The familiar essentials</p>
            <h2 id="workflows-title">Four commands for everyday teamwork.</h2>
            <p>Every workflow opens a focused Slack experience and returns the result where the team can act on it.</p>
          </div>
          <div className="workflow-list">
            {workflows.map((workflow, index) => (
              <article className={`workflow-row${index % 2 ? " reverse" : ""}`} id={workflow.id} key={workflow.id}>
                <div className="workflow-copy">
                  <p className="workflow-eyebrow">{workflow.eyebrow}</p>
                  <h3>{workflow.title}</h3>
                  <p>{workflow.description}</p>
                  <div className="command-note"><code>{workflow.command}</code><span>{workflow.detail}</span></div>
                </div>
                <div className={`workflow-visual ${workflow.id}`}>
                  <Image src={workflow.image} width={workflow.imageWidth} height={workflow.imageHeight} alt={workflow.alt} sizes="(max-width: 700px) 88vw, 480px" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-section section-shell" aria-labelledby="how-title">
        <div className="section-heading centered">
          <p className="kicker">How it works</p>
          <h2 id="how-title">Get started with Kick.</h2>
        </div>
        <ol className="steps">
          <li><h3>Add Kick to Slack</h3><p>Choose your workspace and approve Slack’s permissions. After a successful installation, Kick shows a confirmation page with your next steps. No separate Kick account is required.</p></li>
          <li><h3>Run a command</h3><p>Start with <code>/sync</code>, <code>/kudos</code>, <code>/coins</code>, or <code>/pick</code> in a public channel.</p></li>
          <li><h3>Share with your team</h3><p>Fill in the form and submit it to post the result in your channel.</p></li>
        </ol>
        <div className="integration-details">
          <h3>What happens inside your Slack workspace?</h3>
          <p>Already installed? Follow our <a href="/get-started">step-by-step getting-started guide</a> to run your first command and troubleshoot setup.</p>
          <p>After an authorized workspace member installs Kick through Slack’s permission screen, teammates can run <code>/sync</code> in a public channel. A Slack form collects yesterday’s work, today’s plan, blockers, mood, and optional kudos. Submitting it posts an update in that channel; <code>/sync -r 7</code> retrieves a seven-day report.</p>
          <p><code>/kudos</code> and <code>/coins</code> let you select teammates and explain their contribution, then share the recognition in Slack. Coins are virtual recognition points, not money. <code>/pick</code> selects eligible channel members at random and posts the result for your team.</p>
          <p>Kick uses Slack authorization and member/channel identifiers to connect each action to the correct workspace. Workflow records are stored in Postgres hosted by Neon, and the app runs on Vercel. There is no separate Kick login, external dashboard, or paid service account required for these core features.</p>
          <p>Start in a test channel: submitted updates and recognition may be visible to other people in that conversation. Type <code>/sync -h</code> for help, or <a href="/support">contact support</a>. Read the <a href="/privacy">full privacy policy</a> before sharing personal or sensitive information.</p>
        </div>
      </section>

      <section id="commands" className="commands-section" aria-labelledby="commands-title">
        <div className="section-shell commands-grid">
          <div className="commands-intro">
            <p className="kicker light">Command reference</p>
            <h2 id="commands-title">Find the command you need.</h2>
            <p>Add <code>-h</code> to any command for contextual help in Slack.</p>
          </div>
          <table className="command-table">
            <caption className="visually-hidden">Kick Slack command reference</caption>
            <tbody>
              <tr><th scope="row"><code>/sync</code></th><td>Submit a standup update</td></tr>
              <tr><th scope="row"><code>/sync -r 7</code></th><td>Review the last seven days</td></tr>
              <tr><th scope="row"><code>/sync setup</code></th><td>Configure, preview, and confirm a channel ritual</td></tr>
              <tr><th scope="row"><code>/sync checkin</code></th><td>Answer the current ritual’s questions</td></tr>
              <tr><th scope="row"><code>/sync home</code></th><td>Refresh your Kick Home tab</td></tr>
              <tr><th scope="row"><code>/sync preferences</code></th><td>Set quiet hours, leave, and reminder preferences</td></tr>
              <tr><th scope="row"><code>/kudos</code></th><td>Recognize a teammate</td></tr>
              <tr><th scope="row"><code>/coins</code></th><td>Send a team coin</td></tr>
              <tr><th scope="row"><code>/pick</code></th><td>Choose one or more people fairly</td></tr>
              <tr><th scope="row"><code>/pick rotate</code></th><td>Queue a least-recent team pick in an enabled ritual</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="privacy" className="privacy-section section-shell" aria-labelledby="privacy-title">
        <div className="privacy-card">
          <div className="privacy-copy">
            <p className="kicker">Your Slack data</p>
            <h2 id="privacy-title">Know what you share before you install.</h2>
            <p>Kick processes Slack installation details, member and channel identifiers, and the updates you submit. Neon Postgres stores app records; Vercel hosts the service. Our English-language policy explains data use, storage, retention, recovery copies, and access or deletion requests.</p>
            <a className="text-link dark" href="/privacy">Read the privacy policy <span aria-hidden="true">→</span></a>
          </div>
          <ul className="privacy-points">
            <li><Icon name="shield"/><div><strong>No separate login</strong><span>Slack handles identity and installation.</span></div></li>
            <li><Icon name="people"/><div><strong>No stored member emails</strong><span>Kick is built around Slack IDs, not email lists.</span></div></li>
            <li><Icon name="bolt"/><div><strong>Clear deletion path</strong><span>Individuals and workspace owners can request access, an export, or deletion.</span></div></li>
          </ul>
        </div>
      </section>

      <section id="faq" className="faq-section section-shell" aria-labelledby="faq-title">
        <div className="faq-heading">
          <p className="kicker">Questions, answered</p>
          <h2 id="faq-title">What teams ask before installing Kick.</h2>
          <p>Need something else? <a href="/support">Visit support</a>.</p>
        </div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary>{faq.question}<span aria-hidden="true"/></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta section-shell" aria-labelledby="cta-title">
        <h2 id="cta-title">Try Kick with your team.</h2>
        <p>Bring standups, recognition, and fair team decisions into Slack.</p>
        <SlackButton variant="light" />
      </section>
    </main>
  );
}
