import type { TripDetail } from "./supabase/tripDetail";

/*
  여행 하나(상세 페이지)를 링크로 보여 주기.

  한 장 요약 링크(lib/share.ts)와 같은 방식이다. 링크를 만들 때 그 순간의
  모습을 베껴 두고(스냅샷), 남이 보는 페이지는 이 베낀 것만 읽는다.
  여행 기록 표에는 닿지 않으므로 받은 사람이 볼 수 있는 것은 이 여행 하나뿐이다.

  싣는 것
    제목·부제, 여행 기간, 다녀온 곳 이름과 그곳에 간 날, 사진.

  싣지 않는 것
    - 함께한 사람의 이름. 그 사람은 공개에 동의한 적이 없다.
    - 적어 둔 메모. 나 혼자 보려고 적은 글이다.
    - 여행 id·사진 id·원본 보관 경로. 남에게는 열리지 않는 주소다.
    - 사진을 찍은 시각. 날짜까지만 남긴다.
  좌표는 소수 둘째 자리(약 1km)로 뭉갠다. 코스를 그리는 데는 그걸로 넉넉하고,
  집 앞 골목까지 알려 줄 이유는 없다.

  이 파일은 셈만 한다. 올리고 지우는 일은 lib/supabase/tripShares.ts 가 한다.
*/

export interface TripSnapshotVisit {
  placeName: string;
  /** 동 이름("강릉시 견소동"). 없을 수 있다. */
  dong: string | null;
  lat: number;
  lng: number;
  /** 그곳에 간 날. "2026-09-13". */
  day: string;
  /** 링크 보관함 속 파일 이름들. */
  photos: string[];
}

export interface TripSnapshot {
  v: 1;
  title: string | null;
  subtitle: string | null;
  startedOn: string;
  endedOn: string;
  visits: TripSnapshotVisit[];
  /** 링크 보관함에 올린 사진 파일들. 끊을 때 이것을 지운다. */
  files: string[];
}

/** 약 1km. */
const blur = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, "0");

/** 찍힌 그대로의 벽시계 날짜. toISOString 을 쓰면 오전이 전날로 밀린다. */
function dayOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 올릴 사진의 원본 보관 경로들. 여행에 나온 차례대로. */
export function tripPhotoPaths(trip: TripDetail): string[] {
  return trip.visits.flatMap((visit) => visit.photos.map((photo) => photo.storagePath));
}

/**
 * 스냅샷을 짓는다. files 는 원본 보관 경로 → 링크 보관함 파일 이름이고,
 * 여기에 없는 사진(올리지 못한 것)은 싣지 않는다.
 */
export function buildTripSnapshot(trip: TripDetail, files: Map<string, string>): TripSnapshot {
  const visits = trip.visits.map((visit) => ({
    placeName: visit.placeName,
    dong: visit.dong,
    lat: blur(visit.lat),
    lng: blur(visit.lng),
    day: dayOf(visit.startedAt),
    photos: visit.photos.flatMap((photo) => {
      const file = files.get(photo.storagePath);
      return file ? [file] : [];
    }),
  }));
  return {
    v: 1,
    title: trip.title,
    subtitle: trip.subtitle,
    startedOn: trip.startedOn,
    endedOn: trip.endedOn,
    visits,
    files: visits.flatMap((visit) => visit.photos),
  };
}

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isDay = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
/** 파일 이름은 링크 폴더 한 칸이다. "../" 같은 것이 섞이지 않게 한다. */
const isFileName = (value: unknown): value is string => isString(value) && /^[A-Za-z0-9._-]{1,80}$/.test(value);

/**
 * 내려받은 것이 이 화면이 아는 스냅샷인가. 모르는 판이면 그리지 않는다.
 * 스냅샷은 만든 사람의 브라우저가 적은 것이라, 그리는 데 쓰는 칸은 다 확인한다.
 */
export function isTripSnapshot(value: unknown): value is TripSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Record<string, unknown>;
  if (snap.v !== 1) return false;
  if (!isNullableString(snap.title) || !isNullableString(snap.subtitle)) return false;
  if (!isDay(snap.startedOn) || !isDay(snap.endedOn)) return false;
  if (!Array.isArray(snap.files) || !snap.files.every(isFileName)) return false;
  if (!Array.isArray(snap.visits)) return false;
  return snap.visits.every((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const visit = raw as Record<string, unknown>;
    return (
      isString(visit.placeName) &&
      isNullableString(visit.dong) &&
      isNumber(visit.lat) &&
      isNumber(visit.lng) &&
      isDay(visit.day) &&
      Array.isArray(visit.photos) &&
      visit.photos.every(isFileName)
    );
  });
}

/** 링크에 띄울 이름. 제목을 짓지 않았으면 기간으로. */
export function tripShareTitle(snapshot: TripSnapshot): string {
  if (snapshot.title && snapshot.title.trim()) return snapshot.title.trim();
  const short = (value: string) => `${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일`;
  const year = snapshot.startedOn.slice(0, 4);
  return snapshot.startedOn === snapshot.endedOn
    ? `${year}년 ${short(snapshot.startedOn)}`
    : `${year}년 ${short(snapshot.startedOn)} ~ ${short(snapshot.endedOn)}`;
}
