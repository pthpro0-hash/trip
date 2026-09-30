"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { tripFocus } from "@/lib/scrollMemory";
import { LIST_HREF } from "@/lib/nav";

/*
  내 여행으로 돌아가는 길.

  여행 상세는 지도에서도, 목록에서도, 연도 카드에서도 열린다. 돌아갈
  곳은 떠나올 때 적어 둔 것을 따른다 — 지도에서 왔으면 지도로, 목록에서
  왔으면 목록으로. 적힌 것이 없으면 목록이다.

  돌아갈 때 "이 여행 앞에 세워 달라"고 적어 둔다. 목록은 그 카드 앞에
  서고, 지도는 그 여행을 이어 그리로 날아간다. 자리(픽셀)가 아니라
  여행을 적는 이유는 lib/scrollMemory 에 있다.
*/

const LIST = LIST_HREF;

/** 우리 주소만 따라간다. 적힌 것이 바깥 주소면 목록으로. */
function backTo(from: string | null): string {
  return from && from.startsWith("/") && !from.startsWith("//") ? from : LIST;
}

/** 돌아갈 곳의 이름. 같은 이름 모아 보기에서 왔으면 그 곳 이름. */
export function backLabel(from: string | null): string {
  if (from?.startsWith("/places?")) {
    const name = new URLSearchParams(from.slice("/places?".length)).get("name");
    if (name) return `← ${name}`;
  }
  // 한장 요약의 "그해의 곳들"에서 왔으면 그 해의 한장 요약으로.
  if (from === "/sketch" || from?.startsWith("/sketch?")) return "← 한장 요약";
  return "← 내 여행";
}

export function BackToSketches({ tripId }: { tripId: string }) {
  /*
    저장소는 브라우저에만 있다. 서버는 목록으로 그려 두고, 화면에 붙은
    뒤에 적힌 곳으로 바꾼다. 사람이 누르는 것은 언제나 그 다음이다.
  */
  const from = useSyncExternalStore(
    () => () => undefined,
    () => tripFocus.from(),
    () => null,
  );

  return (
    <Link
      href={backTo(from)}
      onClick={() => tripFocus.remember(tripId)}
      className="self-start text-[15px] font-medium text-accent hover:text-accent-hover"
    >
      {backLabel(from)}
    </Link>
  );
}
