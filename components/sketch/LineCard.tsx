import { KOREA_LAND_PATHS, project } from "@/lib/koreaMap";
import { dotsViewBox } from "@/lib/photo/regionView";
import { formatDistance } from "@/lib/geo";
import { fitText, textWidth } from "@/lib/collage";
import { smoothPath } from "@/lib/smoothPath";
import type { MonthCell, Sketch, SketchShapes } from "@/lib/sketch";
import { CARD_HEIGHT, CARD_MARGIN, CARD_WIDTH, FAINT, FONT, INK, MUTED, PAPER, SIGNATURE } from "./cardInk";

/*
  선 그림 — 벽에 걸어 둘 만한 한 장.

  색도 사진도 덜어 내고 그해 다닌 길만 먹선으로 남긴다. 지도형이 "어디를
  몇 번"을 말한다면, 이것은 그해의 모양을 말한다. 동해안을 훑은 해는
  세로로 긴 선이, 제주만 다닌 해는 동그란 선이 된다.

  그래서 전국이 아니라 다닌 곳에 맞춰 비춘다. 전국을 비추면 한 권역만
  다닌 해의 선은 손톱만 해진다.

  색은 딱 하나 — 사진을 가장 많이 남긴 곳에만 붉은 점을 찍는다.
*/

const LAND = "#ede6d6";
const COAST = "#d6ccb6";
const ACCENT = "#c8442a";

const FRAME = { x: CARD_MARGIN, y: 250, width: CARD_WIDTH - CARD_MARGIN * 2, height: 620 };
/** 틀 가장자리를 종이색으로 흐리는 폭. 땅이 칼로 자른 듯 끊기지 않게. */
const FEATHER = 28;
/** 이름을 적어 줄 곳의 수. 더 적으면 선 그림이 아니라 지도가 된다. */
const LABELS = 3;
const LABEL_SIZE = 17;
/*
  가장 좁게 비출 폭(지도 단위, 1 ≈ 1km). 이보다 좁히면 손으로 딴
  해안선(20~30km 에 한 점)이 모나 보이고, 어디인지 읽히지 않는다.
*/
const MIN_SPAN = 240;

interface LineCardProps {
  sketch: Sketch;
  shapes: SketchShapes;
  year: number;
  headline: string;
  months: MonthCell[];
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function LineCard({ sketch, shapes, year, headline, months }: LineCardProps) {
  const view = dotsViewBox(shapes.dots, FRAME, MIN_SPAN);
  const scale = FRAME.height / view.height;
  const place = (lat: number, lng: number) => {
    const point = project(lat, lng);
    return { x: FRAME.x + (point.x - view.x) * scale, y: FRAME.y + (point.y - view.y) * scale };
  };
  const drawable = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y);

  const stops = shapes.dots.map((dot) => ({ dot, at: place(dot.lat, dot.lng) })).filter(({ at }) => drawable(at));
  const ranked = [...stops].sort((a, b) => b.dot.photoCount - a.dot.photoCount);
  const top = ranked[0]?.dot.photoCount ? ranked[0] : null;

  /*
    이름은 사진 많은 곳 몇 곳만. 점 오른쪽에 적되 틀 밖으로 나가면
    왼쪽에, 먼저 적은 이름과 부딪히면 적지 않는다.
  */
  const labels: { x: number; y: number; anchor: "start" | "end"; text: string }[] = [];
  {
    const taken: Box[] = [];
    for (const { dot, at } of ranked) {
      if (labels.length === LABELS || dot.photoCount === 0) break;
      const text = fitText(dot.placeName, 200, LABEL_SIZE);
      if (!text) continue;
      const width = textWidth(text, LABEL_SIZE);
      const right = at.x + 12 + width <= FRAME.x + FRAME.width - 8;
      const box: Box = right
        ? { left: at.x + 10, right: at.x + 14 + width, top: at.y - 13, bottom: at.y + 7 }
        : { left: at.x - 14 - width, right: at.x - 10, top: at.y - 13, bottom: at.y + 7 };
      if (box.top < FRAME.y || box.bottom > FRAME.y + FRAME.height) continue;
      if (taken.some((one) => overlaps(one, box))) continue;
      taken.push(box);
      labels.push({ x: right ? at.x + 12 : at.x - 12, y: at.y + 5, anchor: right ? "start" : "end", text });
    }
  }

  const facts = [`여행 ${sketch.tripCount}번`, `${sketch.placeCount}곳`, `사진 ${sketch.photoCount.toLocaleString("ko-KR")}장`];
  if (sketch.distanceKm >= 1) facts.push(formatDistance(sketch.distanceKm));
  const width = CARD_WIDTH - CARD_MARGIN * 2;

  return (
    <svg
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${year}년 ${headline} — 선 그림, ${facts.join(", ")}`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={PAPER} />

      {/* 해가 곧 제목이다. 가장 크게. */}
      <text
        x={CARD_MARGIN - 4}
        y={160}
        fontFamily={FONT}
        fontSize={128}
        fontWeight={800}
        letterSpacing={-4}
        fill={INK}
      >
        {year}
      </text>
      <text x={CARD_MARGIN} y={214} fontFamily={FONT} fontSize={30} fontWeight={700} fill={INK}>
        {fitText(headline, width, 30)}
      </text>

      <defs>
        <clipPath id="line-frame">
          <rect x={FRAME.x} y={FRAME.y} width={FRAME.width} height={FRAME.height} />
        </clipPath>
        <linearGradient id="line-fade-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PAPER} stopOpacity={1} />
          <stop offset="1" stopColor={PAPER} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="line-fade-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={PAPER} stopOpacity={1} />
          <stop offset="1" stopColor={PAPER} stopOpacity={0} />
        </linearGradient>
      </defs>

      <g clipPath="url(#line-frame)">
        <g transform={`translate(${FRAME.x} ${FRAME.y}) scale(${scale}) translate(${-view.x} ${-view.y})`}>
          {KOREA_LAND_PATHS.map((path) => (
            <path key={path.slice(0, 24)} d={path} fill={LAND} stroke={COAST} strokeWidth={1.2 / scale} />
          ))}
        </g>

        {/* 가장자리를 종이색으로 흐린다. 네 변 모두. */}
        <rect x={FRAME.x} y={FRAME.y} width={FRAME.width} height={FEATHER} fill="url(#line-fade-down)" />
        <rect
          x={FRAME.x}
          y={FRAME.y + FRAME.height - FEATHER}
          width={FRAME.width}
          height={FEATHER}
          fill="url(#line-fade-down)"
          transform={`rotate(180 ${FRAME.x + FRAME.width / 2} ${FRAME.y + FRAME.height - FEATHER / 2})`}
        />
        <rect x={FRAME.x} y={FRAME.y} width={FEATHER} height={FRAME.height} fill="url(#line-fade-right)" />
        <rect
          x={FRAME.x + FRAME.width - FEATHER}
          y={FRAME.y}
          width={FEATHER}
          height={FRAME.height}
          fill="url(#line-fade-right)"
          transform={`rotate(180 ${FRAME.x + FRAME.width - FEATHER / 2} ${FRAME.y + FRAME.height / 2})`}
        />

        {/* 여행마다 한 줄. 여행과 여행 사이는 잇지 않는다 — 집에 갔다 다시 나온 것이다. */}
        {shapes.paths.map((path) => {
          const points = path.points.map((p) => place(p.lat, p.lng)).filter(drawable);
          if (points.length < 2) return null;
          return (
            <path
              key={path.tripId}
              d={smoothPath(points)}
              fill="none"
              stroke={INK}
              strokeWidth={3}
              strokeOpacity={0.88}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {stops.map(({ at }, index) => (
          <circle key={index} cx={at.x} cy={at.y} r={4.2} fill={PAPER} stroke={INK} strokeWidth={2} />
        ))}
        {top && <circle cx={top.at.x} cy={top.at.y} r={8} fill={ACCENT} stroke={PAPER} strokeWidth={2} />}

        {labels.map((label) => (
          <text
            key={label.text}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor}
            fontFamily={FONT}
            fontSize={LABEL_SIZE}
            fontWeight={500}
            fill={MUTED}
            stroke={PAPER}
            strokeWidth={4}
            paintOrder="stroke"
          >
            {label.text}
          </text>
        ))}
      </g>

      <line x1={CARD_MARGIN} x2={CARD_WIDTH - CARD_MARGIN} y1={904} y2={904} stroke={COAST} strokeWidth={1} />
      <text x={CARD_MARGIN} y={948} fontFamily={FONT} fontSize={20} fontWeight={500} fill={MUTED}>
        {fitText(facts.join(" · "), width, 20)}
      </text>

      <text x={CARD_MARGIN} y={CARD_HEIGHT - 44} fontFamily={FONT} fontSize={15} fill={FAINT}>
        {SIGNATURE}
      </text>

      {/* 열두 달을 점 열두 개로. 떠난 달만 먹으로 채운다. */}
      <g transform={`translate(${CARD_WIDTH - CARD_MARGIN - 11 * 17 - 4} ${CARD_HEIGHT - 49})`}>
        <text x={-12} y={5} textAnchor="end" fontFamily={FONT} fontSize={13} fill={FAINT}>
          떠난 달
        </text>
        {months.map((cell, index) => (
          <circle
            key={cell.month}
            cx={index * 17}
            cy={0}
            r={4}
            fill={cell.tripCount > 0 ? INK : "none"}
            stroke={cell.tripCount > 0 ? INK : COAST}
            strokeWidth={1.4}
          />
        ))}
      </g>
    </svg>
  );
}
