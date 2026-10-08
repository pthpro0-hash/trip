import type { Metadata } from "next";
import { cookies } from "next/headers";
import { SpotsHome } from "@/components/home/SpotsHome";
import { WelcomeDialog } from "@/components/home/WelcomeDialog";
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

  처음 온 사람(로그인 전)에게는 여행 100선 위에 환영 팝업 하나가 뜬다(WelcomeDialog) — 이 서비스가 무엇을 해 주는지를
  한 번 말하고, "오늘 그만 보기"를 누르면 오늘은 다시 안 뜬다. 예전에는 안내 창이 둘이고 어느 화면에서든 떴다. 이제
  하나이고, 이 화면에서만 뜬다. 한때 팝업 대신 맨 위에 환영 영역을 넣었더니 아래 100선이 밀려 내려가 혼잡해 보였다.
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
  const maybeSignedIn = hasSessionCookie(store.getAll().map((cookie) => cookie.name));
  /*
    지난번에 고른 갈래(내 여행)는 로그인했을 수 있는 사람에게만 따른다. 로그인하지 않은 사람에게 내 여행은 보여 줄 것이
    없는 빈 지도다 — 지도가 화면을 다 차지하고 안내는 작은 시트 하나뿐이다. 로그아웃했거나 세션이 끝난 사람이 그 빈
    지도로 열리면 환영 팝업을 못 본다. 탭을 눌러 주소에 갈래(?v=)가 적혔으면 그것은 따른다.
  */
  const start = startOf(typeof v === "string" ? v : undefined, maybeSignedIn ? store.get(START_COOKIE)?.value : undefined);

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
    <>
      <SpotsHome
        switcher={<StartSwitch current="spots" />}
        // 로그인한 사람일 수 있으면 "내 여행 한 줄" 자리만 비워 두었다가 채운다(번쩍이거나 밀리지 않게). 값은 읽지 않고 이름만 본다.
        maybeSignedIn={maybeSignedIn}
      />
      {/* 로그인 전 첫 방문자에게만, 브라우저에서 뜬다. 내 여행(지도)에는 시트가 이미 같은 말을 하니 두지 않는다. */}
      <WelcomeDialog />
    </>
  );
}
