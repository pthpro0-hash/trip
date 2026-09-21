import { distanceKm } from "../geo";
import type { LivingArea, Shot, Trip, Visit } from "./types";

/** 집 주변으로 볼 범위. */
export const LIVING_AREA_RADIUS_KM = 2.0;
/** 이보다 멀어지면 같은 여행 안의 다른 방문지로 본다. */
export const VISIT_RADIUS_KM = 1.0;

/**
 * 벽시계 기준 날짜. `toISOString()`을 쓰면 KST 오전 사진이 전날로 밀려
 * 하루짜리 나들이가 이틀로 쪼개진다. 실제로 겪은 버그다.
 */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 날짜끼리 며칠 떨어졌는지 세기 위한 일련번호. */
export function dayIndex(date: Date): number {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round(midnight.getTime() / 86_400_000);
}

/**
 * 생활권 찾기.
 *
 * 사진이 가장 많은 곳이 아니라 **서로 다른 날이 가장 많은 곳**을 고른다.
 * 하루에 몰아 찍는 여행지는 사진이 많아도 하루뿐이고, 집은 사진이 적어도
 * 여러 날에 걸쳐 되풀이된다. 하루만 찍힌 곳은 생활권일 리 없으므로
 * 이틀 이상일 때만 인정한다.
 */
export function findLivingArea(
  shots: Shot[],
  radiusKm: number = LIVING_AREA_RADIUS_KM,
): LivingArea | null {
  const areas: { lat: number; lng: number; shots: Shot[]; days: Set<string> }[] = [];

  for (const shot of shots) {
    const hit = areas.find((area) => distanceKm(area, shot) < radiusKm);
    if (hit) {
      hit.shots.push(shot);
      hit.days.add(dayKey(shot.takenAt));
    } else {
      areas.push({
        lat: shot.lat,
        lng: shot.lng,
        shots: [shot],
        days: new Set([dayKey(shot.takenAt)]),
      });
    }
  }

  const best = areas.sort((a, b) => b.days.size - a.days.size)[0];
  if (!best || best.days.size < 2) return null;

  return { lat: best.lat, lng: best.lng, shots: best.shots, dayCount: best.days.size };
}

/**
 * 여행으로 자르기.
 *
 * 하루 넘게 비면 다른 여행이다. 이어진 날은 한 여행으로 둔다 —
 * 1박 2일은 저녁과 다음날 아침 사이가 스무 시간 가까이 비기 때문에,
 * 시간 간격만으로 자르면 두 여행으로 쪼개진다.
 */
export function groupIntoTrips(shots: Shot[], visitRadiusKm = VISIT_RADIUS_KM): Trip[] {
  const ordered = [...shots].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
  const trips: Trip[] = [];

  for (const shot of ordered) {
    const current = trips.at(-1);
    const previous = current?.shots.at(-1);
    const consecutive =
      previous !== undefined && dayIndex(shot.takenAt) - dayIndex(previous.takenAt) <= 1;

    if (current && consecutive) current.shots.push(shot);
    else trips.push({ shots: [shot], visits: [] });
  }

  for (const trip of trips) {
    trip.visits = splitIntoVisits(trip.shots, visitRadiusKm);
  }
  return trips;
}

/** 한 여행 안에서 장소가 바뀌는 지점마다 방문을 나눈다. */
export function splitIntoVisits(shots: Shot[], radiusKm = VISIT_RADIUS_KM): Visit[] {
  const visits: Visit[] = [];

  for (const shot of shots) {
    const current = visits.at(-1);
    const last = current?.shots.at(-1);
    if (current && last && distanceKm(last, shot) < radiusKm) current.shots.push(shot);
    else visits.push({ shots: [shot] });
  }
  return visits;
}

/** 그 여행이 걸친 날짜들. */
export function tripDays(trip: Trip): string[] {
  return [...new Set(trip.shots.map((shot) => dayKey(shot.takenAt)))].sort();
}
