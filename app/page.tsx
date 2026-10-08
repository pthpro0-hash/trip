import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SpotsHome } from "@/components/home/SpotsHome";
import { StartSwitch } from "@/components/home/StartSwitch";
import { SketchHub } from "@/components/hub/SketchHub";
import { START_COOKIE, startOf } from "@/lib/start";
import { hasSessionCookie } from "@/lib/sessionCookie";
import { viewOf } from "@/lib/nav";

/*
  첫 화면. 내 여행과 여행 100선, 두 갈래 중 하나를 연다.

  어느 쪽을 열지는 주소(?v=)가 먼저, 그다음 지난번에 고른 것(쿠키)이다.
  둘 다 없으면 여행 100선 — 처음 온 사람에게 내 여행은 아직 빈 지도고,
  검색엔진이 보고 가는 것도 이쪽이다.

  여행 100선 쪽의 맨 위는 처음 온 사람에게 이 서비스가 무엇을 해 주는지를 말한다(환영 영역). 예전에는 안내 창이
  둘 뜨고 본문에 같은 말을 하는 카드가 또 있었다 — 이제 안내 창은 없고, 그 말은 이 한 곳이 한다.
*/

export const metadata: Metadata = {
  // 갈래가 주소에 붙어도 검색엔진에는 한 화면으로 보이게.
  alternates: { canonical: "/" },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[]; y?: string | string[]; view?: string | string[] }>;
}) {
  const { v, y, view } = await searchParams;
  // 한장 요약의 "그해를 지도에서 보기"가 해를 적어 보낸다.
  const year = typeof y === "string" && /^\d{4}$/.test(y) ? y : undefined;
  const store = await cookies();
  const start = startOf(typeof v === "string" ? v : undefined, store.get(START_COOKIE)?.value);

  if (start === "sketch") {
    return (
      <SketchHub
        switcher={<StartSwitch current="sketch" floating />}
        initialYear={year}
        // 내 여행은 지도와 목록 두 모습이다. 어느 쪽으로 열지는 주소가 정한다.
        initialView={viewOf(typeof view === "string" ? view : undefined)}
      />
    );
  }
  return (
    <SpotsHome
      switcher={<StartSwitch current="spots" />}
      // 로그인한 사람일 수 있으면 맨 위 자리만 비워 두었다가 채운다(번쩍이거나 밀리지 않게). 값은 읽지 않고 이름만 본다.
      maybeSignedIn={hasSessionCookie(store.getAll().map((cookie) => cookie.name))}
    />
  );
}
