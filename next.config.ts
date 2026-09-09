import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/firestore", "@slack/bolt"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "slack-kickbot.vercel.app" }],
        destination: "https://kick.bozmoz.com/:path*",
        permanent: true,
      },
    ];
  },
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: ["import", "global-builtin", "color-functions", "if-function"],
  },
};

export default nextConfig;
