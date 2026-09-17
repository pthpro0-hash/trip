"use client";

import { useState } from "react";
import Link from "next/link";
import type { Region, Spot } from "@/lib/types";
import { REGION_THEME } from "@/lib/regionTheme";
import {
  KOREA_LAND_PATHS,
  computeViewBox,
  project,
  spreadPoints,
  toViewBoxPercent,
  type MapPoint,
} from "@/lib/koreaMap";
import { layoutLabels } from "@/lib/mapLabels";
import { CATEGORY_COLOR, SPOT_CATEGORIES, categorize } from "@/lib/spotCategory";

interface RegionMapProps {
  region: Region;
  spots: Spot[];
  label?: string;
}

const SEA = "#CFE4EE";
const LAND = "#F6F3E9";
const COAST = "#A9BFCB";
const INK = "#2B3440";
const INK_MUTED = "#6B7684";

// Classic map-marker outline: tip at (x, y), a circular head above it.
function pinPath(x: number, y: number, height: number) {
  const radius = height * 0.36;
  const centerY = y - height + radius;
  const dx = radius * 0.643;
  const dy = radius * 0.766;
  return `M ${x} ${y} L ${x - dx} ${centerY + dy} A ${radius} ${radius} 0 1 1 ${x + dx} ${centerY + dy} Z`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function subTextFor(spot: Spot) {
  const source = spot.highlights.length > 0 ? spot.highlights : spot.foods;
  return truncate(source.slice(0, 2).join(", "), 12);
}

// Draws the region's spots as pins at their true projected coordinates on a
// stylized Korea coastline, each with a name label placed by the collision
// solver, in the vein of a printed travel infographic. Tapping a pin opens the
// same kind of summary card KakaoMap uses, so both maps behave alike.
export function RegionMap({ region, spots, label }: RegionMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = REGION_THEME[region];

  const truePoints: MapPoint[] = spots.map((spot) => project(spot.lat, spot.lng));
  const viewBox = computeViewBox(truePoints, { padding: 0.18, minSpan: 70 });
  const span = viewBox.width;

  const pinHeight = span * 0.05;
  const fontSize = span * 0.024;
  const points = spreadPoints(truePoints, pinHeight * 0.78, pinHeight * 1.1);
  const labels = layoutLabels(
    spots.map((spot, index) => ({
      id: spot.id,
      text: spot.name.split(/[(&]/)[0].trim(),
      subText: subTextFor(spot),
      anchor: points[index],
    })),
    { viewBox, fontSize, pinHeight },
  );

  const usedCategories = SPOT_CATEGORIES.filter((category) =>
    spots.some((spot) => categorize(spot) === category),
  );

  const selectedIndex = spots.findIndex((spot) => spot.id === selectedId);
  const selectedSpot = selectedIndex >= 0 ? spots[selectedIndex] : null;
  const selectedPosition =
    selectedIndex >= 0 ? toViewBoxPercent(points[selectedIndex], viewBox) : null;

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">
          {region} · {label}
        </h2>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {usedCategories.map((category) => (
          <span key={category} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLOR[category] }}
              aria-hidden="true"
            />
            {category}
          </span>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border-2 p-1.5 shadow-sm"
        style={{ borderColor: theme.accent }}
      >
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="aspect-square w-full rounded-xl"
          style={{ background: SEA }}
        >
          {KOREA_LAND_PATHS.map((path) => (
            <path key={path.slice(0, 24)} d={path} fill={LAND} stroke={COAST} strokeWidth={span * 0.003} />
          ))}

          {labels.map((placed, index) => {
            if (!placed.visible) return null;
            const anchor = points[index];
            // A label that couldn't sit directly under its pin gets a leader
            // line, otherwise it's ambiguous which marker it belongs to.
            const isBelow = placed.y >= anchor.y;
            const connectY = isBelow ? placed.y : placed.y + placed.height;
            const offset = Math.abs(placed.x - anchor.x);
            const needsLeader = offset > fontSize || (isBelow && placed.y - anchor.y > fontSize * 1.5);
            return (
              <g key={placed.id} pointerEvents="none">
                {needsLeader && (
                  <line
                    x1={anchor.x}
                    y1={anchor.y}
                    x2={placed.x}
                    y2={connectY}
                    stroke={INK_MUTED}
                    strokeWidth={fontSize * 0.08}
                    opacity={0.55}
                  />
                )}
                <text
                  x={placed.x}
                  y={placed.y + fontSize}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight="bold"
                  fill={INK}
                  stroke={LAND}
                  strokeWidth={fontSize * 0.3}
                  paintOrder="stroke"
                >
                  {spots[index].name.split(/[(&]/)[0].trim()}
                </text>
                <text
                  x={placed.x}
                  y={placed.y + fontSize * 2.15}
                  textAnchor="middle"
                  fontSize={fontSize * 0.82}
                  fill={INK_MUTED}
                  stroke={LAND}
                  strokeWidth={fontSize * 0.26}
                  paintOrder="stroke"
                >
                  {subTextFor(spots[index])}
                </text>
              </g>
            );
          })}

          {spots.map((spot, index) => {
            const point = points[index];
            const color = CATEGORY_COLOR[categorize(spot)];
            const isSelected = spot.id === selectedId;
            const height = pinHeight * (isSelected ? 1.25 : 1);
            return (
              <g
                key={spot.id}
                role="button"
                tabIndex={0}
                aria-label={spot.name}
                aria-expanded={isSelected}
                className="cursor-pointer"
                onClick={() => setSelectedId(isSelected ? null : spot.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(isSelected ? null : spot.id);
                  }
                }}
              >
                <path
                  d={pinPath(point.x, point.y, height)}
                  fill={color}
                  stroke="white"
                  strokeWidth={height * 0.09}
                />
                <text
                  x={point.x}
                  y={point.y - height * 0.64}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={height * 0.4}
                  fontWeight="bold"
                  fill="white"
                  pointerEvents="none"
                >
                  {index + 1}
                </text>
                {/* Generous invisible hit area — the pin itself is a small touch target. */}
                <circle cx={point.x} cy={point.y - height * 0.6} r={height * 0.75} fill="transparent" />
              </g>
            );
          })}
        </svg>

        {selectedSpot && selectedPosition && (
          <div
            className="absolute z-10 w-52 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"
            style={{
              left: `${Math.min(Math.max(selectedPosition.left, 24), 76)}%`,
              top: `${selectedPosition.top}%`,
              marginTop: "12px",
            }}
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
              {truncate(selectedSpot.summary, 60)}
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

      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {spots.map((spot, index) => (
          <li key={spot.id}>
            <Link href={`/spots/${spot.id}`} className="flex items-baseline gap-1.5 text-text hover:text-gold">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: CATEGORY_COLOR[categorize(spot)] }}
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
