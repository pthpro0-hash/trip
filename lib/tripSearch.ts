import { isChosungQuery, normalize, toChosung } from "./textMatch";

/*
  내 기록 찾기.

  사람은 이렇게 기억한다 — "작년쯤, 바다, 민수랑". 정확한 날짜와 장소명으로
  찾지 않는다. 그래서 한 줄에 시기와 사람과 장소를 섞어 던져도 받아낸다.

  낱말 하나하나가 모두 맞아야 한다(AND). "작년 민수"는 작년이면서 민수와
  간 여행이지, 작년이거나 민수와 간 여행이 아니다.
*/

/** 검색 대상이 되는 기록 한 건. 화면이 쓰는 모양과 따로 둔다. */
export interface SearchableTrip {
  id: string;
  startedOn: string;
  endedOn: string;
  companions: string | null;
  note: string | null;
  placeNames: string[];
  dongs: string[];
}

const SCORE = {
  companion: 60,
  placeExact: 100,
  placeIncludes: 55,
  dong: 40,
  note: 20,
  chosung: 35,
  /** 시기는 걸러 내는 조건이지 점수를 매길 것이 아니다. */
  time: 10,
} as const;

const SEASON_MONTHS: Record<string, number[]> = {
  봄: [3, 4, 5],
  여름: [6, 7, 8],
  가을: [9, 10, 11],
  겨울: [12, 1, 2],
};

const YEAR_OFFSET: Record<string, number> = {
  올해: 0,
  금년: 0,
  작년: -1,
  지난해: -1,
  재작년: -2,
};

export interface TimeHint {
  year?: number;
  month?: number;
  season?: string;
}

/**
 * "작년", "2025년", "9월", "가을" 같은 낱말을 시기 조건으로 읽는다.
 * 시기가 아니면 null — 그러면 글자 매칭으로 넘어간다.
 */
export function parseTimeTerm(term: string, now: Date): TimeHint | null {
  const offset = YEAR_OFFSET[term];
  if (offset !== undefined) return { year: now.getFullYear() + offset };

  const year = term.match(/^(\d{4})년?$/);
  if (year) return { year: Number(year[1]) };

  const month = term.match(/^(\d{1,2})월$/);
  if (month) {
    const value = Number(month[1]);
    if (value >= 1 && value <= 12) return { month: value };
  }

  if (SEASON_MONTHS[term]) return { season: term };

  return null;
}

/** 그 여행이 시기 조건에 드는가. 하루라도 걸치면 든 것으로 본다. */
export function matchesTime(trip: SearchableTrip, hint: TimeHint): boolean {
  const start = new Date(`${trip.startedOn}T00:00:00`);
  const end = new Date(`${trip.endedOn}T00:00:00`);

  for (const date of [start, end]) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (hint.year !== undefined && year !== hint.year) continue;
    if (hint.month !== undefined && month !== hint.month) continue;
    if (hint.season && !SEASON_MONTHS[hint.season].includes(month)) continue;
    return true;
  }
  return false;
}

function scoreText(trip: SearchableTrip, term: string): number {
  const needle = normalize(term);
  if (needle.length === 0) return 0;

  let best = 0;

  for (const place of trip.placeNames) {
    const name = normalize(place);
    if (name === needle) best = Math.max(best, SCORE.placeExact);
    else if (name.includes(needle)) best = Math.max(best, SCORE.placeIncludes);
  }

  if (trip.companions && normalize(trip.companions).includes(needle)) {
    best = Math.max(best, SCORE.companion);
  }

  for (const dong of trip.dongs) {
    // 행정동은 "강원특별자치도 강릉시 송정동"처럼 이어져 있어, 낱말 앞에서
    // 끊어 본다. 그러지 않으면 "안동"이 "장안동"에 걸린다.
    if (dong.split(/\s+/).some((word) => normalize(word).startsWith(needle))) {
      best = Math.max(best, SCORE.dong);
    }
  }

  if (trip.note && normalize(trip.note).includes(needle)) {
    best = Math.max(best, SCORE.note);
  }

  // 초성으로만 친 검색어는 장소와 사람 이름에만 맞춰 본다.
  if (best === 0 && isChosungQuery(term)) {
    const haystacks = [...trip.placeNames, trip.companions ?? ""];
    if (haystacks.some((text) => toChosung(normalize(text)).includes(term))) {
      best = SCORE.chosung;
    }
  }

  return best;
}

export function scoreTrip(trip: SearchableTrip, query: string, now = new Date()): number {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  let total = 0;

  for (const term of terms) {
    const hint = parseTimeTerm(term, now);
    if (hint) {
      // 시기를 말했는데 그때가 아니면 그 여행은 아니다.
      if (!matchesTime(trip, hint)) return 0;
      total += SCORE.time;
      continue;
    }

    const score = scoreText(trip, term);
    if (score === 0) return 0;
    total += score;
  }

  return total;
}

export function searchTrips<T extends SearchableTrip>(
  trips: T[],
  query: string,
  now = new Date(),
): T[] {
  if (query.trim().length === 0) return trips;

  return trips
    .map((trip) => ({ trip, score: scoreTrip(trip, query, now) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ trip }) => trip);
}

/** 기록에 실제로 나온 동행자들. 필터 칩으로 쓴다. */
export function companionOptions(trips: SearchableTrip[]): string[] {
  const seen = new Map<string, number>();
  for (const trip of trips) {
    const name = trip.companions?.trim();
    if (!name) continue;
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** 기록이 걸쳐 있는 연도들. 최근 순. */
export function yearOptions(trips: SearchableTrip[]): number[] {
  const years = new Set<number>();
  for (const trip of trips) {
    years.add(Number(trip.startedOn.slice(0, 4)));
    years.add(Number(trip.endedOn.slice(0, 4)));
  }
  return [...years].sort((a, b) => b - a);
}
