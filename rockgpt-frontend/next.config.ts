import { withBotId } from "botid/next/config";
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

export default withBotId(nextConfig);