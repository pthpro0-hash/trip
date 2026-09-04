import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행세상 | 한국관광 100선 추천",
  description: "2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-neutral-900">{children}</body>
    </html>
  );
}
