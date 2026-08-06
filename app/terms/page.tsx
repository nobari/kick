import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that apply when installing or using Kick Bot for Slack.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main id="main-content" className="legal-main section-shell">
      <header className="legal-hero">
        <p className="legal-date">Effective November 30, 2022</p>
        <h1>Terms of use</h1>
        <p>These terms apply to the Kick Slack app and website. By installing or using Kick, you agree to them.</p>
      </header>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label="Terms sections">
          <strong>On this page</strong>
          <a href="#service">The service</a><a href="#account">Your account</a><a href="#responsibilities">Responsibilities</a><a href="#availability">Availability</a><a href="#liability">Liability</a><a href="#general">General terms</a>
        </nav>
        <div className="legal-content">
          <section id="service"><h2>The service</h2><p>Kick provides Slack-based team workflows including, but not limited to, async standups, random picks, kudos, coins, and related reports.</p><p>Kick includes a core set of free features. Features may be added, changed, or removed as the product evolves. Use a command’s <code>-h</code> option for its current behavior.</p></section>
          <section id="account"><h2>Your Slack account and data</h2><p>To use Kick, you grant the permissions displayed during Slack’s installation flow. You represent that you are authorized to install and use Kick in the relevant workspace.</p><p>Kick uses workspace data as described in the <a href="/privacy">privacy policy</a>. You are responsible for the content you submit through Kick and for configuring workspace access appropriately.</p></section>
          <section id="responsibilities"><h2>Your responsibilities</h2><ol><li>Follow Slack’s terms and all laws that apply to your use of Kick.</li><li>Do not use Kick for emergencies or situations where a delay or failure could cause harm or material loss.</li><li>Do not submit unlawful, abusive, hateful, or infringing content.</li><li>Do not overload, disrupt, reverse engineer, scrape, or attempt unauthorized access to the service.</li><li>Provide accurate information when requesting support, an export, or deletion.</li></ol></section>
          <section id="availability"><h2>Availability and changes</h2><p>Kick is provided on an “as available” basis. We may maintain, suspend, or discontinue all or part of the service. We do not promise that Kick will be uninterrupted or error-free.</p><p>We may update these terms when the service or applicable requirements change. Continued use after an update means you accept the revised terms.</p></section>
          <section id="liability"><h2>Limitation of liability</h2><p>To the fullest extent permitted by law, Kick and its operators will not be liable for indirect, special, incidental, consequential, or punitive damages, or for lost profit, business, revenue, savings, data, or opportunities.</p><p>Kick is not liable for a failure or delay caused by circumstances outside its reasonable control, including Slack or third-party service outages.</p></section>
          <section id="general"><h2>General terms</h2><p>We may transfer our rights, obligations, and relevant data as part of a sale or transfer of the Kick product. If a term is found unlawful or unenforceable, the remaining terms continue in effect.</p><p>Questions about these terms can be sent to <a href="mailto:kick.bot.help@gmail.com">kick.bot.help@gmail.com</a>.</p></section>
        </div>
      </div>
    </main>
  );
}
