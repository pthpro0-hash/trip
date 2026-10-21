import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { CollectionSync } from "@/components/auth/CollectionSync";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { RegisterServiceWorker } from "@/components/layout/RegisterServiceWorker";
import { FamilyBanner } from "@/components/family/FamilyBanner";
import { BottomNav, BottomNavSpace } from "@/components/layout/BottomNav";
import { PhotoLauncher } from "@/components/photo/PhotoLauncher";
import { UsageTracker } from "@/components/layout/UsageTracker";
import "./globals.css";

const SITE_NAME = "내 여행 스케치";
const TAGLINE = "사진으로 남기는 내 여행";
const DESCRIPTION =
  "사진만 고르면 날짜와 장소로 묶어 지도와 한 장 카드로 만들어 드려요. 갈 곳은 2025~2026 한국관광 100선 121곳에서 찾아요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://yeohaeng-sesang.vercel.app"),
  // 상세 페이지가 자기 제목을 주면 뒤에 서비스 이름이 붙는다.
  title: { default: `${SITE_NAME} | ${TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: DESCRIPTION,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "ko_KR",
    title: `${SITE_NAME} | ${TAGLINE}`,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  // 아이폰에서 홈 화면에 추가했을 때 앱처럼 전체 화면으로 열린다.
  appleWebApp: { capable: true, title: "여행 스케치", statusBarStyle: "default" },
};

// 폰의 위 상태 줄 색을 화면 바탕과 맞춘다(켜질 때 어색한 띠가 생기지 않게).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
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
      <body className="min-h-screen bg-page text-text antialiased">
        <SiteHeader />
        {/* 가족의 여행을 보는 중이면 누구의 것인지 늘 알린다. */}
        <FamilyBanner />
        {/* 폰에서는 아래에 탭이 있다. 내용이 그 밑에 가리지 않게 자리를 비워 둔다. */}
        <BottomNavSpace>{children}</BottomNavSpace>
        <BottomNav />
        {/* 이 기기의 목록과 계정의 목록을 이어 준다. 그리는 것은 없다. */}
        <CollectionSync />
        {/* [사진 고르기]를 누르면 사진첩이 곧바로 열리게 하는 숨은 입력칸. */}
        <PhotoLauncher />
        {/* 어떤 화면을 여는지 센다(로그인한 사람만, 이름만). 그리는 것은 없다. */}
        <UsageTracker />
        <Analytics />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
