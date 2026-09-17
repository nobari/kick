import Image from "next/image";
import Link from "next/link";

const installUrl = "/api/slack/install";

export function SlackButton({ variant = "dark" }: { variant?: "dark" | "light" | "compact" }) {
  return (
    <a className={`slack-button-official ${variant}`} href={installUrl} aria-label="Add Kick to Slack">
      {/* Slack requires its official Add to Slack artwork to remain unmodified. */}
      <img
        alt="Add to Slack"
        height="40"
        width="139"
        src="https://platform.slack-edge.com/img/add_to_slack.png"
        srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
      />
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="Kick Bot home"><Image src="/assets/img/logo.png" width={42} height={42} alt="" priority/><span>Kick</span></Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/#workflows">Workflows</Link><Link href="/#how-it-works">How it works</Link><Link href="/#commands">Commands</Link><Link href="/privacy">Privacy policy</Link><Link href="/#faq">FAQ</Link>
        </nav>
        <div className="header-action"><SlackButton variant="compact"/></div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation"><span/><span/></summary>
          <nav aria-label="Mobile navigation"><Link href="/#workflows">Workflows</Link><Link href="/#how-it-works">How it works</Link><Link href="/#commands">Commands</Link><Link href="/privacy">Privacy policy</Link><Link href="/#faq">FAQ</Link><SlackButton variant="compact"/></nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main section-shell">
        <div className="footer-brand"><Link className="brand inverse" href="/"><Image src="/assets/img/logo.png" width={44} height={44} alt=""/><span>Kick</span></Link><p>Better team rituals for teams using Slack.</p></div>
        <div className="footer-links"><strong>Product</strong><Link href="/#workflows">Workflows</Link><Link href="/#commands">Commands</Link><Link href="/#faq">FAQ</Link></div>
        <div className="footer-links"><strong>Trust</strong><Link href="/privacy">Privacy policy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></div>
        <div className="footer-links"><strong>Get Kick</strong><a href={installUrl}>Add to Slack</a><a href="mailto:kick.bot.help@gmail.com">Contact us</a></div>
      </div>
      <div className="footer-bottom section-shell"><span>© 2026 Kick Bot · Independent third-party integration for Slack</span><span>Not affiliated with or endorsed by Slack.</span></div>
    </footer>
  );
}
