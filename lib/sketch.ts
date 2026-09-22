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

export type Season = "봄" | "여름" | "가을" | "겨울";

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
  /** 바다가 낀 여행 수. "바다만 여섯 번" 같은 말을 짓는 데 쓴다. */
  seaTripCount: number;
  /** 제주에 다녀왔는가. 이 나라에서 제주는 그 자체로 한 문장이 된다. */
  jeju: boolean;
  /** 첫 여행부터 마지막 여행까지 며칠. 얼마나 자주 다녔는지 재는 바탕. */
  spanDays: number;
  /** 동행자를 적지 않은 여행 수. 비어 있으면 되물어야 한다. */
  withoutCompanion: number;
}

/** 이름이 이 말들로 끝나면 바다로 본다. */
const SEA_WORDS = ["해변", "해수욕장", "해안", "바다", "포구", "항", "섬"];

export function isSeaPlace(placeName: string): boolean {
  return SEA_WORDS.some((word) => placeName.endsWith(word));
}

/** 제주는 위도로 가른다. 본토 최남단(해남 땅끝)이 34.3 언저리다. */
export function isJeju(lat: number): boolean {
  return Number.isFinite(lat) && lat < 33.7;
}

export function seasonOf(startedOn: string): Season {
  return SEASON_OF_MONTH[Number(startedOn.slice(5, 7))] as Season;
}

const SEASON_OF_MONTH: Record<number, Season> = {
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

/** 첫 여행부터 마지막 여행까지 며칠. 한 건뿐이면 그 여행이 걸친 날수. */
function spanDays(trips: SketchTrip[]): number {
  if (trips.length === 0) return 0;
  const days = trips.flatMap((trip) => [trip.startedOn, trip.endedOn]).sort();
  const from = new Date(`${days[0]}T00:00:00`);
  const to = new Date(`${days.at(-1)}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
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
    bySeason: tally(trips.map((trip) => seasonOf(trip.startedOn)), SEASON_ORDER),
    topCompanion: byCompanion[0] ?? null,
    seaTripCount: trips.filter((trip) => trip.visits.some((v) => isSeaPlace(v.placeName))).length,
    jeju: visits.some((visit) => isJeju(visit.lat)),
    spanDays: spanDays(trips),
    withoutCompanion: trips.filter((trip) => !trip.companions?.trim()).length,
  };
}

/** 이보다 가까운 두 곳은 지도에서 한 점으로 본다. */
const SAME_SPOT_KM = 1;

/** 지도에 찍는 점 하나. */
export interface SketchDot {
  lat: number;
  lng: number;
  /** 이 자리에서 찍은 사진을 모두 더한 수. 점의 크기가 된다. */
  photoCount: number;
  /** 이 자리에서 가장 많이 찍은 때의 계절. 점의 색이 된다. */
  season: Season;
  /** 눌렀을 때 갈 여행. 여러 번 갔으면 가장 최근 것. */
  tripId: string;
}

/** 한 여행 안에서 옮겨 다닌 길. */
export interface SketchPath {
  tripId: string;
  season: Season;
  points: { lat: number; lng: number }[];
}

export interface SketchShapes {
  dots: SketchDot[];
  paths: SketchPath[];
}

const drawable = (visit: { lat: number; lng: number }) =>
  Number.isFinite(visit.lat) && Number.isFinite(visit.lng);

/**
 * 지도에 그릴 것들.
 *
 * 같은 크기의 점만 늘어놓으면 스무 곳을 갔다는 것 말고는 아무것도 알 수
 * 없다. 사진을 많이 찍은 곳은 크게, 계절은 색으로, 한 여행 안에서 옮겨
 * 다닌 길은 선으로 남긴다 — 그래야 "가을에 동해안을 훑었구나"가 한눈에 온다.
 *
 * 좌표를 반올림해 묶으면 경계에서 어긋난다 — 100m 떨어진 두 곳이 다른 칸에
 * 들어가고, 1km 떨어진 두 곳이 같은 칸에 들어간다. 거리로 재는 편이
 * 말과 동작이 맞는다. 점 수가 많지 않아 다 비교해도 부담이 없다.
 */
export function sketchShapes(trips: SketchTrip[]): SketchShapes {
  const dots: (SketchDot & { bySeason: Map<Season, number>; startedOn: string })[] = [];

  // 시간순으로 훑어야 "가장 최근 여행"이 마지막에 남는다.
  const ordered = [...trips].sort((a, b) => a.startedOn.localeCompare(b.startedOn));

  for (const trip of ordered) {
    const season = seasonOf(trip.startedOn);
    for (const visit of trip.visits) {
      if (!drawable(visit)) continue;

      const hit = dots.find((dot) => distanceKm(dot, visit) < SAME_SPOT_KM);
      const target =
        hit ??
        (dots.push({
          lat: visit.lat,
          lng: visit.lng,
          photoCount: 0,
          season,
          tripId: trip.id,
          bySeason: new Map(),
          startedOn: trip.startedOn,
        }),
        dots.at(-1)!);

      target.photoCount += visit.photoCount;
      target.bySeason.set(season, (target.bySeason.get(season) ?? 0) + visit.photoCount);
      // 마지막에 들른 여행으로 이어 준다.
      target.tripId = trip.id;
      target.startedOn = trip.startedOn;
    }
  }

  const paths: SketchPath[] = [];
  for (const trip of ordered) {
    const points = trip.visits.filter(drawable).map((v) => ({ lat: v.lat, lng: v.lng }));
    // 한 자리에 머문 여행에는 그릴 길이 없다.
    if (points.length < 2) continue;
    paths.push({ tripId: trip.id, season: seasonOf(trip.startedOn), points });
  }

  return {
    dots: dots.map((dot) => ({
      lat: dot.lat,
      lng: dot.lng,
      photoCount: dot.photoCount,
      // 사진을 가장 많이 찍은 때의 색. 같으면 먼저 간 때를 쓴다.
      season: [...dot.bySeason.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? dot.season,
      tripId: dot.tripId,
    })),
    paths,
  };
}

/** 점의 반지름. 넓이가 사진 수에 비례하도록 제곱근을 쓴다. */
export const DOT_MIN_R = 5;
export const DOT_MAX_R = 15;

export function dotRadius(photoCount: number, maxPhotoCount: number): number {
  if (maxPhotoCount <= 0 || photoCount <= 0) return DOT_MIN_R;
  const ratio = Math.sqrt(Math.min(photoCount, maxPhotoCount) / maxPhotoCount);
  return DOT_MIN_R + (DOT_MAX_R - DOT_MIN_R) * ratio;
}

/**
 * 계절의 색.
 *
 * 연한 땅(#f5f3ec)과 바다(#dbeafe) 위에서 넷이 서로 구별되어야 하고,
 * 흑백으로 인쇄해도 밝기가 달라야 한다.
 */
export const SEASON_COLOR: Record<Season, string> = {
  봄: "#4f9a3f",
  여름: "#0a8ea0",
  가을: "#e2661b",
  겨울: "#3c5580",
};
