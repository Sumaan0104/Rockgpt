import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.202.168.121",
  ],

  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
        protocol: "https",
      },
    ],
  },

  poweredByHeader: false,

  devIndicators: false,

  typescript: {
    ignoreBuildErrors: true,
  },
};

let exportedConfig: NextConfig = nextConfig;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const botid = require("botid/next/config");
  if (typeof botid?.withBotId === "function") {
    exportedConfig = botid.withBotId(nextConfig);
  }
} catch {
  // botid optional wrapper fallback
}

export default exportedConfig;
