import type { Metadata } from "next";
import GettingStarted from "../ui/GettingStarted";

export const metadata: Metadata = {
  title: "Getting started",
  description: "Install Kick and run your first standup, kudos, coins, or teammate pick in Slack.",
  alternates: { canonical: "/get-started" },
};
export default function GettingStartedPage() {
  return <main id="main-content" className="legal-main section-shell">
    <header className="legal-hero"><p className="legal-date">Kick for Slack</p><h1>Your first team ritual.</h1><p>From installation to your first update, here is how to get started with Kick. These instructions are available to everyone, with no sign-in required.</p></header>
    <GettingStarted />
  </main>;
}
