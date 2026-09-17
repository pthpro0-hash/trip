import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Every spot photo comes from the Korea Tourism Organization's image host
    // (see lib/scripts/fetch-tour-media.ts).
    remotePatterns: [{ protocol: "https", hostname: "tong.visitkorea.or.kr" }],
  },
};

export default nextConfig;
