import { formatDistance } from "@/lib/geo";
import { collageTiles, fitText } from "@/lib/collage";
import type { Sketch, SketchDot } from "@/lib/sketch";
import { distanceInWords, paceInWords } from "@/lib/sketchWords";
import { CARD_HEIGHT, CARD_MARGIN, CARD_WIDTH, FAINT, FONT, INK, MUTED, SIGNATURE } from "./cardInk";

/*
  사진 콜라주 — 그해를 사진으로 보여 주는 한 장.

  지도형은 "어디를 다녔나"를, 이것은 "무엇을 봤나"를 말한다. 맨 위 큰
  칸에 그해를 대표하는 한 장, 그 아래로 간 날 순서대로. 칸마다 그곳
  이름을 적어 사진만 봐도 어디인지 안다.

  지도형과 같은 판(720×1060)이라 저장과 스토리용 세로 변환이 그대로 된다.
*/

const MOSAIC = { x: CARD_MARGIN, y: 168, width: CARD_WIDTH - CARD_MARGIN * 2, height: 680 };
const GAP = 8;
/** 사진을 아직 못 받았거나 못 받은 칸. */
const EMPTY = "#eeede8";
/** 이보다 작은 칸에는 이름을 적지 않는다. 글자가 사진을 덮는다. */
const LABEL_MIN = { width: 150, height: 110 };

interface CollageCardProps {
  sketch: Sketch;
  title: string;
  headline: string;
  /** 얹을 곳. 첫째가 큰 칸에 간다(lib/collage 의 collagePicks). */
  picks: SketchDot[];
  /** 보관 경로 → 심을 수 있는 글자. 없는 칸은 빈 칸으로 남는다. */
  photos: Map<string, string>;
}

export function CollageCard({ sketch, title, headline, picks, photos }: CollageCardProps) {
  const tiles = collageTiles(picks.length, MOSAIC, GAP);
  const width = CARD_WIDTH - CARD_MARGIN * 2;

  const stats: [string, string][] = [
    ["여행", `${sketch.tripCount}번`],
    ["다녀온 곳", `${sketch.placeCount}곳`],
    ["사진", `${sketch.photoCount.toLocaleString("ko-KR")}장`],
  ];
  if (sketch.distanceKm >= 1) stats.push(["오간 거리", formatDistance(sketch.distanceKm)]);
  const column = width / stats.length;
  const aside = distanceInWords(sketch.distanceKm) ?? paceInWords(sketch.tripCount, sketch.spanDays);

  return (
    <svg
      viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${title} ${headline} — 사진 콜라주, ${picks.map((pick) => pick.placeName).join(", ")}`}
      style={{ display: "block", borderRadius: 16 }}
    >
      <rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="#ffffff" />

      <text x={CARD_MARGIN} y={78} fontFamily={FONT} fontSize={30} fontWeight={600} fill={MUTED}>
        {title}
      </text>
      <text x={CARD_MARGIN} y={132} fontFamily={FONT} fontSize={40} fontWeight={700} fill={INK}>
        {fitText(headline, width, 40)}
      </text>

      <defs>
        {/* 이름 뒤를 살짝 어둡게 — 밝은 하늘 사진 위에서도 흰 글자가 읽히게. */}
        <linearGradient id="collage-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.55} />
        </linearGradient>
        {tiles.map((tile, index) => (
          <clipPath key={index} id={`collage-tile-${index}`}>
            <rect x={tile.x} y={tile.y} width={tile.width} height={tile.height} rx={14} />
          </clipPath>
        ))}
      </defs>

      {tiles.map((tile, index) => {
        const pick = picks[index];
        const data = pick.photoPath ? photos.get(pick.photoPath) : undefined;
        const hero = index === 0;
        const labelled = tile.width >= LABEL_MIN.width && tile.height >= LABEL_MIN.height;
        const fontSize = hero ? 24 : 17;
        const fade = Math.min(tile.height * 0.45, hero ? 130 : 80);

        return (
          /*
            칸을 누르면 그 여행으로 간다. 저장한 그림에는 링크가 남지 않으니
            저장본에는 영향이 없다.
          */
          <a key={index} href={`/trips/${pick.tripId}`} aria-label={`${pick.placeName} 여행 열기`}>
            <g clipPath={`url(#collage-tile-${index})`}>
              <rect x={tile.x} y={tile.y} width={tile.width} height={tile.height} fill={EMPTY} />
              {data && (
                <image
                  href={data}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  preserveAspectRatio="xMidYMid slice"
                />
              )}
              {labelled && data && (
                <rect
                  x={tile.x}
                  y={tile.y + tile.height - fade}
                  width={tile.width}
                  height={fade}
                  fill="url(#collage-fade)"
                />
              )}
            </g>
            {labelled && (
              <>
                {hero && (
                  <text
                    x={tile.x + 18}
                    y={tile.y + tile.height - 54}
                    fontFamily={FONT}
                    fontSize={16}
                    fill={data ? "#ffffff" : MUTED}
                    fillOpacity={data ? 0.85 : 1}
                  >
                    사진 {pick.photoCount.toLocaleString("ko-KR")}장
                  </text>
                )}
                <text
                  x={tile.x + (hero ? 18 : 12)}
                  y={tile.y + tile.height - (hero ? 20 : 13)}
                  fontFamily={FONT}
                  fontSize={fontSize}
                  fontWeight={600}
                  fill={data ? "#ffffff" : MUTED}
                >
                  {fitText(pick.placeName, tile.width - (hero ? 36 : 24), fontSize)}
                </text>
              </>
            )}
          </a>
        );
      })}

      {/* 숫자는 한 줄로 가볍게. 이 카드의 주인공은 사진이다. */}
      {stats.map(([label, value], index) => (
        <g key={label} transform={`translate(${CARD_MARGIN + index * column} 0)`}>
          <text y={MOSAIC.y + MOSAIC.height + 42} fontFamily={FONT} fontSize={15} fill={FAINT}>
            {label}
          </text>
          <text
            y={MOSAIC.y + MOSAIC.height + 80}
            fontFamily={FONT}
            fontSize={28}
            fontWeight={700}
            fill={INK}
          >
            {value}
          </text>
        </g>
      ))}
      {aside && (
        <text x={CARD_MARGIN} y={MOSAIC.y + MOSAIC.height + 120} fontFamily={FONT} fontSize={17} fill={MUTED}>
          {fitText(aside, width, 17)}
        </text>
      )}

      <text x={CARD_MARGIN} y={CARD_HEIGHT - 44} fontFamily={FONT} fontSize={15} fill={FAINT}>
        {SIGNATURE}
      </text>
    </svg>
  );
}
