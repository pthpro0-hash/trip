import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SpotsHome } from "@/components/home/SpotsHome";
import { StartSwitch } from "@/components/home/StartSwitch";
import { SketchHub } from "@/components/hub/SketchHub";
import { START_COOKIE, startOf } from "@/lib/start";

/*
  첫 화면. 내 스케치와 여행 100선, 두 갈래 중 하나를 연다.

  어느 쪽을 열지는 주소(?v=)가 먼저, 그다음 지난번에 고른 것(쿠키)이다.
  둘 다 없으면 여행 100선 — 처음 온 사람에게 내 스케치는 아직 빈 지도고,
  검색엔진이 보고 가는 것도 이쪽이다.
*/

export const metadata: Metadata = {
  // 갈래가 주소에 붙어도 검색엔진에는 한 화면으로 보이게.
  alternates: { canonical: "/" },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { v } = await searchParams;
  const start = startOf(typeof v === "string" ? v : undefined, (await cookies()).get(START_COOKIE)?.value);

  if (start === "sketch") {
    return <SketchHub switcher={<StartSwitch current="sketch" floating />} />;
  }
  return <SpotsHome switcher={<StartSwitch current="spots" />} />;
}
