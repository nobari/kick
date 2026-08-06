import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kick Productivity Bot",
    short_name: "Kick Bot",
    description: "Async standups, kudos, team rewards, and fair random picks inside Slack.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf8",
    theme_color: "#11152a",
    icons: [
      { src: "/assets/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
