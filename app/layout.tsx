import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const ibmPlexSansKr = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "여행세상 | 한국관광 100선 추천",
  description: "2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={ibmPlexSansKr.variable}>
      <body className="min-h-screen bg-bg text-text">{children}</body>
    </html>
  );
}
