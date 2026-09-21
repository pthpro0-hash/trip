"use client";

import Link from "next/link";
import Image from "next/image";
import type { Spot } from "@/lib/types";
import { getSpotThumbnail } from "@/lib/media";
import { formatDistance } from "@/lib/geo";
import { HighlightedText } from "./HighlightedText";
import { SaveButton } from "./SaveButton";

interface SpotCardProps {
  spot: Spot;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Current search term, highlighted wherever it appears in the card. */
  query?: string;
  /** 내 위치에서의 직선거리. "내 주변"이 켜져 있을 때만 들어온다. */
  distanceKm?: number;
}

// Photo first, then the name — the photo is what tells someone whether they
// want to go. The whole image is the map-select target; the title links
// through to the detail page.
export function SpotCard({ spot, selected, onSelect, query, distanceKm }: SpotCardProps) {
  const thumbnail = getSpotThumbnail(spot.id);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-surface transition ${
        selected ? "ring-2 ring-accent" : "ring-1 ring-line"
      }`}
    >
      {/* 사진 버튼 안에 넣으면 버튼 안의 버튼이 되므로 형제로 둔다. */}
      <SaveButton spotId={spot.id} spotName={spot.name} />
      <button
        type="button"
        onClick={() => onSelect(spot.id)}
        aria-label={`${spot.name} 지도에서 보기`}
        className="relative block aspect-[16/10] w-full overflow-hidden bg-bg-subtle"
      >
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
      </button>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={`/spots/${spot.id}`}
            className="truncate text-[17px] font-semibold tracking-tight text-text hover:text-accent"
          >
            <HighlightedText text={spot.name} query={query} />
          </Link>
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

        <Link
          href={`/spots/${spot.id}`}
          className="mt-1 text-[13px] font-medium text-accent hover:text-accent-hover"
        >
          자세히 보기 →
        </Link>
      </div>
    </div>
  );
}
