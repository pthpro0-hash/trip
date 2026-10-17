import { distanceKm } from "../geo";
import { dayIndex, dayKey, groupIntoTrips, MERGEABLE_GAP_DAYS, mergeTrips, splitIntoVisits } from "./grouping";
import type { Shot, Trip } from "./types";

/*
  위치를 모르는 사진을 사람이 정해 준 날짜와 장소로 여행에 넣는다.

  메신저로 받은 사진이나 위치 저장을 꺼 둔 사진은 좌표가 없어 여행으로 묶을 수 없었다. 여행은 좌표로 움직이므로(방문 · 지도 핀),
  사람이 정한 좌표를 사진에 붙여 평소 사진과 같은 모양(Shot)으로 만들어 주면 그 뒤는 지금 길을 그대로 탄다.
  사진마다 정하면 너무 번거로워 '찍은 날 하루'를 한 묶음으로 두고, 묶음마다 날짜와 장소 한 곳을 정한다.
*/

export interface UnlocatedPhoto {
  id: string;
  takenAt: Date;
  /** 촬영 시각이 없어 파일 날짜로 어림한 것. */
  guessed: boolean;
}

/** 같은 날 찍은 위치 모르는 사진 묶음. key 는 처음 찍힌 것으로 본 날짜(YYYY-MM-DD). */
export interface UnlocatedGroup {
  key: string;
  photos: UnlocatedPhoto[];
  /** 한 장이라도 날짜를 어림한 것이면 날짜를 확인해 달라고 알린다. */
  guessed: boolean;
}

/** 사람이 정한 장소. */
export interface PickedPlace {
  title: string;
  lat: number;
  lng: number;
  /** 법정동 문자열("서울 종로구 사직동") — 권역을 읽는 데 쓴다. */
  dong: string | null;
  /** 여행 100선에 있는 곳이면 그 id. */
  spotId: string | null;
}

/** 날짜 입력칸이 주는 "YYYY-MM-DD". 달력에 있는 날이어야 한다. */
export function isDayKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** 찍은 날(벽시계)로 묶는다. 날짜순, 같은 날은 찍은 순. */
export function groupByDay(photos: { id: string; takenAt: Date; guessed?: boolean }[]): UnlocatedGroup[] {
  const byDay = new Map<string, UnlocatedPhoto[]>();
  // 날짜를 읽을 수 없는 것(Date 가 아니거나 달력에 없는 시각)은 묶을 수 없다 — 하나 때문에 화면 전체가 멈추지 않게 거른다.
  const dated = photos.filter((photo) => photo.takenAt instanceof Date && Number.isFinite(photo.takenAt.getTime()));
  for (const photo of [...dated].sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())) {
    const key = dayKey(photo.takenAt);
    const list = byDay.get(key) ?? [];
    list.push({ id: photo.id, takenAt: photo.takenAt, guessed: photo.guessed === true });
    byDay.set(key, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, photos: list, guessed: list.some((photo) => photo.guessed) }));
}

/** 묶음을 정한 날짜와 장소로 사진(Shot)으로 만든다. 시각(시·분)은 그대로 두고 날짜만 옮겨 찍은 차례가 유지된다. */
export function shotsFor(group: UnlocatedGroup, day: string, place: Pick<PickedPlace, "lat" | "lng">): Shot[] {
  const [year, month, date] = day.split("-").map(Number);
  return group.photos.map((photo) => ({
    id: photo.id,
    takenAt: new Date(year, month - 1, date, photo.takenAt.getHours(), photo.takenAt.getMinutes(), photo.takenAt.getSeconds()),
    lat: place.lat,
    lng: place.lng,
  }));
}

/** 여행 목록에서 이 사진들을 뺀다. 남은 사진으로 여행을 다시 짓고, 하나도 안 남은 여행은 없앤다. */
export function removeShots(trips: Trip[], ids: Set<string>): Trip[] {
  return trips.flatMap((trip) => {
    if (!trip.shots.some((shot) => ids.has(shot.id))) return [trip];
    const rest = trip.shots.filter((shot) => !ids.has(shot.id));
    return rest.length === 0 ? [] : groupIntoTrips(rest);
  });
}

/** 두 여행의 날짜가 겹치거나 합쳐 볼 만큼 이어지는가(어느 쪽이 앞이든, 한쪽이 다른 쪽 안에 들어 있든). */
function adjacent(a: Trip, b: Trip): boolean {
  const [aStart, aEnd] = [dayIndex(a.shots[0].takenAt), dayIndex(a.shots.at(-1)!.takenAt)];
  const [bStart, bEnd] = [dayIndex(b.shots[0].takenAt), dayIndex(b.shots.at(-1)!.takenAt)];
  return Math.max(bStart - aEnd, aStart - bEnd) <= MERGEABLE_GAP_DAYS;
}

/**
 * 정한 사진들을 여행 목록에 더한다. 이미 있는 여행과 날짜가 겹치거나 이어지면 그 여행에 합치고, 아니면 새 여행으로 두어
 * 날짜순 자리에 끼운다.
 */
export function addShots(trips: Trip[], shots: Shot[]): Trip[] {
  const next = [...trips];
  for (const fresh of groupIntoTrips(shots)) {
    const index = next.findIndex((trip) => adjacent(trip, fresh));
    if (index >= 0) next[index] = mergeTrips(next[index], fresh);
    else next.push(fresh);
  }
  return next.sort((a, b) => a.shots[0].takenAt.getTime() - b.shots[0].takenAt.getTime());
}

/** 같은 날 위치가 있는 사진을 이만큼 안에서 찾으면 사람이 고른 장소가 곧 그 자리라고 본다(찾은 좌표와 찍힌 좌표의 어긋남). */
export const SNAP_KM = 3;

/** 그날(YYYY-MM-DD) 찍힌 위치 있는 사진만 시간순으로. */
export function onDay(shots: Shot[], day: string): Shot[] {
  return shots.filter((shot) => dayKey(shot.takenAt) === day).sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
}

/**
 * 같은 날 위치 있는 사진이 있으면 그 사진들의 자리에 맞춰 위치 모르는 묶음을 넣는다 — 단체 카톡방에서 받은 사진과 내가 찍은 사진을
 * 함께 올리는 흔한 경우, 장소를 다시 찾지 않아도 되게. 위치 있는 사진이 그날 하나도 없으면 null(사람이 정해야 한다).
 *
 *   · 그날 한 곳에서만 찍었으면 그 곳.
 *   · 여러 곳이면, 찍은 시각을 아는 사진은 시각이 가장 가까운 사진의 곳, 시각을 어림한 사진(받은 날 · 받은 시각일 수 있다)은
 *     그날 사진이 가장 많은 곳. 어림한 시각은 믿을 수 없어 그 곳의 마지막 사진 시각에 붙인다 — 그래야 방문이 갈라지지 않는다.
 * 좌표는 위치 있는 사진의 것을 그대로 쓴다(찾아서 넣은 좌표와의 어긋남으로 같은 곳이 두 곳이 되지 않게).
 */
export function shotsByDay(group: UnlocatedGroup, day: string, located: Shot[]): Shot[] | null {
  const sameDay = onDay(located, day);
  if (sameDay.length === 0) return null;

  const visits = splitIntoVisits(sameDay);
  const biggest = visits.reduce((best, visit) => (visit.shots.length > best.shots.length ? visit : best), visits[0]);
  const [year, month, date] = day.split("-").map(Number);

  return group.photos.map((photo) => {
    const time = new Date(year, month - 1, date, photo.takenAt.getHours(), photo.takenAt.getMinutes(), photo.takenAt.getSeconds());
    if (visits.length === 1) return { id: photo.id, takenAt: time, lat: sameDay[0].lat, lng: sameDay[0].lng };

    if (photo.guessed) {
      const home = biggest.shots.at(-1)!;
      return { id: photo.id, takenAt: home.takenAt, lat: home.lat, lng: home.lng };
    }
    const near = sameDay.reduce((best, shot) =>
      Math.abs(shot.takenAt.getTime() - time.getTime()) < Math.abs(best.takenAt.getTime() - time.getTime()) ? shot : best,
    );
    return { id: photo.id, takenAt: time, lat: near.lat, lng: near.lng };
  });
}

/** 사람이 찾아 고른 장소 근처(SNAP_KM)에 그날 찍힌 위치 있는 사진이 있으면, 그 사진의 좌표로 맞춘다. 없으면 null. */
export function snapToDay<T extends { lat: number; lng: number }>(place: T, day: string, located: Shot[]): Shot | null {
  let best: Shot | null = null;
  let bestKm = SNAP_KM;
  for (const shot of onDay(located, day)) {
    const km = distanceKm(place, shot);
    if (km < bestKm) {
      best = shot;
      bestKm = km;
    }
  }
  return best;
}
