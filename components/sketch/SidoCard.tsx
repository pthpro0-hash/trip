import { dotsViewBox } from "@/lib/photo/regionView";
import { sidoShapes } from "@/lib/sidoShapes";
import { SIDO_ORDER } from "@/lib/sidoOrder";
import { formatDistance } from "@/lib/geo";
import { fitText, wrapWords } from "@/lib/svgText";
import { CARD_HEIGHT, CARD_MARGIN, CARD_WIDTH, FAINT, FONT, INK, MUTED, SIGNATURE, type CardStats } from "./cardInk";

/*
  시도 카드 — 어디를 다녔는지 시도만 칠한 한 장.

  링크로 보여 주면서 "시도 이름만"을 골랐을 때 그린다. 정확한 곳도 사진도
  싣지 않기로 했으니 점을 찍을 좌표가 없다. 대신 밟은 시도를 칠한다 —
  열일곱 칸 가운데 몇 칸이 칠해졌는지가 그해를 말해 준다.

  경계는 lib/sido 의 것(Natural Earth, 약 200m)을 그대로 쓴다. 지도형
  카드의 손으로 딴 해안선보다 곱다.
*/

const PAINT = "#0071e3";
/** 전에도 밟은 시도. 처음 밟은 곳이 먼저 눈에 들어오게 옅게 칠한다. */
const PAINT_AGAIN = 0.45;
const LAND = "#eef0f3";
const EDGE = "#ffffff";
const MAP = { x: CARD_MARGIN, y: 158, width: CARD_WIDTH - CARD_MARGIN * 2, height: 600 };

interface SidoCardProps {
  sketch: CardStats;
  year: number;
  headline: string;
  /** 그해 밟은 시도(짧은 이름). */
  sido: string[];
  /** 그해 처음 밟은 시도. 기록의 첫 해면 null. */
  firstSido: string[] | null;
}

export function SidoCard({ sketch, year, headline, sido, firstSido }: SidoCardProps) {
  const { list, points } = sidoShapes();
  /*
    전국이 틀에 꼭 차게 — 둘레를 거의 남기지 않는다. 백령도에서 독도까지
    담으면 가로가 넓어 본토가 작아지지만, 섬을 빼고 그린 우리나라 지도는
    내놓지 않는다.
  */
  const view = dotsViewBox(points, MAP, 0, 0.03);
  const scale = MAP.height / view.height;
  const visited = new Set(sido);
  const names = SIDO_ORDER.filter((name) => visited.has(name));
  const firsts = new Set(firstSido ?? []);
  const width = CARD_WIDTH - CARD_MARGIN * 2;

  const facts = [`여행 ${sketch.tripCount}번`, `사진 ${sketch.photoCount.toLocaleString("ko-KR")}장`];
  if (sketch.distanceKm >= 1) facts.push(formatDistance(sketch.distanceKm));
  const lines = wrapWords(names, width, 20, { maxLines: 2 });
  /** 기록의 첫 해면 null 이라 모든 곳을 진하게 칠한다. */
  const shade = (name: string) => (firstSido === null || firsts.has(name) ? 0.9 : PAINT_AGAIN);

  return (
    <svg
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${year === 0 ? "지금까지" : `${year}년`} ${headline} — 밟은 시도 ${names.length}곳: ${names.join(", ")}`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="#ffffff" />

      <text x={CARD_MARGIN} y={78} fontFamily={FONT} fontSize={30} fontWeight={600} fill={MUTED}>
        {year === 0 ? "지금까지" : `${year}년`}
      </text>
      <text x={CARD_MARGIN} y={132} fontFamily={FONT} fontSize={40} fontWeight={700} fill={INK}>
        {fitText(headline, width, 40)}
      </text>

      <g transform={`translate(${MAP.x} ${MAP.y}) scale(${scale}) translate(${-view.x} ${-view.y})`}>
        {list.map((shape) => (
          <path
            key={shape.name}
            d={shape.d}
            fillRule="evenodd"
            fill={visited.has(shape.name) ? PAINT : LAND}
            fillOpacity={visited.has(shape.name) ? shade(shape.name) : 1}
            stroke={EDGE}
            strokeWidth={1.6 / scale}
            strokeLinejoin="round"
          />
        ))}
      </g>

      <text x={CARD_MARGIN} y={800} fontFamily={FONT} fontSize={16} fill={FAINT}>
        밟은 시도
        {firsts.size > 0 && (
          <tspan fill={PAINT} fontWeight={600} dx={6}>
            · 진하게 칠한 {firsts.size}곳은 처음
          </tspan>
        )}
      </text>
      <text x={CARD_MARGIN} y={850} fontFamily={FONT} fontSize={46} fontWeight={700} fill={INK}>
        {names.length}곳
        <tspan fontSize={22} fontWeight={500} fill={FAINT} dx={8}>
          / 17
        </tspan>
      </text>
      <text
        x={CARD_WIDTH - CARD_MARGIN}
        y={846}
        textAnchor="end"
        fontFamily={FONT}
        fontSize={18}
        fill={MUTED}
      >
        {facts.join(" · ")}
      </text>

      {lines.map((line, index) => (
        <text
          key={index}
          x={CARD_MARGIN}
          y={900 + index * 32}
          fontFamily={FONT}
          fontSize={20}
          fontWeight={500}
          fill={MUTED}
        >
          {line}
        </text>
      ))}

      <text x={CARD_MARGIN} y={CARD_HEIGHT - 44} fontFamily={FONT} fontSize={15} fill={FAINT}>
        {SIGNATURE}
      </text>
    </svg>
  );
}
