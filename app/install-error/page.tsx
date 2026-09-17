import type { Metadata } from "next";
import { SlackButton } from "../ui/SiteChrome";

export const metadata: Metadata = {
  title: "Installation not confirmed",
  alternates: { canonical: "/install-error" },
  robots: { index: false, follow: false },
};
export default function InstallErrorPage() {
  return <main id="main-content" className="legal-main section-shell">
    <header className="legal-hero"><p className="legal-date">Kick for Slack</p><h1>We couldn’t confirm your installation.</h1><p>Authorization may have been cancelled, the link may have expired, or the installation could not be saved. Nothing on this page confirms a successful installation.</p></header>
    <section className="integration-details"><h2>Try again safely</h2><p>Choose the correct workspace and complete Slack’s permission screen. Your workspace may require administrator approval.</p><p><SlackButton /></p><p>If you already see Kick in your workspace, try <code>/sync -h</code> before reinstalling. If the problem continues, <a href="/support">contact support</a> with the workspace name and approximate time. Do not send tokens or passwords.</p><p><a href="/get-started">Read the getting-started guide</a> · <a href="/privacy">Privacy policy</a></p></section>
  </main>;
}
