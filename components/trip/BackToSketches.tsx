"use client";

import Link from "next/link";
import { rememberTrip } from "@/lib/scrollMemory";

/*
  목록으로 돌아가는 길.

  돌아갈 때 "이 여행 앞에 세워 달라"고 적어 둔다. 위 띠의 "내 스케치"를
  눌러 온 사람은 처음부터 보려는 것이라 아무 표시도 남기지 않는다.

  자리(픽셀)가 아니라 여행을 적는 이유는 lib/scrollMemory 에 적어 두었다.
  요는, 상세로 오는 길이 목록 말고도 여럿이라는 것이다.
*/
export function BackToSketches({ tripId }: { tripId: string }) {
  return (
    <Link
      href="/trips"
      onClick={() => rememberTrip(tripId)}
      className="self-start text-[15px] font-medium text-accent hover:text-accent-hover"
    >
      ← 내 스케치
    </Link>
  );
}
