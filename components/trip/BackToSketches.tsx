"use client";

import Link from "next/link";
import { askRestore } from "@/lib/scrollMemory";

/*
  목록으로 돌아가는 길.

  돌아갈 때만 "그 자리로 데려가 달라"고 표시한다. 위 띠의 "내 스케치"를
  눌러 온 사람은 처음부터 보려는 것이라, 아무 때나 되살리면 오히려
  엉뚱한 자리로 끌려간다.
*/
export function BackToSketches() {
  return (
    <Link
      href="/trips"
      onClick={askRestore}
      className="self-start text-[15px] font-medium text-accent hover:text-accent-hover"
    >
      ← 내 스케치
    </Link>
  );
}
