"use client";

import Link from "next/link";
import type { Spot } from "@/lib/types";

interface SpotCardProps {
  spot: Spot;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function SpotCard({ spot, selected, onSelect }: SpotCardProps) {
  return (
    <div
      className={`w-full rounded-2xl border bg-surface p-3 transition ${
        selected ? "border-border-strong" : "border-border"
      }`}
    >
      <button type="button" onClick={() => onSelect(spot.id)} className="flex w-full gap-3 text-left">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold font-[family-name:var(--font-heading)] text-base text-bg"
        >
          {spot.region.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-heading)] text-lg text-text">{spot.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-text-muted">{spot.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {spot.seasons.map((season) => (
              <span
                key={season}
                className="rounded bg-[#41372b] px-2 py-0.5 text-xs text-gold"
              >
                {season}
              </span>
            ))}
            {spot.foods.map((food) => (
              <span
                key={food}
                className="rounded bg-border-strong px-2 py-0.5 text-xs text-text"
              >
                {food}
              </span>
            ))}
          </div>
        </div>
      </button>
      <Link
        href={`/spots/${spot.id}`}
        className="mt-2 inline-block text-sm font-medium text-gold underline decoration-gold-dark/50 underline-offset-2 hover:decoration-gold"
      >
        자세히 보기 →
      </Link>
    </div>
  );
}
