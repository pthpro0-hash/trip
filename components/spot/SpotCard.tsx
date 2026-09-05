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
      className={`w-full rounded-2xl border bg-parchment-light p-3 transition ${
        selected ? "border-gold" : "border-[var(--color-border-warm)]"
      }`}
    >
      <button type="button" onClick={() => onSelect(spot.id)} className="flex w-full gap-3 text-left">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold font-[family-name:var(--font-jua)] text-base text-brown"
        >
          {spot.region.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-jua)] text-lg text-brown">{spot.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{spot.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {spot.seasons.map((season) => (
              <span
                key={season}
                className="rounded bg-gold/20 px-2 py-0.5 text-xs text-brown"
              >
                {season}
              </span>
            ))}
            {spot.foods.map((food) => (
              <span
                key={food}
                className="rounded bg-brown/10 px-2 py-0.5 text-xs text-brown"
              >
                {food}
              </span>
            ))}
          </div>
        </div>
      </button>
      <Link
        href={`/spots/${spot.id}`}
        className="mt-2 inline-block text-sm font-medium text-brown underline decoration-gold-dark/50 underline-offset-2 hover:decoration-brown"
      >
        자세히 보기 →
      </Link>
    </div>
  );
}
