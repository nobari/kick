import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://slack-kickbot.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-06T00:00:00.000Z");
  return [
    { url: siteUrl, lastModified, changeFrequency: "monthly", priority: 1, images: [`${siteUrl}/assets/img/logo.png`] },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/support`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
