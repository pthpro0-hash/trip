import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const SITE_NAME = "여행세상";
const DESCRIPTION =
  "2025~2026 한국관광 100선 121곳을 지역·테마·상황으로 검색하고, 사진과 이용 안내까지 한 번에 확인하세요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yeohaeng-sesang.vercel.app"),
  // 상세 페이지가 자기 제목을 주면 뒤에 서비스 이름이 붙는다.
  title: { default: `${SITE_NAME} | 한국관광 100선 추천`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "ko_KR",
    title: `${SITE_NAME} | 한국관광 100선 추천`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
      <body className="min-h-screen bg-bg text-text antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
