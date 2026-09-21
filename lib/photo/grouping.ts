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

/*
  아래 셋은 기계가 잘못 묶은 것을 사람이 바로잡기 위한 것들이다.

  이틀 연속 나들이와 1박 2일 여행은 데이터가 똑같다. 실제 사진에서 재 보니
  06-13→06-14 가 104km/21.8시간, 09-13→09-14 가 90km/20.7시간이었는데
  앞은 따로 간 나들이였고 뒤는 한 여행이었다. 더 영리한 규칙을 짜내는 대신
  사람이 나누고 합칠 수 있게 한다.
*/

/** 이만큼 떨어져 있으면 별개 나들이일 수 있다고 본다. */
export const UNCERTAIN_GAP_KM = 30;

export interface DayBoundary {
  /** 이 날부터 뒤쪽이 갈라져 나간다. */
  day: string;
  km: number;
  hours: number;
  /** 멀리 떨어져 있어 한 여행인지 알 수 없는가. */
  uncertain: boolean;
}

/** 여행 안에서 날이 바뀌는 지점들. 나눌 수 있는 자리이기도 하다. */
export function dayBoundaries(trip: Trip): DayBoundary[] {
  const days = tripDays(trip);
  const boundaries: DayBoundary[] = [];

  for (let i = 1; i < days.length; i += 1) {
    const before = trip.shots.filter((shot) => dayKey(shot.takenAt) === days[i - 1]).at(-1);
    const after = trip.shots.find((shot) => dayKey(shot.takenAt) === days[i]);
    if (!before || !after) continue;

    const km = distanceKm(before, after);
    boundaries.push({
      day: days[i],
      km,
      hours: (after.takenAt.getTime() - before.takenAt.getTime()) / 3_600_000,
      uncertain: km > UNCERTAIN_GAP_KM,
    });
  }
  return boundaries;
}

/** 여행을 어느 날 앞에서 둘로 나눈다. 그 날이 없거나 첫날이면 나누지 않는다. */
export function splitTripAtDay(
  trip: Trip,
  day: string,
  visitRadiusKm = VISIT_RADIUS_KM,
): [Trip, Trip] | null {
  const before = trip.shots.filter((shot) => dayKey(shot.takenAt) < day);
  const after = trip.shots.filter((shot) => dayKey(shot.takenAt) >= day);
  if (before.length === 0 || after.length === 0) return null;

  return [
    { shots: before, visits: splitIntoVisits(before, visitRadiusKm) },
    { shots: after, visits: splitIntoVisits(after, visitRadiusKm) },
  ];
}

/**
 * 합치자고 물어볼 만큼 가까운가.
 *
 * 한 달 떨어진 두 여행에까지 "합치기"를 달면 단추만 늘어난다. 자동으로
 * 묶는 기준이 "하루 이내"이므로, 여기서는 그보다 조금 넉넉히 본다.
 * 가운데 날에 사진이 한 장도 없는 1박 2일이 실제로 이렇게 갈라진다.
 */
export const MERGEABLE_GAP_DAYS = 3;

/** 나뉜 두 여행을 사람이 다시 붙일 만한 사이인가. */
export function canMerge(a: Trip, b: Trip): boolean {
  const end = a.shots.at(-1);
  const start = b.shots[0];
  if (!end || !start) return false;
  const gap = dayIndex(start.takenAt) - dayIndex(end.takenAt);
  return gap >= 0 && gap <= MERGEABLE_GAP_DAYS;
}

/** 두 여행을 하나로 합친다. 방문은 시간순으로 다시 나눈다. */
export function mergeTrips(a: Trip, b: Trip, visitRadiusKm = VISIT_RADIUS_KM): Trip {
  const shots = [...a.shots, ...b.shots].sort(
    (x, y) => x.takenAt.getTime() - y.takenAt.getTime(),
  );
  return { shots, visits: splitIntoVisits(shots, visitRadiusKm) };
}

/**
 * 이름이 같은 이웃 방문을 하나로 합친다.
 *
 * 산에서 1km 넘게 움직였다 돌아오면 같은 곳이 두 번 나온다. 규칙대로이긴
 * 하지만 "매향리 → 매향리"처럼 늘어놓으면 읽는 사람만 어지럽다.
 */
export function mergeAdjacentVisits(
  visits: Visit[],
  labels: string[],
): { visits: Visit[]; labels: string[] } {
  const outVisits: Visit[] = [];
  const outLabels: string[] = [];

  visits.forEach((visit, index) => {
    const label = labels[index];
    if (outLabels.length > 0 && outLabels.at(-1) === label) {
      const last = outVisits.at(-1)!;
      outVisits[outVisits.length - 1] = { shots: [...last.shots, ...visit.shots] };
      return;
    }
    outVisits.push(visit);
    outLabels.push(label);
  });

  return { visits: outVisits, labels: outLabels };
}
