"use client";

import type { MyView } from "@/lib/nav";
import { ViewSwitch } from "@/components/hub/ViewSwitch";
import { TripList } from "./TripList";

/*
  내 여행 — 목록 모습.

  모든 여행을 검색하고, 사람·시기로 거르고, 지운다. 지도 시트의 목록은 지금 지도에
  보이는 여행만 보여 주므로 이 일은 여기서 한다.

  예전에는 /trips 라는 따로 선 화면이었다. 이름("내 스케치")이 지도로 가는 위 띠의
  갈래와 겹쳤고, 같은 여행이 세 곳에 나뉘어 있었다. 지금은 지도와 한 화면의 두
  모습이고, 스위치로 오간다. 창 전체가 굴러가는 보통 페이지라 상세에서 돌아왔을 때
  보던 카드 앞에 서는 것(lib/scrollMemory)도 그대로 된다.
*/

export function TripArchive({ onView }: { onView: (next: MyView) => void }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">내 여행</h1>
          <p className="mt-1 text-[15px] text-text-muted">다녀온 곳을 모아 봅니다</p>
        </div>
        <ViewSwitch view="list" onChange={onView} />
      </div>
      <TripList />
    </main>
  );
}
