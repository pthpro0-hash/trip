import raw from "@/lib/data/sido.json";

/*
  17개 시도.

  경계는 Natural Earth(admin-1, 1:10m)에서 한국 것만 떼어 줄였다. 공공
  영역(public domain)이라 상업적으로 써도 되고 출처를 밝힐 의무도 없다.
  약 200m 정밀도로 줄였다 — 칠하기는 전국·권역을 볼 때의 일이라 그
  이상은 무게만 늘린다. 경기도에는 서울이, 전남에는 광주가, 경북에는
  대구가 구멍으로 뚫려 있다. 구멍이 없으면 경기를 칠할 때 서울까지
  칠해진다.

  어느 시도인지 가리는 것은 경계가 아니라 법정동이 먼저다. 장소를 찾을
  때 받아 둔 "강원특별자치도 강릉시 송정동"의 맨 앞 칸이 곧 시도라 틀릴
  일이 없다. 경계는 법정동이 비어 있을 때만 쓴다 — 줄인 경계는 바닷가
  에서 몇백 m 씩 어긋나고, 광주는 원본부터 점 열두 개로 거칠게 그려져
  광산구 쪽이 통째로 빠져 있다(좌표로만 가리면 광주시청이 전남이 된다).
*/

/** [경도, 위도] 점. GeoJSON 순서 그대로다. */
type Ring = [number, number][];

export interface Sido {
  /** ISO 3166-2. "KR-42" */
  code: string;
  /** 짧은 이름. "강원" */
  name: string;
  /** 지금의 공식 이름. "강원특별자치도" */
  full: string;
  /** 조각마다 [바깥 고리, ...구멍]. */
  polygons: Ring[][];
}

export const SIDO = raw as unknown as Sido[];

/*
  법정동 맨 앞 칸 → 짧은 이름. 행정구역 이름은 바뀐다 — 강원도는
  강원특별자치도가, 전라북도는 전북특별자치도가 됐다. 기록에는 그때
  받은 이름이 그대로 남아 있으므로 옛 이름도 받는다.
*/
const BY_FULL = new Map<string, string>([
  ...SIDO.map((sido) => [sido.full, sido.name] as const),
  ["강원도", "강원"],
  ["전라북도", "전북"],
  ["제주도", "제주"],
]);

/** 법정동 문자열에서 시도. 모르는 앞 칸이면 null. */
export function sidoOfDong(dong: string | null | undefined): string | null {
  const head = dong?.trim().split(/\s+/)[0];
  return head ? (BY_FULL.get(head) ?? null) : null;
}

/** 점이 고리 안에 있는가. 반직선을 그어 몇 번 건너는지 센다. */
function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 점이 조각 안에 있는가. 바깥 고리 안이고 구멍 밖이어야 한다. */
function inPolygon(lng: number, lat: number, polygon: Ring[]): boolean {
  const [outer, ...holes] = polygon;
  return inRing(lng, lat, outer) && !holes.some((hole) => inRing(lng, lat, hole));
}

/**
 * 좌표로 시도를 찾는다.
 *
 * 줄인 경계는 바닷가에서 어긋나, 해변에서 찍은 사진이 바다 위로 떨어지기
 * 쉽다. 어느 조각에도 들지 않으면 가장 가까운 꼭짓점을 가진 시도로 친다.
 * 한반도 밖(해외 여행)은 null.
 */
export function sidoAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const sido of SIDO) {
    if (sido.polygons.some((polygon) => inPolygon(lng, lat, polygon))) return sido.name;
  }

  let best: string | null = null;
  let nearest = Infinity;
  for (const sido of SIDO) {
    for (const polygon of sido.polygons) {
      for (const [x, y] of polygon[0]) {
        const d = Math.hypot(x - lng, y - lat);
        if (d < nearest) {
          nearest = d;
          best = sido.name;
        }
      }
    }
  }
  // 0.2도(20km 남짓)보다 멀면 이 나라가 아니다.
  return nearest < 0.2 ? best : null;
}

/** 다녀온 곳마다 시도를 가린다. 법정동이 먼저, 없으면 좌표. */
export function sidoOf(place: { dong?: string | null; lat: number; lng: number }): string | null {
  return sidoOfDong(place.dong) ?? sidoAt(place.lat, place.lng);
}

/** 시도마다 다녀온 곳 수. 한 번도 안 간 시도는 없다. */
export function sidoTally(places: { dong?: string | null; lat: number; lng: number }[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const place of places) {
    const name = sidoOf(place);
    if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  return tally;
}

/** 시도 조각들의 범위. 한 번도 안 간 시도로 날아갈 때 쓴다. */
export function sidoBounds(name: string): { lat: number; lng: number }[] {
  const sido = SIDO.find((entry) => entry.name === name);
  if (!sido) return [];
  const points = sido.polygons.flatMap((polygon) => polygon[0]);
  const lats = points.map(([, y]) => y);
  const lngs = points.map(([x]) => x);
  return [
    { lat: Math.min(...lats), lng: Math.min(...lngs) },
    { lat: Math.max(...lats), lng: Math.max(...lngs) },
  ];
}
