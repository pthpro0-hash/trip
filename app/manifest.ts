import type { MetadataRoute } from "next";

/*
  홈 화면에 추가했을 때의 모습. 주소창 없이 전체 화면으로 열리고, 첫 화면은 내 여행(지도)이다.
  아이콘은 scripts/make-icons.mjs 가 로고(components/layout/Logo.tsx)로 만든다.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "내 여행 스케치",
    short_name: "여행 스케치",
    description: "사진만 고르면 다녀온 길이 지도 위에 한 장의 그림이 돼요.",
    lang: "ko",
    start_url: "/?v=sketch",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0071e3",
    categories: ["travel", "photo"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
