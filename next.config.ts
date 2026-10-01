import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Every spot photo comes from the Korea Tourism Organization's image host
    // (see lib/scripts/fetch-tour-media.ts).
    remotePatterns: [{ protocol: "https", hostname: "tong.visitkorea.or.kr" }],
  },
  async headers() {
    return [
      {
        // 서비스 워커 파일은 늘 새로 확인해야 새 판이 바로 이어진다.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
