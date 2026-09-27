"use client";

import Link from "next/link";
import type { Spot } from "@/lib/types";
import { spotFocus } from "@/lib/scrollMemory";
import { SaveButton } from "@/components/spot/SaveButton";

/*
  지도 위 100선 한 곳을 눌렀을 때.

  곧장 상세로 넘기지 않는다. 지도를 떠나면 "그 근처에 또 뭐가 있지"를
  볼 수 없다. 지도 위에 창으로 한 장 보여 주고, 담거나 자세히 보는
  것은 그 다음에 고른다.
*/

interface SpotPeekProps {
  spot: Spot;
  thumbnail: string | undefined;
}

export function SpotPeek({ spot, thumbnail }: SpotPeekProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 오른쪽 위는 창의 닫기 단추 자리다. */}
      <div className="pr-10">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-accent">한국관광 100선 · {spot.region}</p>
          <h2 className="truncate text-[20px] font-bold tracking-tight text-text">{spot.name}</h2>
        </div>
      </div>

      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element -- 한국관광공사 사진이라 주소가 이미 정해져 있다
        <img src={thumbnail} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />
      )}

      <p className="line-clamp-3 text-[14px] leading-relaxed text-text-muted">{spot.summary}</p>

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton spotId={spot.id} spotName={spot.name} variant="inline" />
        {/* 상세에서 "← 내 스케치"로 이 지도에 돌아오게 적어 둔다. */}
        <Link
          href={`/spots/${spot.id}`}
          onClick={() => spotFocus.rememberFrom("/?v=sketch")}
          className="rounded-full bg-bg-subtle px-4 py-2 text-[14px] font-medium text-accent transition hover:bg-accent-soft"
        >
          자세히 보기 →
        </Link>
      </div>
    </div>
  );
}
