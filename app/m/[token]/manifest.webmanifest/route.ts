import { isMailboxToken } from "@/lib/mailbox";

/*
  책장마다 따로 있는 홈 화면 아이콘 정보. 부모님이 "홈 화면에 추가"를 하면 이 책장을 바로 여는
  "가족 책장" 아이콘이 된다(평소 서비스의 아이콘 정보와 시작 주소만 다르다).
*/
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isMailboxToken(token)) return new Response("not found", { status: 404 });

  const manifest = {
    name: "가족 책장",
    short_name: "책장",
    description: "가족이 보낸 여행 엽서를 받아 봐요.",
    lang: "ko",
    start_url: `/m/${token}`,
    scope: `/m/${token}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0071e3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" },
  });
}
