import { distanceKm } from "./geo";

/*
  쌓인 기록을 한 장으로 접는다.

  "121곳 중 23곳"처럼 도장깨기를 세는 것이 아니다. 어디를 밟았고, 누구와
  다녔고, 어느 해에 많이 다녔는지 — 그 사람의 여행이 어떤 모양이었는지를
  보여주는 것이 목적이다.
*/

export interface SketchVisit {
  placeName: string;
  spotId: string | null;
  lat: number;
  lng: number;
  photoCount: number;
}

export interface SketchTrip {
  id: string;
  startedOn: string;
  endedOn: string;
  companions: string | null;
  visits: SketchVisit[];
}

export interface Tally {
  label: string;
  count: number;
}

export interface Sketch {
  tripCount: number;
  /** 다녀온 횟수. 같은 곳을 두 번 가면 두 번으로 센다. */
  visitCount: number;
  /** 서로 다른 장소. */
  placeCount: number;
  photoCount: number;
  /** 여행 안에서 옮겨 다닌 직선거리의 합. 여행과 여행 사이는 잇지 않는다. */
  distanceKm: number;
  /** 한국관광 100선 중 밟은 곳. */
  curatedCount: number;
  byYear: Tally[];
  byCompanion: Tally[];
  bySeason: Tally[];
  /** 가장 자주 함께한 사람. 아무도 적지 않았으면 null. */
  topCompanion: Tally | null;
}

const SEASON_OF_MONTH: Record<number, string> = {
  1: "겨울", 2: "겨울", 3: "봄", 4: "봄", 5: "봄",
  6: "여름", 7: "여름", 8: "여름",
  9: "가을", 10: "가을", 11: "가을", 12: "겨울",
};
const SEASON_ORDER = ["봄", "여름", "가을", "겨울"];

function tally(values: string[], order?: string[]): Tally[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  const entries = [...counts.entries()].map(([label, count]) => ({ label, count }));
  if (order) {
    return entries.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  }
  // 많은 순. 같은 수면 이름 순으로 둬야 새로고침할 때마다 뒤바뀌지 않는다.
  return entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"));
}

/** 한 여행 안에서 옮겨 다닌 거리. 방문이 하나뿐이면 0. */
export function tripDistanceKm(trip: SketchTrip): number {
  let total = 0;
  for (let i = 1; i < trip.visits.length; i += 1) {
    total += distanceKm(trip.visits[i - 1], trip.visits[i]);
  }
  return total;
}

export function buildSketch(trips: SketchTrip[]): Sketch {
  const visits = trips.flatMap((trip) => trip.visits);

  const byCompanion = tally(
    trips
      .map((trip) => trip.companions?.trim())
      .filter((name): name is string => Boolean(name)),
  );

  return {
    tripCount: trips.length,
    visitCount: visits.length,
    placeCount: new Set(visits.map((visit) => visit.placeName)).size,
    photoCount: visits.reduce((sum, visit) => sum + visit.photoCount, 0),
    distanceKm: trips.reduce((sum, trip) => sum + tripDistanceKm(trip), 0),
    curatedCount: new Set(
      visits.map((visit) => visit.spotId).filter((id): id is string => Boolean(id)),
    ).size,
    byYear: tally(trips.map((trip) => trip.startedOn.slice(0, 4))).sort(
      (a, b) => Number(b.label) - Number(a.label),
    ),
    byCompanion,
    bySeason: tally(
      trips.map((trip) => SEASON_OF_MONTH[Number(trip.startedOn.slice(5, 7))]),
      SEASON_ORDER,
    ),
    topCompanion: byCompanion[0] ?? null,
  };
}

/** 이보다 가까운 두 곳은 지도에서 한 점으로 본다. */
const SAME_SPOT_KM = 1;

/**
 * 지도에 찍을 점들. 같은 자리를 여러 번 갔어도 한 번만 찍는다.
 *
 * 좌표를 반올림해 묶으면 경계에서 어긋난다 — 100m 떨어진 두 곳이 다른 칸에
 * 들어가고, 1km 떨어진 두 곳이 같은 칸에 들어간다. 거리로 재는 편이
 * 말과 동작이 맞는다. 점 수가 많지 않아 다 비교해도 부담이 없다.
 */
export function sketchPoints(trips: SketchTrip[]): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];

  for (const visit of trips.flatMap((trip) => trip.visits)) {
    // 좌표가 없는 방문은 지도에 찍을 수 없다.
    if (!Number.isFinite(visit.lat) || !Number.isFinite(visit.lng)) continue;
    const near = points.some((point) => distanceKm(point, visit) < SAME_SPOT_KM);
    if (!near) points.push({ lat: visit.lat, lng: visit.lng });
  }
  return points;
}
