import type { Spot } from "@/lib/types";
import { KOREA_FULL_VIEWBOX, KOREA_LAND_PATHS, project } from "@/lib/koreaMap";

// 카카오 타일이 아니라 우리가 그린 해안선이다. 카드 크기로 줄여도
// 형태가 남고, 지도 SDK를 부르지 않아 목록이 무거워지지 않는다.
const SEA = "#CFE4EE";
const LAND = "#F6F3E9";
const COAST = "#A9BFCB";

interface RegionMiniMapProps {
  /** 색칠해 보여줄 여행지. 보통 한 권역의 전부. */
  spots: Spot[];
  accent: string;
  dotRadius?: number;
  className?: string;
}

export function RegionMiniMap({
  spots,
  accent,
  dotRadius = 8.4,
  className = "aspect-square w-full rounded-xl",
}: RegionMiniMapProps) {
  const viewBox = KOREA_FULL_VIEWBOX;

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className={className}
      style={{ background: SEA }}
      aria-hidden="true"
    >
      {KOREA_LAND_PATHS.map((path) => (
        <path key={path.slice(0, 24)} d={path} fill={LAND} stroke={COAST} strokeWidth={1.4} />
      ))}
      {spots.map((spot) => {
        const point = project(spot.lat, spot.lng);
        return (
          <circle
            key={spot.id}
            cx={point.x}
            cy={point.y}
            r={dotRadius}
            fill={accent}
            stroke="white"
            strokeWidth={dotRadius * 0.26}
          />
        );
      })}
    </svg>
  );
}
