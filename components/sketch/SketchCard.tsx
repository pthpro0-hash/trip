import { KOREA_FULL_VIEWBOX, KOREA_LAND_PATHS, project } from "@/lib/koreaMap";
import { formatDistance } from "@/lib/geo";
import type { Sketch } from "@/lib/sketch";

/*
  스케치 한 장.

  화면에 보이는 것과 저장되는 그림이 같아야 해서 통째로 SVG 로 그린다.
  html2canvas 같은 것을 끌어오면 화면과 저장본이 미묘하게 달라지고,
  무거운 의존성이 하나 늘어난다. SVG 는 그대로 그림으로 바꿀 수 있다.

  글꼴은 시스템 것을 쓴다 — 저장본을 만들 때 바깥 글꼴은 따라오지 않는다.
*/

const WIDTH = 720;
const HEIGHT = 1000;
const MAP_TOP = 150;
const MAP_HEIGHT = 470;

const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const FAINT = "#a1a1a6";
const SEA = "#dbeafe";
const LAND = "#f5f3ec";
const COAST = "#b6c6d2";
const DOT = "#0071e3";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard Variable', Pretendard, sans-serif";

interface SketchCardProps {
  sketch: Sketch;
  points: { lat: number; lng: number }[];
  /** 맨 위에 적을 말. 연도를 고르면 "2026년의 여행"처럼 바뀐다. */
  title: string;
}

export function SketchCard({ sketch, points, title }: SketchCardProps) {
  const view = KOREA_FULL_VIEWBOX;
  // 한국 지도를 카드 가운데에 앉힌다. 세로에 맞춰 비율을 지킨다.
  const scale = MAP_HEIGHT / view.height;
  const mapWidth = view.width * scale;
  const offsetX = (WIDTH - mapWidth) / 2;

  const place = (lat: number, lng: number) => {
    const point = project(lat, lng);
    return {
      x: offsetX + (point.x - view.x) * scale,
      y: MAP_TOP + (point.y - view.y) * scale,
    };
  };

  const stats: [string, string][] = [
    ["여행", `${sketch.tripCount}번`],
    ["다녀온 곳", `${sketch.placeCount}곳`],
    ["사진", `${sketch.photoCount}장`],
  ];
  if (sketch.distanceKm >= 1) stats.push(["오간 거리", formatDistance(sketch.distanceKm)]);

  const companions = sketch.byCompanion.slice(0, 4);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${title} — 여행 ${sketch.tripCount}번, 다녀온 곳 ${sketch.placeCount}곳`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={WIDTH} height={HEIGHT} fill="#ffffff" />

      <text x={48} y={82} fontFamily={FONT} fontSize={38} fontWeight={700} fill={INK}>
        {title}
      </text>
      <text x={48} y={116} fontFamily={FONT} fontSize={18} fill={MUTED}>
        내가 밟은 곳
      </text>

      {/*
        바다 사각형 밖으로 나가는 것을 잘라낸다. 울릉도가 이 틀 밖에 있어,
        자르지 않으면 카드 오른쪽 허공에 섬 하나가 떠 있다.
      */}
      <defs>
        <clipPath id="sketch-map">
          <rect x={offsetX} y={MAP_TOP} width={mapWidth} height={MAP_HEIGHT} rx={12} />
        </clipPath>
      </defs>

      <g clipPath="url(#sketch-map)">
        <rect x={offsetX} y={MAP_TOP} width={mapWidth} height={MAP_HEIGHT} fill={SEA} rx={12} />
        <g
          transform={`translate(${offsetX} ${MAP_TOP}) scale(${scale}) translate(${-view.x} ${-view.y})`}
        >
          {KOREA_LAND_PATHS.map((path) => (
            <path key={path.slice(0, 24)} d={path} fill={LAND} stroke={COAST} strokeWidth={1.4} />
          ))}
        </g>
      </g>

      {points.map((point, index) => {
        const { x, y } = place(point.lat, point.lng);
        /*
          좌표가 없는 방문이 섞이면 cx="NaN" 이 그려지고 브라우저가 오류를
          쏟는다. 그릴 수 없는 점은 조용히 건너뛴다 — 점 하나 때문에
          스케치 전체가 망가질 이유는 없다.
        */
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return (
          <circle key={index} cx={x} cy={y} r={7} fill={DOT} stroke="#ffffff" strokeWidth={2.5} />
        );
      })}

      {/* 숫자 */}
      <g transform={`translate(48 ${MAP_TOP + MAP_HEIGHT + 70})`}>
        {stats.map(([label, value], index) => (
          <g key={label} transform={`translate(${index * 160} 0)`}>
            <text fontFamily={FONT} fontSize={15} fill={FAINT}>
              {label}
            </text>
            <text y={38} fontFamily={FONT} fontSize={30} fontWeight={700} fill={INK}>
              {value}
            </text>
          </g>
        ))}
      </g>

      {/* 함께한 사람 */}
      {companions.length > 0 && (
        <g transform={`translate(48 ${MAP_TOP + MAP_HEIGHT + 180})`}>
          <text fontFamily={FONT} fontSize={15} fill={FAINT}>
            함께한 사람
          </text>
          {companions.map((person, index) => (
            <g key={person.label} transform={`translate(0 ${34 + index * 34})`}>
              <text fontFamily={FONT} fontSize={20} fontWeight={600} fill={INK}>
                {person.label}
              </text>
              <text x={200} fontFamily={FONT} fontSize={20} fill={MUTED}>
                {person.count}번
              </text>
            </g>
          ))}
        </g>
      )}

      <text x={48} y={HEIGHT - 40} fontFamily={FONT} fontSize={15} fill={FAINT}>
        여행세상
      </text>
    </svg>
  );
}
