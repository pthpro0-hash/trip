export interface Point {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/**
 * 두 지점 사이의 직선거리(km). 도로를 따라가는 거리가 아니라 지구 표면을
 * 가로지르는 최단거리라, 실제 이동거리는 보통 이보다 20~40% 길다.
 * 화면에 쓸 때 "직선거리"라고 밝혀야 하는 이유다.
 */
export function distanceKm(a: Point, b: Point): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 사람이 읽는 거리. 1km 미만은 10m 단위, 10km 미만은 소수 한 자리. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

export function legDistancesKm(points: Point[]): number[] {
  const legs: number[] = [];
  for (let i = 1; i < points.length; i += 1) legs.push(distanceKm(points[i - 1], points[i]));
  return legs;
}

export function totalDistanceKm(points: Point[]): number {
  return legDistancesKm(points).reduce((sum, leg) => sum + leg, 0);
}

/**
 * 가까운 곳부터 차례로 잇는다(최근접 이웃). 최단 경로를 보장하지는 않지만,
 * 담은 순서대로 전국을 지그재그로 오가는 것보다는 늘 낫고, 왜 이 순서인지
 * 사람이 바로 이해할 수 있다.
 *
 * `start`를 주면 거기서 가장 가까운 곳부터, 없으면 목록의 첫 곳부터 시작한다.
 */
export function orderByProximity<T extends Point>(items: T[], start?: Point): T[] {
  if (items.length <= 1) return [...items];

  const remaining = [...items];
  const ordered: T[] = [];
  let cursor: Point = start ?? remaining[0];

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const candidate = distanceKm(cursor, remaining[i]);
      if (candidate < bestDistance) {
        bestDistance = candidate;
        bestIndex = i;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    cursor = next;
  }

  return ordered;
}

/** 한 칸 위/아래로 옮긴 새 배열. 끝을 벗어나면 원본 그대로 돌려준다. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
