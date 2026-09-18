import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행세상 | 한국관광 100선 추천",
  description: "2025~2026 한국관광 100선 데이터를 조건별로 필터링하고 지도에서 탐색하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/*
          Apple devices get their own system face from the --font-sans stack;
          this covers everyone else with a Korean typeface of the same
          character, and the stack falls back cleanly if the CDN is blocked.
        */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
