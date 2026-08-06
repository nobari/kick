import Image from "next/image";
import Link from "next/link";

const installUrl = "/api/slack/install";

function SlackMark() {
  return (
    <svg className="slack-mark" viewBox="0 0 122.8 122.8" aria-hidden="true">
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a"/>
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0"/>
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d"/>
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c0-7.1 5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e"/>
    </svg>
  );
}

export function SlackButton({ variant = "dark" }: { variant?: "dark" | "light" | "compact" }) {
  return <a className={`slack-button ${variant}`} href={installUrl}><SlackMark/><span>Add to Slack</span><span className="button-arrow" aria-hidden="true">↗</span></a>;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="Kick Bot home"><Image src="/assets/img/logo.png" width={42} height={42} alt="" priority/><span>Kick</span></Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/#workflows">Workflows</Link><Link href="/#how-it-works">How it works</Link><Link href="/#commands">Commands</Link><Link href="/#privacy">Privacy</Link><Link href="/#faq">FAQ</Link>
        </nav>
        <div className="header-action"><SlackButton variant="compact"/></div>
        <details className="mobile-nav">
          <summary aria-label="Open navigation"><span/><span/></summary>
          <nav aria-label="Mobile navigation"><Link href="/#workflows">Workflows</Link><Link href="/#how-it-works">How it works</Link><Link href="/#commands">Commands</Link><Link href="/#privacy">Privacy</Link><Link href="/#faq">FAQ</Link><SlackButton variant="compact"/></nav>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main section-shell">
        <div className="footer-brand"><Link className="brand inverse" href="/"><Image src="/assets/img/logo.png" width={44} height={44} alt=""/><span>Kick</span></Link><p>Better team rituals, right inside Slack.</p></div>
        <div className="footer-links"><strong>Product</strong><Link href="/#workflows">Workflows</Link><Link href="/#commands">Commands</Link><Link href="/#faq">FAQ</Link></div>
        <div className="footer-links"><strong>Trust</strong><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></div>
        <div className="footer-links"><strong>Get Kick</strong><a href={installUrl}>Add to Slack</a><a href="mailto:kick.bot.help@gmail.com">Contact us</a></div>
      </div>
      <div className="footer-bottom section-shell"><span>© 2026 Kick Bot</span><span>Made thoughtfully in Tokyo, Japan.</span></div>
    </footer>
  );
}
