"use client";

import type { Spot } from "@/lib/types";

interface SpotCardProps {
  spot: Spot;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function SpotCard({ spot, selected, onSelect }: SpotCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spot.id)}
      className={`w-full rounded-lg border p-3 text-left transition ${
        selected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
      }`}
    >
      <h3 className="font-semibold">{spot.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{spot.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {spot.seasons.map((season) => (
          <span key={season} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {season}
          </span>
        ))}
        {spot.foods.map((food) => (
          <span key={food} className="rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
            {food}
          </span>
        ))}
      </div>
    </button>
  );
}
