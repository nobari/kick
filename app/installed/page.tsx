import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE, verifyReceipt } from "../../server/install-result";
import GettingStarted from "../ui/GettingStarted";

export const metadata: Metadata = {
  title: "Installation result",
  alternates: { canonical: "/installed" },
  robots: { index: false, follow: false },
};
export default async function InstalledPage() {
  const receipt = verifyReceipt((await cookies()).get(COOKIE)?.value, process.env.SLACK_STATE_SECRET);
  return <main id="main-content" className="legal-main section-shell">
    <header className="legal-hero">
      <p className="legal-date">Kick for Slack</p>
      <h1>{receipt ? "Kick is installed." : "Get started with Kick."}</h1>
      <p>{receipt ? "Slack authorization completed successfully and your installation was saved. Your team can now get started with Kick." : "We cannot confirm a recent installation in this browser. If you already installed Kick, open your workspace and try /sync. Otherwise, install it using the button below."}</p>
      {receipt?.organization ? <p>For an organization-wide installation, your Slack organization admin may first need to make Kick available to the intended workspaces in Slack’s app management settings.</p> : null}
    </header>
    <GettingStarted />
  </main>;
}
