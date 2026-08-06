"use client";

import { useEffect, useState } from "react";

const installUrl = "/api/slack/install";

const navItems = [
  ["Features", "features"],
  ["About", "about"],
  ["Privacy", "privacy"],
  ["Terms", "terms"],
  ["Contact", "contact"],
] as const;

function Divider({ icon }: { icon: string }) {
  return (
    <div className="divider-custom" aria-hidden="true">
      <div className="divider-custom-line" />
      <div className="divider-custom-icon">{icon}</div>
      <div className="divider-custom-line" />
    </div>
  );
}

function SlackButton() {
  return (
    <a className="slack-btn" href={installUrl}>
      <svg
        aria-hidden="true"
        style={{ height: 24, width: 24, marginRight: 12 }}
        viewBox="0 0 122.8 122.8"
      >
        <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
        <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
        <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
        <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c0-7.1 5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
      </svg>
      Add to Slack
    </a>
  );
}

const features = [
  {
    slug: "help",
    title: "Help",
    description: (
      <>Ask for help at any time by adding <code>-h</code> to any command.</>
    ),
  },
  {
    slug: "sync",
    title: "Sync",
    description: (
      <>
        Collect everyone&apos;s updates for recurring meetings.
        <br /><br />
        • <code>/sync</code> to collect updates
        <br />
        • <code>/sync -r 7</code> to report on the team&apos;s last seven days. Replace 7 with any number from 1–30.
      </>
    ),
  },
  {
    slug: "kudos",
    title: "Kudos",
    description: (
      <>
        Give a teammate the appreciation they deserve.
        <br /><br />
        • <code>/kudos</code> to submit kudos
        <br />
        • <code>/kudos -r 7</code> to report on the last seven days
        <br />
        • <code>/kudos -s emoji=:tada:</code> to use any Slack emoji, including custom ones
      </>
    ),
  },
  {
    slug: "pick",
    title: "Pick",
    description: (
      <>
        Randomly choose one or more team members—and optionally ask a random question.
        <br /><br />
        • <code>/pick</code> to open the team picker
      </>
    ),
  },
  {
    slug: "coins",
    title: "Coins",
    description: (
      <>
        Send coins to a teammate.
        <br /><br />
        • <code>/coins</code> to send a coin
        <br />
        • <code>/coins -r 7</code> to report on the last seven days
        <br />
        • <code>/coins -s emoji=:tada:</code> to choose the workspace-wide coin emoji
      </>
    ),
  },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [torchFrame, setTorchFrame] = useState(0);

  useEffect(() => {
    const updateScrollState = () => {
      setScrolled(window.scrollY > 0);
      const frame = Math.min(9, Math.max(0, Math.ceil((window.scrollY / window.innerHeight) * 10)));
      setTorchFrame(frame);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <main id="page-top">
      <nav id="mainNav" className={`navbar navbar-expand-md bg-primary fixed-top${scrolled ? " navbar-shrink" : ""}`}>
        <div className="container">
          <a className="navbar-brand" href="#page-top" onClick={() => setMenuOpen(false)}>
            <img className="logo-header" src="/assets/img/logo.png" alt="Kick Bot" />
            Kick Bot
          </a>
          <button
            className="navbar-toggler text-uppercase fw-bold bg-primary text-white rounded"
            type="button"
            aria-controls="navbarResponsive"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu <span aria-hidden="true">☰</span>
          </button>
          <div id="navbarResponsive" className={`collapse navbar-collapse${menuOpen ? " show" : ""}`}>
            <ul className="navbar-nav ms-auto">
              {navItems.map(([label, id]) => (
                <li className="nav-item mx-1" key={id}>
                  <a className="nav-link rounded" href={`#${id}`} onClick={() => setMenuOpen(false)}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>

      <header className="masthead bg-primary text-white text-center">
        <div className="head-container">
          <div className="header-torch">
            <div className="header-torch-back">
              <img id="torch" src={`/assets/img/header/${torchFrame}.png`} alt="Kick lights the way for your team" />
            </div>
          </div>
          <div className="header-text-container">
            <div className="header-text">
              <h1 className="masthead-heading">
                👋 Hello, I&apos;m <a href={installUrl}><b>Kick Bot</b></a>.
              </h1>
              <p className="masthead-subheading">
                I work for productivity, to improve it by
                <br />
                <del>myself</del> <i>the team</i>. Let me organize your standups, kudos, and more—all in Slack.
              </p>
              <SlackButton />
            </div>
          </div>
        </div>
      </header>

      <section id="features" className="page-section features">
        <div className="container">
          <h2 className="page-section-heading text-center text-secondary mb-0">Selected Features</h2>
          <Divider icon="🔬" />
          {features.map((feature) => (
            <article className="row justify-content-center mb-5 feature" id={feature.slug} key={feature.slug}>
              <h3 className="text-center">{feature.title}</h3>
              <div className="col-md-8">
                <img className="img-fluid img-feat" src={`/assets/img/features/${feature.slug}.png`} alt={`${feature.title} in Slack`} />
              </div>
              <div className="col-md-4">
                <p className="lead feature-copy">{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="page-section">
        <div className="container">
          <h2 className="page-section-heading text-center text-secondary mb-0">About</h2>
          <Divider icon="😊" />
          <div className="row align-items-center g-4">
            <div className="col-lg-4 avatar-div">
              <a href={installUrl}><img src="/assets/img/logo.png" alt="Kick Bot logo" /></a>
            </div>
            <div className="col-lg-4">
              <p className="lead">
                Kick is here to boost your team&apos;s productivity. Organize daily syncs, recognize good work, and make team decisions without leaving Slack.
              </p>
            </div>
            <div className="col-lg-4 text-center"><SlackButton /></div>
          </div>
        </div>
      </section>

      <section id="privacy" className="page-section legal-section">
        <div className="container">
          <h2 className="page-section-heading text-center text-secondary mb-0">Privacy Policy</h2>
          <p className="mt-3"><b>Effective date:</b> November 30, 2022</p>
          <h3>What We Collect</h3>
          <p>On installation, Kick stores your Slack workspace name, workspace ID, and an authorization token that grants the permissions shown in Slack&apos;s installation screen.</p>
          <p>Kick does not save team members&apos; email addresses and will not contact team members by email.</p>
          <h3>Installation Permissions</h3>
          <p><b>Confirm your identity.</b> Kick uses this permission to verify your Slack account.</p>
          <p><b>Access information about your channels.</b> Kick reads member IDs in the channel where a command is used. This lets it select eligible members, post messages, and run team workflows. Member IDs may be used in stored workflow records.</p>
          <p><b>Add slash commands.</b> Kick uses this permission to make its Slack commands available.</p>
          <p><b>Access workspace profile information.</b> Kick uses profile information to exclude bots and determine which members are eligible for team actions.</p>
          <p><b>Send messages as Kick.</b> Kick posts workflow results, including scheduled or recurring team updates, in the relevant channel.</p>
          <h3>Data Retention</h3>
          <p>By installing Kick, you grant access to the data described on Slack&apos;s installation screen. Kick uses that data to provide its features, including information about the installer, workspace, channels, and channel members where Kick is used.</p>
          <p>Interactions with Kick may be logged for monitoring and error handling. Data is retained for up to three years.</p>
          <p>You may request an export or deletion by emailing <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>. We will provide an export within 14 days. After uninstalling Kick, include the business name, Slack workspace name, and a responsible party&apos;s contact details in a deletion request; confirmation will be provided within 30 days.</p>
        </div>
      </section>

      <section id="terms" className="page-section legal-section">
        <div className="container">
          <h2 className="page-section-heading text-center text-secondary mb-0">Terms of Use</h2>
          <p className="mt-3"><b>Effective date:</b> November 30, 2022</p>
          <h3>About These Terms</h3>
          <p>These terms apply to the Kick app and website. By using Kick, you agree to these terms and the privacy policy on this page.</p>
          <h3>Free Features</h3>
          <p>Kick includes a core set of free features, including Pick, Sync, Kudos, and related team workflows. Kick may add, change, or remove free features as the product evolves. Use a command&apos;s <code>-h</code> option to see its current features.</p>
          <h3>Your Account and Personal Data</h3>
          <p>To use Kick, you grant access to the information shown during installation. Kick uses that information to operate its workflows. Interactions may be logged for product improvement, monitoring, and error handling. You may request an export or deletion as described in the privacy policy.</p>
          <h3>Limitation of Liability</h3>
          <p>To the fullest extent permitted by law, Kick will not be liable for indirect, special, incidental, or consequential losses, including lost profit, business, revenue, savings, or opportunities. Kick is not liable for failures or delays caused by circumstances outside its reasonable control.</p>
          <h3>Your Responsibilities</h3>
          <ol>
            <li>Comply with the Slack Terms of Service and provide accurate information where required.</li>
            <li>Do not rely on Kick for emergencies or situations where failure could cause harm or loss.</li>
            <li>Do not infringe intellectual-property rights or use Kick for obscene, offensive, hateful, or inflammatory content.</li>
            <li>Do not damage, overload, reverse engineer, scrape, or abuse the service.</li>
            <li>Indemnify and hold harmless Kick and its representatives, employees, and owners to the extent permitted by law.</li>
          </ol>
          <h3>Miscellaneous</h3>
          <p>We may transfer our rights, obligations, and collected data as part of a sale of the Kick product. If a term is found unlawful or unenforceable, the remaining terms continue in effect.</p>
        </div>
      </section>

      <footer id="contact" className="footer text-center bg-primary">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-6">
              <h4 className="text-uppercase mb-3">Location</h4>
              <p className="lead mb-0">Tokyo, Japan</p>
            </div>
            <div className="col-lg-6">
              <h4>Contact &amp; Support</h4>
              <p>Get in touch with opportunities, suggestions, or ideas 👋</p>
              <a className="btn btn-outline-light" href="mailto:kick.bot.help@gmail.com">✉ kick.bot.help@gmail.com</a>
            </div>
          </div>
        </div>
      </footer>
      <div className="copyright bg-primary text-center text-white">
        <div className="container"><small>Copyright © Kick Bot 2026</small></div>
      </div>
    </main>
  );
}
