import { KOREA_FULL_VIEWBOX, project } from "@/lib/koreaMap";
import { sidoShapes } from "@/lib/sidoShapes";
import { formatDistance } from "@/lib/geo";
import { dotRadius } from "@/lib/sketch";
import { fitText } from "@/lib/svgText";
import type { YearLayer, YearRow } from "@/lib/yearsStory";
import { CARD_HEIGHT, CARD_MARGIN, CARD_WIDTH, FAINT, FONT, INK, MUTED, SIGNATURE, type CardStats } from "./cardInk";

/*
  지금까지 전부 — 해마다 색을 달리한 한 장.

  지도형 카드와 같은 판·같은 지도 자리다. 다른 것은 색의 뜻뿐이다:
  계절이 아니라 해. 오래된 해를 먼저, 최근 해를 맨 위에 그려 올해가
  가려지지 않게 한다.

  지도 아래에는 해마다 막대 한 줄씩 — 몇 번 떠났는지를 나란히 세운다.
  해가 많으면 최근 여섯 해만 세운다. 그보다 많으면 막대가 가늘어져
  읽히지 않는다.
*/

const MAP_TOP = 180;
const MAP_HEIGHT = 440;
const MAP_WIDTH = Math.round((340 / 600) * MAP_HEIGHT);
const SEA = "#dbeafe";
const LAND = "#f5f3ec";
/* 시도 경계(지도형 카드와 같다). */
const BORDER = "#a9bac7";
const BORDER_WIDTH = 2;
const BAR_ROWS = 6;

interface YearsCardProps {
  stats: CardStats;
  headline: string;
  layers: YearLayer[];
  rows: YearRow[];
}

export function YearsCard({ stats, headline, layers, rows }: YearsCardProps) {
  const offsetX = (CARD_WIDTH - MAP_WIDTH) / 2;
  const view = KOREA_FULL_VIEWBOX;
  const scale = MAP_HEIGHT / view.height;
  const place = (lat: number, lng: number) => {
    const point = project(lat, lng);
    return { x: offsetX + (point.x - view.x) * scale, y: MAP_TOP + (point.y - view.y) * scale };
  };
  const drawable = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

  const busiest = Math.max(0, ...layers.flatMap((layer) => layer.shapes.dots.map((dot) => dot.photoCount)));
  const shown = rows.slice(-BAR_ROWS).reverse();
  const mostTrips = Math.max(1, ...shown.map((row) => row.tripCount));
  const barTop = MAP_TOP + MAP_HEIGHT + 48;
  // 해가 적으면 줄 사이를 넉넉히 — 막대 아래가 휑하지 않게.
  const rowGap = Math.min(52, 228 / Math.max(1, shown.length));
  const width = CARD_WIDTH - CARD_MARGIN * 2;

  const facts = [`여행 ${stats.tripCount}번`, `${stats.placeCount}곳`, `사진 ${stats.photoCount.toLocaleString("ko-KR")}장`];
  if (stats.distanceKm >= 1) facts.push(formatDistance(stats.distanceKm));
  const title = rows.length > 1 ? `${rows[0].year}–${rows.at(-1)!.year}` : `${rows[0]?.year ?? ""}년`;

  return (
    <svg
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`지금까지 ${headline} — ${rows.map((row) => `${row.year}년 ${row.tripCount}번`).join(", ")}`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="#ffffff" />

      <text x={CARD_MARGIN} y={78} fontFamily={FONT} fontSize={30} fontWeight={600} fill={MUTED}>
        지금까지 · {title}
      </text>
      <text x={CARD_MARGIN} y={132} fontFamily={FONT} fontSize={40} fontWeight={700} fill={INK}>
        {fitText(headline, width, 40)}
      </text>

      <defs>
        <clipPath id="years-map">
          <rect x={offsetX} y={MAP_TOP} width={MAP_WIDTH} height={MAP_HEIGHT} rx={12} />
        </clipPath>
      </defs>
      <g clipPath="url(#years-map)">
        <rect x={offsetX} y={MAP_TOP} width={MAP_WIDTH} height={MAP_HEIGHT} fill={SEA} rx={12} />
        <g transform={`translate(${offsetX} ${MAP_TOP}) scale(${scale}) translate(${-view.x} ${-view.y})`} data-basemap>
          {sidoShapes().list.map((sido) => (
            <path
              key={sido.name}
              d={sido.d}
              fillRule="evenodd"
              fill={LAND}
              stroke={BORDER}
              strokeWidth={BORDER_WIDTH}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* 오래된 해부터 — 최근 해가 맨 위에 온다. */}
        {layers.map((layer) => (
          <g key={layer.year}>
            {layer.shapes.paths.map((path) => {
              const points = path.points.map((p) => place(p.lat, p.lng)).filter(drawable);
              if (points.length < 2) return null;
              return (
                <polyline
                  key={path.tripId}
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth={2}
                  strokeOpacity={0.55}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
            {layer.shapes.dots.map((dot, index) => {
              const at = place(dot.lat, dot.lng);
              if (!drawable(at)) return null;
              return (
                <circle
                  key={index}
                  cx={at.x}
                  cy={at.y}
                  r={dotRadius(dot.photoCount, busiest)}
                  fill={layer.color}
                  fillOpacity={0.85}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              );
            })}
          </g>
        ))}
      </g>

      {/* 해마다 한 줄. 색이 곧 범례다. */}
      {shown.map((row, index) => {
        const y = barTop + index * rowGap;
        const barWidth = Math.max(6, (row.tripCount / mostTrips) * 300);
        return (
          <g key={row.year}>
            <circle cx={CARD_MARGIN + 7} cy={y - 6} r={7} fill={row.color} />
            <text x={CARD_MARGIN + 22} y={y} fontFamily={FONT} fontSize={18} fontWeight={600} fill={INK}>
              {row.year}
            </text>
            <rect x={CARD_MARGIN + 88} y={y - 14} width={barWidth} height={14} rx={7} fill={row.color} fillOpacity={0.85} />
            <text x={CARD_MARGIN + 100 + barWidth} y={y} fontFamily={FONT} fontSize={16} fill={MUTED}>
              {row.tripCount}번 · 사진 {row.photoCount.toLocaleString("ko-KR")}장
            </text>
          </g>
        );
      })}

      <text x={CARD_MARGIN} y={CARD_HEIGHT - 86} fontFamily={FONT} fontSize={19} fontWeight={500} fill={MUTED}>
        {fitText(facts.join(" · "), width, 19)}
      </text>
      <text x={CARD_MARGIN} y={CARD_HEIGHT - 44} fontFamily={FONT} fontSize={15} fill={FAINT}>
        {SIGNATURE}
      </text>
    </svg>
  );
}
