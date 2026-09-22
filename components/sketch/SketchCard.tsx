import { KOREA_LAND_PATHS, project } from "@/lib/koreaMap";
import { regionViewBox } from "@/lib/photo/regionView";
import type { Region } from "@/lib/types";
import { formatDistance } from "@/lib/geo";
import {
  SEASON_COLOR,
  dotRadius,
  type MonthCell,
  type Season,
  type Sketch,
  type SketchShapes,
} from "@/lib/sketch";
import { distanceInWords, paceInWords, photoPaceInWords } from "@/lib/sketchWords";

/*
  스케치 한 장.

  화면에 보이는 것과 저장되는 그림이 같아야 해서 통째로 SVG 로 그린다.
  html2canvas 같은 것을 끌어오면 화면과 저장본이 미묘하게 달라지고,
  무거운 의존성이 하나 늘어난다. SVG 는 그대로 그림으로 바꿀 수 있다.

  글꼴은 시스템 것을 쓴다 — 저장본을 만들 때 바깥 글꼴은 따라오지 않는다.
*/

const WIDTH = 720;
const HEIGHT = 1060;
const MAP_TOP = 190;
const MAP_HEIGHT = 450;
/* 전국을 세로 450 에 맞췄을 때의 가로. 권역을 골라도 이 자리는 그대로다. */
const MAP_WIDTH = Math.round((340 / 600) * 450);

const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const FAINT = "#a1a1a6";
const SEA = "#dbeafe";
const LAND = "#f5f3ec";
const COAST = "#b6c6d2";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard Variable', Pretendard, sans-serif";

const SEASONS: Season[] = ["봄", "여름", "가을", "겨울"];

interface SketchCardProps {
  sketch: Sketch;
  shapes: SketchShapes;
  /** 맨 위에 적을 말. 연도를 고르면 "2026년"처럼 바뀐다. */
  title: string;
  /** 그 아래 한 문장. 그해가 어떤 해였는지. */
  headline: string;
  /** 열두 달의 띠. 빈 달이 더 많은 것을 말해 준다. */
  months: MonthCell[];
  /** 고른 권역. 고르면 그쪽으로 당겨 본다. */
  region: Region | null;
  /**
   * 지도에 얹을 사진. 보관 경로 → 심을 수 있는 글자.
   * 아직 못 받았거나 실패한 자리는 그냥 점으로 남는다.
   */
  photos: Map<string, string>;
}

export function SketchCard({
  sketch,
  shapes,
  title,
  headline,
  months,
  region,
  photos,
}: SketchCardProps) {
  /*
    지도 자리는 늘 같은 크기다. 권역을 고르면 그 안에 무엇을 비출지만
    바뀐다 — 자리까지 바뀌면 카드마다 지도 크기가 달라져 어지럽다.
  */
  const mapWidth = MAP_WIDTH;
  const offsetX = (WIDTH - mapWidth) / 2;
  const view = regionViewBox(region, shapes.dots, { width: mapWidth, height: MAP_HEIGHT });
  const scale = MAP_HEIGHT / view.height;

  const place = (lat: number, lng: number) => {
    const point = project(lat, lng);
    return {
      x: offsetX + (point.x - view.x) * scale,
      y: MAP_TOP + (point.y - view.y) * scale,
    };
  };

  /** 그릴 수 없는 점은 조용히 건너뛴다. cx="NaN" 은 브라우저가 오류를 쏟는다. */
  const drawable = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

  const busiest = Math.max(0, ...shapes.dots.map((dot) => dot.photoCount));

  /** 사진으로 얹을 때의 한 변. 점보다 넉넉하되 지도를 덮지는 않게. */
  const shotSize = (photoCount: number) =>
    Math.round(Math.min(46, Math.max(28, dotRadius(photoCount, busiest) * 3)));

  /*
    어느 자리에 사진을 얹을지 고른다.

    사진 많은 순으로만 고르면 가까운 곳들이 뽑혀 서로 겹친다 — 실제로
    여섯 장이 두 무더기로 포개졌다. 많이 찍은 곳부터 훑되, 이미 얹은
    사진과 **화면에서** 부딪히면 건너뛴다. 실제 거리가 아니라 화면 거리로
    재야 전국을 볼 때나 한 권역을 볼 때나 똑같이 맞는다.
  */
  const shotAt = new Set<number>();
  {
    const taken: { x: number; y: number; reach: number }[] = [];
    shapes.dots
      .map((dot, index) => ({ dot, index }))
      .filter(({ dot }) => dot.photoPath && photos.has(dot.photoPath))
      .sort((a, b) => b.dot.photoCount - a.dot.photoCount)
      .forEach(({ dot, index }) => {
        const point = place(dot.lat, dot.lng);
        if (!drawable(point)) return;
        const reach = shotSize(dot.photoCount) / 2 + 5;
        const clash = taken.some(
          (one) => Math.hypot(one.x - point.x, one.y - point.y) < one.reach + reach,
        );
        if (clash) return;
        taken.push({ x: point.x, y: point.y, reach });
        shotAt.add(index);
      });
  }
  // 그해에 실제로 밟은 계절만 범례에 올린다. 안 간 계절을 설명할 이유가 없다.
  const seasonsUsed = SEASONS.filter((season) => shapes.dots.some((dot) => dot.season === season));

  const stats: [string, string, string | null][] = [
    ["여행", `${sketch.tripCount}번`, paceInWords(sketch.tripCount, sketch.spanDays)],
    [
      "다녀온 곳",
      `${sketch.placeCount}곳`,
      sketch.curatedCount > 0 ? `100선 중 ${sketch.curatedCount}곳` : null,
    ],
    ["사진", `${sketch.photoCount}장`, photoPaceInWords(sketch.photoCount, sketch.tripCount)],
  ];
  if (sketch.distanceKm >= 1) {
    stats.push([
      "오간 거리",
      formatDistance(sketch.distanceKm),
      distanceInWords(sketch.distanceKm),
    ]);
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${title} ${headline} — 여행 ${sketch.tripCount}번, 다녀온 곳 ${sketch.placeCount}곳`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={WIDTH} height={HEIGHT} fill="#ffffff" />

      <text x={48} y={78} fontFamily={FONT} fontSize={30} fontWeight={600} fill={MUTED}>
        {title}
      </text>
      {/* 사람은 숫자가 아니라 문장을 기억한다. 이 줄이 이 카드에서 가장 크다. */}
      <text x={48} y={132} fontFamily={FONT} fontSize={40} fontWeight={700} fill={INK}>
        {headline}
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

        {/*
          한 여행 안에서 옮겨 다닌 길. 점만 있으면 스무 곳을 갔다는 것
          말고는 알 수 없지만, 이어 놓으면 "동해안을 훑었구나"가 보인다.
          여행과 여행 사이는 잇지 않는다 — 집에 갔다 다시 나온 것이다.
        */}
        {shapes.paths.map((path) => {
          const points = path.points.map((p) => place(p.lat, p.lng)).filter(drawable);
          if (points.length < 2) return null;
          return (
            <polyline
              key={path.tripId}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={SEASON_COLOR[path.season]}
              strokeWidth={2}
              strokeOpacity={0.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/*
          점을 누르면 그 여행으로 간다. 보는 것에서 여는 것으로 — 이 화면이
          하려던 "소환"의 실제 동작이다.

          SVG 안의 <a> 는 그림으로 저장할 때 아무것도 남기지 않으므로,
          저장본에는 영향이 없다. 손가락으로 누를 것을 생각해 눈에 보이는
          점보다 넉넉한 투명 원을 겹쳐 둔다.
        */}
        {/*
          사진이 있는 자리는 사진을 얹는다. 507장을 찍어 놓고 색깔 점만
          보여 주면 그건 기록이지 스케치가 아니다.

          다만 스무 자리에 스무 장을 다 얹으면 난장판이 된다. 사진은
          아래에서 고른 몇 곳만 받아 오고, 나머지는 점 그대로 둔다.
        */}
        {shapes.dots.map((dot, index) => {
          const { x, y } = place(dot.lat, dot.lng);
          if (!drawable({ x, y })) return null;

          const r = dotRadius(dot.photoCount, busiest);
          const data = shotAt.has(index) ? photos.get(dot.photoPath!) : undefined;
          const size = shotSize(dot.photoCount);
          const ring = SEASON_COLOR[dot.season];

          return (
            <a key={index} href={`/trips/${dot.tripId}`} aria-label={`${dot.photoCount}장 찍은 곳`}>
              {data ? (
                <g>
                  <rect
                    x={x - size / 2 - 2.5}
                    y={y - size / 2 - 2.5}
                    width={size + 5}
                    height={size + 5}
                    rx={9}
                    fill={ring}
                  />
                  <clipPath id={`shot-${index}`}>
                    <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={7} />
                  </clipPath>
                  <image
                    href={data}
                    x={x - size / 2}
                    y={y - size / 2}
                    width={size}
                    height={size}
                    clipPath={`url(#shot-${index})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                </g>
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={ring}
                  fillOpacity={0.85}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              <circle cx={x} cy={y} r={Math.max(r, 16)} fill="transparent" />
            </a>
          );
        })}
      </g>

      {/* 색이 무엇을 뜻하는지 밝혀 두지 않으면 그냥 알록달록한 점이다. */}
      {seasonsUsed.length > 1 && (
        /*
          지도 폭이 아니라 카드 폭에 맞춘다. 네 계절을 늘어놓으면 지도보다
          넓어서, 지도 왼끝에 붙이면 오른쪽 설명과 겹친다.
        */
        <g transform={`translate(48 ${MAP_TOP + MAP_HEIGHT + 38})`}>
          {seasonsUsed.map((season, index) => (
            <g key={season} transform={`translate(${index * 74} 0)`}>
              <circle cx={7} cy={-5} r={7} fill={SEASON_COLOR[season]} fillOpacity={0.85} />
              <text x={22} fontFamily={FONT} fontSize={16} fill={MUTED}>
                {season}
              </text>
            </g>
          ))}
          <text
            x={WIDTH - 96}
            textAnchor="end"
            fontFamily={FONT}
            fontSize={14}
            fill={FAINT}
          >
            점이 클수록 사진이 많은 곳
          </text>
        </g>
      )}

      {/*
        열두 달. 다녀온 달보다 비어 있는 달이 더 많은 것을 말해 준다 —
        "여름엔 한 번도 안 나갔네".
      */}
      <g transform={`translate(48 ${MAP_TOP + MAP_HEIGHT + 92})`}>
        {months.map((cell, index) => {
          const x = index * 52;
          const filled = cell.season !== null;
          return (
            <g key={cell.month} transform={`translate(${x} 0)`}>
              <rect
                width={40}
                height={8}
                rx={4}
                fill={filled ? SEASON_COLOR[cell.season!] : "#ececec"}
                fillOpacity={filled ? 0.9 : 1}
              />
              <text
                x={20}
                y={26}
                textAnchor="middle"
                fontFamily={FONT}
                fontSize={13}
                fill={filled ? MUTED : FAINT}
              >
                {cell.month}
              </text>
            </g>
          );
        })}
      </g>

      {/* 숫자 — 오른쪽 한 줄이 그 수가 무슨 뜻인지 풀어 준다. */}
      <g transform={`translate(48 ${MAP_TOP + MAP_HEIGHT + 160})`}>
        {stats.map(([label, value, aside], index) => (
          <g key={label} transform={`translate(0 ${index * 54})`}>
            <text y={4} fontFamily={FONT} fontSize={16} fill={FAINT}>
              {label}
            </text>
            <text x={130} y={8} fontFamily={FONT} fontSize={30} fontWeight={700} fill={INK}>
              {value}
            </text>
            {aside && (
              <text x={300} y={6} fontFamily={FONT} fontSize={17} fill={MUTED}>
                {aside}
              </text>
            )}
          </g>
        ))}
      </g>

      <text x={48} y={HEIGHT - 44} fontFamily={FONT} fontSize={15} fill={FAINT}>
        나만의 여행 스케치
      </text>
    </svg>
  );
}
