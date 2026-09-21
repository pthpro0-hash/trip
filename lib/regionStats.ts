import type { Season, Spot, Theme } from "./types";

export interface Tally<T> {
  value: T;
  count: number;
}

export interface RegionStats {
  count: number;
  /** 많은 순. 같은 수면 먼저 나온 순서를 지킨다. */
  themes: Tally<Theme>[];
  /**
   * "사계절"을 뺀 계절. 사계절은 어느 권역에나 흔해서, 넣어 두면
   * 늘 1위가 되고 그 권역이 언제 좋은지는 끝내 말해 주지 않는다.
   */
  seasons: Tally<Season>[];
  foods: Tally<string>[];
  /** 사계절 추천이 붙은 여행지 수. */
  allYearCount: number;
}

const ALL_YEAR: Season = "사계절";

function tally<T>(values: T[]): Tally<T>[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  // Array.prototype.sort는 안정 정렬이라, 동점이면 Map의 삽입 순서가 유지된다.
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function regionStats(spots: Spot[]): RegionStats {
  return {
    count: spots.length,
    themes: tally(spots.flatMap((spot) => spot.themes)),
    seasons: tally(spots.flatMap((spot) => spot.seasons).filter((season) => season !== ALL_YEAR)),
    foods: tally(spots.flatMap((spot) => spot.foods)),
    allYearCount: spots.filter((spot) => spot.seasons.includes(ALL_YEAR)).length,
  };
}

/** 권역 안에 실제로 있는 값만 필터 후보로 내보낸다. 눌러도 0건인 칩은 두지 않는다. */
export function availableThemes(spots: Spot[], order: Theme[]): Theme[] {
  const present = new Set(spots.flatMap((spot) => spot.themes));
  return order.filter((theme) => present.has(theme));
}

export function availableSeasons(spots: Spot[], order: Season[]): Season[] {
  const present = new Set(spots.flatMap((spot) => spot.seasons));
  return order.filter((season) => present.has(season));
}
