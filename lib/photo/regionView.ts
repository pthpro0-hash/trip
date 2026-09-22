import { KOREA_FULL_VIEWBOX, project, type ViewBox } from "@/lib/koreaMap";
import type { Region } from "@/lib/types";

/*
  권역을 고르면 그쪽으로 당겨 본다.

  스물여섯 개 점이 전국에 흩어져 있을 때는 전국이 맞지만, 강원권만 보기로
  했으면 강원이 크게 보여야 한다. 작은 점 셋을 전국 지도 위에 찍어 두면
  아무것도 읽히지 않는다.

  아래 네모는 눈대중이다. 어느 권역인지 **가리는** 일에는 좌표를 쓰지
  않았지만(그건 틀리면 기록이 틀린다), 어디를 **비출지** 정하는 일은
  조금 어긋나도 화면이 살짝 옮겨질 뿐이다. 그래도 점이 잘리는 일은
  없어야 하므로, 실제 점들과 합쳐서 틀을 잡는다 — 내 눈대중이 틀려도
  다녀온 곳은 반드시 보인다.
*/

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const REGION_BOUNDS: Record<Region, Bounds> = {
  수도권: { minLat: 36.85, maxLat: 38.35, minLng: 126.0, maxLng: 127.95 },
  강원권: { minLat: 36.95, maxLat: 38.65, minLng: 127.25, maxLng: 129.45 },
  충청권: { minLat: 35.9, maxLat: 37.25, minLng: 125.9, maxLng: 128.05 },
  전라권: { minLat: 33.9, maxLat: 36.35, minLng: 125.85, maxLng: 127.95 },
  경상권: { minLat: 34.55, maxLat: 37.25, minLng: 127.55, maxLng: 129.65 },
  제주권: { minLat: 33.1, maxLat: 33.62, minLng: 126.1, maxLng: 127.0 },
};

/** 틀 가장자리에 점이 딱 붙지 않게 둘레에 남기는 비율. */
const MARGIN = 0.12;

/**
 * 권역과 점들을 모두 담는 틀.
 *
 * 권역을 고르지 않았으면 전국을 그대로 쓴다 — 늘 보던 우리나라 모양이
 * 먼저 눈에 들어오는 편이 낫다.
 */
export function regionViewBox(
  region: Region | null,
  dots: { lat: number; lng: number }[],
  frame: { width: number; height: number },
): ViewBox {
  if (!region) return KOREA_FULL_VIEWBOX;

  const bounds = REGION_BOUNDS[region];
  const corners = [
    { lat: bounds.minLat, lng: bounds.minLng },
    { lat: bounds.maxLat, lng: bounds.maxLng },
    // 눈대중이 빗나가도 다녀온 곳은 반드시 담기게 한다.
    ...dots.filter((dot) => Number.isFinite(dot.lat) && Number.isFinite(dot.lng)),
  ];

  const points = corners.map((point) => project(point.lat, point.lng));
  const xs = points.map((p) => p.x).filter(Number.isFinite);
  const ys = points.map((p) => p.y).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) return KOREA_FULL_VIEWBOX;

  let left = Math.min(...xs);
  let right = Math.max(...xs);
  let top = Math.min(...ys);
  let bottom = Math.max(...ys);

  // 둘레를 남긴다.
  const padX = (right - left) * MARGIN;
  const padY = (bottom - top) * MARGIN;
  left -= padX;
  right += padX;
  top -= padY;
  bottom += padY;

  /*
    틀의 가로세로 비율을 화면에 맞춘다. 맞추지 않으면 SVG 가 알아서
    늘이거나 줄여 지도가 찌그러진다. 모자라는 쪽을 늘려서 맞춘다 —
    줄이면 담아야 할 것이 잘린다.
  */
  const width = right - left;
  const height = bottom - top;
  const want = frame.width / frame.height;
  const have = width / height;

  if (have < want) {
    const grow = (height * want - width) / 2;
    left -= grow;
    right += grow;
  } else if (have > want) {
    const grow = (width / want - height) / 2;
    top -= grow;
    bottom += grow;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}
