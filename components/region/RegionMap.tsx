"use client";

import { useState } from "react";
import Link from "next/link";
import type { Region, Spot } from "@/lib/types";
import { computeRegionPins } from "@/lib/regionMap";
import { REGION_THEME } from "@/lib/regionTheme";
import { RegionIllustration } from "./RegionIllustration";

interface RegionMapProps {
  region: Region;
  spots: Spot[];
  label?: string;
}

// Keeps the info card's horizontal anchor away from the illustration's own
// edges so a pin near x=2 or x=98 doesn't push the (fixed-width) card mostly
// off the card.
function clampPopupX(x: number) {
  return Math.min(Math.max(x, 22), 78);
}

// Clicking a pin opens an info card anchored to it — name, one-line summary,
// season tags, and a link to the full detail page — the same "tap a marker,
// see a summary, then drill in" interaction KakaoMap already uses, so the
// two map views behave consistently.
export function RegionMap({ region, spots, label }: RegionMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = REGION_THEME[region];
  const pins = computeRegionPins(spots);
  const selectedSpot = spots.find((s) => s.id === selectedId);
  const selectedPin = pins.find((p) => p.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      {label && (
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">
          {region} · {label}
        </h2>
      )}

      <div
        className="relative overflow-hidden rounded-2xl border-2 p-1.5 shadow-sm"
        style={{ borderColor: theme.accent }}
      >
        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full rounded-xl"
          style={{ background: `linear-gradient(160deg, ${theme.accent}33, ${theme.accentDark}55)` }}
        >
          <RegionIllustration region={region} color={theme.accent} opacity={0.4} />
        </svg>

        <div className="absolute inset-1.5">
          {pins.map((pin, index) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => setSelectedId(selectedId === pin.id ? null : pin.id)}
              aria-label={pin.name}
              aria-expanded={selectedId === pin.id}
              className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm transition hover:scale-110"
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, backgroundColor: theme.accentDark }}
            >
              {index + 1}
            </button>
          ))}

          {selectedSpot && selectedPin && (
            <div
              className="absolute z-10 w-52 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"
              style={{ left: `${clampPopupX(selectedPin.x)}%`, top: `${selectedPin.y}%`, marginTop: "16px" }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="닫기"
                className="float-right -mt-1 -mr-1 rounded px-1 text-text-muted hover:text-text"
              >
                ×
              </button>
              <h3 className="font-[family-name:var(--font-heading)] text-base text-text">
                {selectedSpot.name}
              </h3>
              <p className="mt-1 text-text-muted">
                {selectedSpot.summary.length > 60
                  ? `${selectedSpot.summary.slice(0, 60)}…`
                  : selectedSpot.summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedSpot.seasons.map((season) => (
                  <span key={season} className="rounded bg-[#41372b] px-2 py-0.5 text-xs text-gold">
                    {season}
                  </span>
                ))}
              </div>
              <Link
                href={`/spots/${selectedSpot.id}`}
                className="mt-2 inline-block font-medium text-gold underline decoration-gold-dark/50 underline-offset-2 hover:decoration-gold"
              >
                자세히 보기 →
              </Link>
            </div>
          )}
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {spots.map((spot, index) => (
          <li key={spot.id}>
            <Link href={`/spots/${spot.id}`} className="flex items-baseline gap-1.5 text-text hover:text-gold">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: theme.accentDark }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="truncate">{spot.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
