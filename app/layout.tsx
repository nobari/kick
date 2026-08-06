import type { Metadata, Viewport } from "next";
import "../src/scss/styles.scss";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://slack-kickbot.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Kick Productivity Bot",
  description:
    "Organize standups, kudos, team picks, and more from inside Slack.",
  applicationName: "Kick Bot",
  icons: {
    icon: "/assets/favicon.ico",
    apple: "/assets/apple-touch-icon.png",
  },
  manifest: "/assets/site.webmanifest",
  openGraph: {
    title: "Kick Productivity Bot",
    description:
      "Organize standups, kudos, team picks, and more from inside Slack.",
    images: ["/assets/img/logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kick Productivity Bot",
    description:
      "Organize standups, kudos, team picks, and more from inside Slack.",
    images: ["/assets/img/logo.png"],
  },
  other: {
    "slack-app-id": "A044BL326B1",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#102644",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
