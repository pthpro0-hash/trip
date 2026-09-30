"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { REGIONS } from "@/lib/regions";
import { spotFocus } from "@/lib/scrollMemory";
import type { Region } from "@/lib/types";

/*
  왔던 목록으로 돌아가는 길.

  여행지 상세는 둘러보기에서도, 권역별에서도, 주소를 바로 열어서도
  들어온다. 어디로 돌려보낼지는 상세가 알 수 없어, 떠나올 때 카드가
  적어 둔 것을 읽는다. 적힌 것이 없으면 둘러보기로 보낸다 — 주소를
  바로 연 사람에게는 그게 첫 화면이다.

  돌아갈 때 "이 여행지 앞에 세워 달라"고 표시한다. 위 띠를 눌러 나간
  사람은 처음부터 보려는 것이라 아무 표시도 남기지 않는다.
*/

/*
  여행 100선은 주소에 갈래를 적어 둔다. 맨 "/" 는 지난번에 고른 쪽을
  열기 때문에, 내 여행에서 시작하는 사람이 "← 여행 100선"을 눌렀는데
  내 지도가 뜨는 일이 생긴다.
*/
const HOME = { href: "/?v=spots", label: "← 여행 100선" };

/** 적어 둔 주소에서 돌아갈 곳의 이름을 읽는다. */
function placeOf(from: string | null): { href: string; label: string } {
  if (!from) return HOME;

  const region = REGIONS.find((name: Region) => from.startsWith(`/regions/${encodeURIComponent(name)}`));
  if (region) return { href: from, label: `← ${region}` };
  if (from.startsWith("/regions")) return { href: from, label: "← 권역별" };
  // 내 여행 지도에서 100선을 겹쳐 보다가 들어온 사람은 지도로 돌려보낸다.
  if (from.startsWith("/?v=sketch")) return { href: "/?v=sketch", label: "← 내 여행" };
  // 그 밖의 첫 화면은 100선 쪽이다 — 여행지 카드는 100선에만 있다.
  if (from === "/" || from.startsWith("/?")) return HOME;
  if (from.startsWith("/")) return { href: from, label: HOME.label };
  return HOME;
}

export function BackToBrowse({ spotId }: { spotId: string }) {
  /*
    서버에는 저장소가 없다. 처음에는 둘러보기로 그려 두고, 화면에
    붙고 나서 적어 둔 곳으로 바꾼다. 사람이 누르는 것은 언제나 그
    다음이라 눌렀을 때는 이미 제 주소다.

    화면 밖의 값을 읽는 일이라 그에 맞는 고리를 쓴다. 한 번 적히면
    이 화면이 사는 동안 바뀌지 않으므로 지켜볼 것은 없다.
  */
  const from = useSyncExternalStore(
    () => () => undefined,
    () => spotFocus.from(),
    () => null,
  );
  const place = placeOf(from);

  return (
    <Link
      href={place.href}
      onClick={() => spotFocus.remember(spotId)}
      className="self-start text-[15px] font-medium text-accent hover:text-accent-hover"
    >
      {place.label}
    </Link>
  );
}
