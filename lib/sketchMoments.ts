import { distanceKm, formatDistance } from "./geo";
import type { SketchTrip, SketchVisit } from "./sketch";

/*
  한 해의 순간 셋 — 이미 기록한 데이터에서 계산한다(서버·이용 기록 없음).

    첫 길     그해 가장 먼저 다녀온 곳.
    하루 최다  사진을 가장 많이 찍은 하루와 그날 가장 많이 찍은 곳.
    가장 멀리  자주 다닌 곳(사진 수로 무게를 둔 가운데)에서 가장 멀리 간 곳.
  기록이 모자라 말하기 어려운 순간은 빼고 돌려준다.
*/

export interface Moment {
  key: "first" | "busiest" | "farthest";
  /** "해의 첫 길" 같은 이름. */
  label: string;
  /** 크게 보일 값. */
  value: string;
  /** 값 아래 작은 설명. */
  note: string;
}

/** 이보다 가까우면 '가장 멀리'라고 말할 만하지 않다. */
export const FARTHEST_MIN_KM = 20;

/** "2026-09-14" → "9월 14일". */
export function dayInWords(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${month}월 ${date}일`;
}

const dayOf = (trip: SketchTrip, visit: SketchVisit) => visit.visitedOn || trip.startedOn;

export function yearMoments(trips: SketchTrip[]): Moment[] {
  const visits = trips.flatMap((trip) => trip.visits.map((visit) => ({ trip, visit, day: dayOf(trip, visit) })));
  if (visits.length === 0) return [];
  const moments: Moment[] = [];

  // 첫 길 — 가장 이른 날, 같은 날이면 앞선 여행의 첫 방문.
  const first = [...visits].sort((a, b) => a.day.localeCompare(b.day))[0];
  moments.push({ key: "first", label: "해의 첫 길", value: dayInWords(first.day), note: `${first.visit.placeName}에서` });

  // 하루 최다 — 날짜별 사진 수의 합.
  const perDay = new Map<string, { photos: number; best: { name: string; photos: number } }>();
  for (const { visit, day } of visits) {
    const entry = perDay.get(day) ?? { photos: 0, best: { name: visit.placeName, photos: -1 } };
    entry.photos += visit.photoCount;
    if (visit.photoCount > entry.best.photos) entry.best = { name: visit.placeName, photos: visit.photoCount };
    perDay.set(day, entry);
  }
  const busiest = [...perDay.entries()].sort((a, b) => b[1].photos - a[1].photos || a[0].localeCompare(b[0]))[0];
  if (busiest && busiest[1].photos >= 2) {
    moments.push({ key: "busiest", label: "하루 최다", value: `${busiest[1].photos}장`, note: `${dayInWords(busiest[0])} · ${busiest[1].best.name}` });
  }

  // 가장 멀리 — 사진 수로 무게를 둔 가운데에서 가장 먼 방문.
  if (visits.length >= 2) {
    const weight = (visit: SketchVisit) => Math.max(1, visit.photoCount);
    const total = visits.reduce((sum, { visit }) => sum + weight(visit), 0);
    const center = {
      lat: visits.reduce((sum, { visit }) => sum + visit.lat * weight(visit), 0) / total,
      lng: visits.reduce((sum, { visit }) => sum + visit.lng * weight(visit), 0) / total,
    };
    const far = visits
      .map((item) => ({ item, km: distanceKm(center, { lat: item.visit.lat, lng: item.visit.lng }) }))
      .sort((a, b) => b.km - a.km)[0];
    if (far.km >= FARTHEST_MIN_KM) {
      moments.push({ key: "farthest", label: "가장 멀리", value: `약 ${formatDistance(far.km)}`, note: `${far.item.visit.placeName} · 자주 다닌 곳에서` });
    }
  }

  return moments;
}
