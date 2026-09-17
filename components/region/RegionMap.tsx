"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Region, Spot } from "@/lib/types";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import { REGION_THEME } from "@/lib/regionTheme";
import { spreadPoints, type MapPoint } from "@/lib/koreaMap";
import { layoutLabels } from "@/lib/mapLabels";
import { CATEGORY_COLOR, SPOT_CATEGORIES, categorize } from "@/lib/spotCategory";

interface RegionMapProps {
  region: Region;
  spots: Spot[];
  label?: string;
}

const PIN_HEIGHT = 24;
const FONT_SIZE = 10;
const BOUNDS_PADDING = 28;
const INK = "#2B3440";
const INK_MUTED = "#5F6B7A";
const HALO = "#FFFFFF";
// The tiles carry road names, shop names and transit markings that fight with
// the pin labels, and Kakao has no style API to switch them off — so the tile
// layer gets desaturated and washed out instead, leaving shape and coastline
// legible while the detail recedes behind our own markers.
const TILE_FILTER = "saturate(0.5) brightness(1.05) contrast(0.95)";
const TILE_SCRIM = "rgba(248, 246, 240, 0.22)";

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

function shortName(spot: Spot) {
  return spot.name.split(/[(&]/)[0].trim();
}

function subTextFor(spot: Spot) {
  const source = spot.highlights.length > 0 ? spot.highlights : spot.foods;
  return truncate(source.slice(0, 2).join(", "), 12);
}

// A real Kakao map, decluttered, with the region's spots drawn on top as
// numbered pins and name labels — the map supplies real geography, the overlay
// supplies the infographic. Panning and zooming stay off so the framing (and
// the label layout computed for it) holds still.
export function RegionMap({ region, spots, label }: RegionMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const theme = REGION_THEME[region];

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const mapRef = useRef<any>(null);
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  // Reads each spot's pixel position out of the map's own projection, so the
  // overlay stays pinned to the tiles through resizes and tile reloads.
  const syncPoints = useCallback(() => {
    const map = mapRef.current;
    const element = containerRef.current;
    if (!map || !element || !window.kakao) return;

    const projection = map.getProjection();
    const next = spots.map((spot) => {
      const point = projection.containerPointFromCoords(
        new window.kakao.maps.LatLng(spot.lat, spot.lng),
      );
      return { x: point.x, y: point.y };
    });

    setPoints(next);
    setSize({ width: element.clientWidth, height: element.clientHeight });
  }, [spots]);

  const fitBounds = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
    (map: any) => {
      const bounds = new window.kakao.maps.LatLngBounds();
      spots.forEach((spot) => bounds.extend(new window.kakao.maps.LatLng(spot.lat, spot.lng)));
      map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING);
      // A single-spot cluster fits to a point, which zooms all the way in.
      if (map.getLevel() < 5) map.setLevel(5);
    },
    [spots],
  );

  useEffect(() => {
    if (!apiKey || spots.length === 0) return;
    let cancelled = false;

    loadKakaoMaps(apiKey)
      .then(() => {
        const container = containerRef.current;
        if (cancelled || mapRef.current || !container) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(spots[0].lat, spots[0].lng),
          level: 10,
        });
        fitBounds(map);
        // Static framing: the label layout is computed for this exact view, and
        // letting it pan or zoom would leave the overlay out of step.
        map.setZoomable(false);
        map.setDraggable(false);
        mapRef.current = map;

        window.kakao.maps.event.addListener(map, "tilesloaded", syncPoints);
        syncPoints();
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, spots, fitBounds, syncPoints]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      const map = mapRef.current;
      if (!map || !window.kakao) return;
      map.relayout();
      fitBounds(map);
      syncPoints();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fitBounds, syncPoints]);

  const spread =
    points && size.width > 0 ? spreadPoints(points, PIN_HEIGHT * 0.78, PIN_HEIGHT * 1.1) : null;

  const labels =
    spread && size.width > 0
      ? layoutLabels(
          spots.map((spot, index) => ({
            id: spot.id,
            text: shortName(spot),
            subText: subTextFor(spot),
            anchor: spread[index],
          })),
          {
            viewBox: { x: 0, y: 0, width: size.width, height: size.height },
            fontSize: FONT_SIZE,
            pinHeight: PIN_HEIGHT,
          },
        )
      : null;

  const usedCategories = SPOT_CATEGORIES.filter((category) =>
    spots.some((spot) => categorize(spot) === category),
  );

  const selectedIndex = spots.findIndex((spot) => spot.id === selectedId);
  const selectedSpot = selectedIndex >= 0 ? spots[selectedIndex] : null;
  const selectedPoint = spread && selectedIndex >= 0 ? spread[selectedIndex] : null;

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
        className="relative aspect-[4/5] overflow-hidden rounded-2xl border-2 shadow-sm"
        style={{ borderColor: theme.accent }}
      >
        <div ref={containerRef} className="absolute inset-0" style={{ filter: TILE_FILTER }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: TILE_SCRIM }} />

        {(!apiKey || hasError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface p-4 text-center text-sm text-text-muted">
            {apiKey ? "지도를 불러오지 못했습니다" : "지도를 보려면 카카오맵 키 설정이 필요합니다"}
          </div>
        )}

        {spread && labels && size.width > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${size.width} ${size.height}`}
          >
            {labels.map((placed, index) => {
              if (!placed.visible) return null;
              const anchor = spread[index];
              const isBelow = placed.y >= anchor.y;
              const connectY = isBelow ? placed.y : placed.y + placed.height;
              const needsLeader =
                Math.abs(placed.x - anchor.x) > FONT_SIZE ||
                (isBelow && placed.y - anchor.y > FONT_SIZE * 1.5);
              return (
                <g key={placed.id}>
                  {needsLeader && (
                    <line
                      x1={anchor.x}
                      y1={anchor.y}
                      x2={placed.x}
                      y2={connectY}
                      stroke={INK_MUTED}
                      strokeWidth={1}
                      opacity={0.6}
                    />
                  )}
                  <text
                    x={placed.x}
                    y={placed.y + FONT_SIZE}
                    textAnchor="middle"
                    fontSize={FONT_SIZE}
                    fontWeight="bold"
                    fill={INK}
                    stroke={HALO}
                    strokeWidth={FONT_SIZE * 0.32}
                    paintOrder="stroke"
                  >
                    {shortName(spots[index])}
                  </text>
                  {placed.showSubText && (
                    <text
                      x={placed.x}
                      y={placed.y + FONT_SIZE * 2.15}
                      textAnchor="middle"
                      fontSize={FONT_SIZE * 0.82}
                      fill={INK_MUTED}
                      stroke={HALO}
                      strokeWidth={FONT_SIZE * 0.3}
                      paintOrder="stroke"
                    >
                      {subTextFor(spots[index])}
                    </text>
                  )}
                </g>
              );
            })}

            {spots.map((spot, index) => {
              const point = spread[index];
              const isSelected = spot.id === selectedId;
              const height = PIN_HEIGHT * (isSelected ? 1.22 : 1);
              return (
                <g
                  key={spot.id}
                  role="button"
                  tabIndex={0}
                  aria-label={spot.name}
                  aria-expanded={isSelected}
                  className="pointer-events-auto cursor-pointer"
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
                    fill={CATEGORY_COLOR[categorize(spot)]}
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
                  <circle
                    cx={point.x}
                    cy={point.y - height * 0.6}
                    r={height * 0.72}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {selectedSpot && selectedPoint && (
          <div
            className="absolute z-10 w-52 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg"
            style={{
              left: `${Math.min(Math.max(selectedPoint.x, 110), Math.max(size.width - 110, 110))}px`,
              top: `${selectedPoint.y + 10}px`,
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
            <p className="mt-1 text-text-muted">{truncate(selectedSpot.summary, 60)}</p>
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
            <Link
              href={`/spots/${spot.id}`}
              className="flex items-baseline gap-1.5 text-text hover:text-gold"
            >
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
