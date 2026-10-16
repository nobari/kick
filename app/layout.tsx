import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteFooter, SiteHeader } from "./ui/SiteChrome";
import AnalyticsConsent from "./ui/AnalyticsConsent";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://kick.bozmoz.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kick — Team Coordination in Slack, Without the Chasing",
    template: "%s | Kick Bot",
  },
  description:
    "Bring plans, people and progress together in Slack. Kick offers 14 commands for check-ins, tasks, polls, reports, planning, approvals and more. Free core workflows.",
  applicationName: "Kick Bot",
  authors: [{ name: "Kick Bot" }],
  creator: "Kick Bot",
  publisher: "Kick Bot",
  category: "productivity",
  keywords: [
    "Slack standup bot",
    "async standup Slack",
    "Slack scrum bot",
    "Slack kudos bot",
    "team productivity bot",
    "random team picker",
  ],
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/assets/favicon.ico" },
      { url: "/assets/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/assets/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Kick Bot",
    title: "Kick — Good teamwork. Less chasing.",
    description:
      "Plans, people and progress, together in Slack. Fourteen commands. No separate account.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Kick Bot for Slack" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kick — Good teamwork. Less chasing.",
    description: "Plans, people and progress, together in Slack. Fourteen commands. No separate account.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: { "slack-app-id": "A044BL326B1" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#11152a" },
  ],
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        {children}
        <SiteFooter />
        <AnalyticsConsent />
      </body>
    </html>
  );
}
