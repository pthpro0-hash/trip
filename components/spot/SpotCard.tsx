"use client";

import Link from "next/link";
import Image from "next/image";
import { spotFocus } from "@/lib/scrollMemory";
import type { Spot } from "@/lib/types";
import { getSpotThumbnail } from "@/lib/media";
import { formatDistance } from "@/lib/geo";
import { HighlightedText } from "./HighlightedText";
import { SaveButton } from "./SaveButton";

interface SpotCardProps {
  spot: Spot;
  /** 지도에서 이 곳을 고른 상태. */
  selected: boolean;
  /** Current search term, highlighted wherever it appears in the card. */
  query?: string;
  /** 내 위치에서의 직선거리. "내 주변"이 켜져 있을 때만 들어온다. */
  distanceKm?: number;
  /** 상세를 보고 돌아와 선 카드. 어디였는지 테로 알린다. */
  focused?: boolean;
}

/*
  사진이 먼저, 이름이 다음. 갈지 말지를 정하는 것은 사진이다.

  카드 어디를 눌러도 상세로 간다. 제목이나 "자세히 보기"를 정확히
  겨눠야 하면 손가락으로는 번번이 빗나간다.

  카드 전체를 링크로 감쌀 수는 없다 — 안에 "가고 싶은 곳" 단추가 있어
  링크 안에 단추가 들어가는 꼴이 된다. 그래서 카드 위에 투명한 링크를
  한 장 덮고, 단추만 그 위로 올린다.
*/
export function SpotCard({ spot, selected, query, distanceKm, focused }: SpotCardProps) {
  const thumbnail = getSpotThumbnail(spot.id);

  return (
    <div
      id={spotFocus.cardId(spot.id)}
      className={`group relative overflow-hidden rounded-2xl bg-surface transition ${
        selected || focused ? "ring-2 ring-accent" : "ring-1 ring-line"
      }`}
    >
      {/* 단추는 덮개 위로 올라와야 눌린다. */}
      <SaveButton spotId={spot.id} spotName={spot.name} />
      <div className="relative block aspect-[16/10] w-full overflow-hidden bg-bg-subtle">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 380px"
            className="object-cover transition duration-300 hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-text-faint">
            {spot.region}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] font-semibold tracking-tight text-text transition group-hover:text-accent">
            <HighlightedText text={spot.name} query={query} />
          </span>
          <span className="shrink-0 text-xs text-text-faint">
            {distanceKm === undefined ? spot.region : `${spot.region} · ${formatDistance(distanceKm)}`}
          </span>
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-text-muted">
          <HighlightedText text={spot.summary} query={query} />
        </p>

        <div className="flex flex-wrap gap-1 pt-0.5">
          {spot.seasons.map((season) => (
            <span
              key={season}
              className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
            >
              {season}
            </span>
          ))}
          {spot.foods.slice(0, 2).map((food) => (
            <span
              key={food}
              className="rounded-md bg-bg-subtle px-2 py-0.5 text-[11px] text-text-muted"
            >
              {food}
            </span>
          ))}
        </div>

        {/* 누를 곳이 여기라고 눈으로 알려 주는 표시. 실제로 누르는 것은 덮개다. */}
        <span className="mt-1 text-[13px] font-medium text-accent">자세히 보기 →</span>
      </div>

      {/*
        카드를 덮는 링크.

        떠나올 때 어디서 떠났는지 적어 둔다. 여행지 상세는 둘러보기에서도
        권역별에서도 열려 돌아갈 곳이 둘인데, 상세 혼자서는 알 수 없다.
      */}
      <Link
        href={`/spots/${spot.id}`}
        aria-label={`${spot.name} 자세히 보기`}
        onClick={() => spotFocus.rememberFrom(window.location.pathname + window.location.search)}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );
}
