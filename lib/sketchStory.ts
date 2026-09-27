import {
  buildSketch,
  seasonOf,
  sketchShapes,
  type Season,
  type SketchDot,
  type SketchTrip,
  type SketchVisit,
  type Tally,
} from "./sketch";
import { distanceInWords, times } from "./sketchWords";

/*
  한 해의 이야기.

  카드 한 장은 그해를 한눈에 보여 주고, 그 아래 장면들이 한 줄씩 풀어
  말한다 — 몇 번 떠났고, 어디서 가장 많이 찍었고, 어느 계절이었고, 어디를
  처음 밟았는지. 숫자만 늘어놓지 않고 말로 옮긴다. "1,240km"보다
  "서울에서 부산까지를 두 번 오갈 거리"가 몸으로 와닿는다.

  여기서는 셈만 한다. 화면은 이것을 받아 그리기만 한다.
*/

const SEASONS: Season[] = ["봄", "여름", "가을", "겨울"];

/** 한 해를 이루는 여행들. startedOn 의 해로 가른다. */
export function tripsOfYear(trips: SketchTrip[], year: number): SketchTrip[] {
  return trips.filter((trip) => Number(trip.startedOn.slice(0, 4)) === year);
}

/** 기록에 있는 해들. 최근 해부터. */
export function yearsOf(trips: SketchTrip[]): number[] {
  return [...new Set(trips.map((trip) => Number(trip.startedOn.slice(0, 4))))]
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
}

export interface SeasonBar {
  season: Season;
  trips: number;
}

export interface YearCompare {
  previousYear: number;
  /** "2025년보다 네 번 더 떠났어요" */
  tripsLine: string;
  /** "사진은 120장 더 남겼어요" · 같으면 null */
  photosLine: string | null;
}

export interface YearStory {
  year: number;
  tripCount: number;
  placeCount: number;
  photoCount: number;
  distanceKm: number;
  /** "서울에서 부산까지를 두 번 오갈 거리". 짧으면 null. */
  distanceWords: string | null;
  /** 사진을 가장 많이 남긴 곳. 사진을 하나도 안 올렸으면 null. */
  topPlace: SketchDot | null;
  /** 봄·여름·가을·겨울 순서 그대로. */
  seasons: SeasonBar[];
  /** "여름에 가장 많이 떠났어요". 여행이 없으면 null. */
  seasonLine: string | null;
  /** 그해 사진을 가장 많이 남긴 곳들의 대표 사진. 많이 찍은 곳부터. */
  photoPaths: string[];
  /** 그해 밟은 시도. 셀 수 없으면 빈 배열. */
  sido: string[];
  /**
   * 그해 처음 밟은 시도. 그보다 이른 해의 기록이 없으면 null —
   * 기록의 첫 해에는 모든 곳이 "처음"이라, 그 말은 아무것도 알려 주지 않는다.
   */
  firstSido: string[] | null;
  compare: YearCompare | null;
  /** 함께한 사람. 적어 둔 여행이 없으면 빈 배열. */
  companions: Tally[];
}

/** 시도를 가리는 셈. lib/sido 가 무거워(60KB) 부르는 쪽이 넘겨준다. */
export type SidoOf = (visit: SketchVisit) => string | null;

function sidoSet(trips: SketchTrip[], sidoOf: SidoOf | undefined): Set<string> {
  const found = new Set<string>();
  if (!sidoOf) return found;
  for (const trip of trips) {
    for (const visit of trip.visits) {
      const name = sidoOf(visit);
      if (name) found.add(name);
    }
  }
  return found;
}

/** "봄", "봄과 가을", "봄, 여름과 가을" */
function joinKorean(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")}과 ${words.at(-1)}`;
}

function seasonLineOf(seasons: SeasonBar[]): string | null {
  const most = Math.max(...seasons.map((bar) => bar.trips));
  if (most === 0) return null;
  const top = seasons.filter((bar) => bar.trips === most).map((bar) => bar.season);
  // 네 계절이 다 같으면 "가장"이 아니다.
  if (top.length === SEASONS.length) return "계절마다 고르게 떠났어요";
  return `${joinKorean(top)}에 가장 많이 떠났어요`;
}

function compareLine(now: number, before: number, previousYear: number): string {
  if (now === before) return `${previousYear}년과 같이 ${times(now)} 떠났어요`;
  const gap = Math.abs(now - before);
  return `${previousYear}년보다 ${times(gap)} ${now > before ? "더" : "덜"} 떠났어요`;
}

/**
 * 한 해의 이야기를 셈한다.
 *
 * @param all 모든 해의 여행. 작년과 견주고 "처음 밟은 시도"를 가리는 데 쓴다.
 * @param sidoOf 없으면 시도 장면을 비워 둔다.
 */
export function yearStory(all: SketchTrip[], year: number, sidoOf?: SidoOf): YearStory {
  const trips = tripsOfYear(all, year);
  const sketch = buildSketch(trips);
  const shapes = sketchShapes(trips);
  const withPhotos = shapes.dots
    .filter((dot) => dot.photoPath && dot.photoCount > 0)
    .sort((a, b) => b.photoCount - a.photoCount || a.placeName.localeCompare(b.placeName, "ko"));

  const seasons = SEASONS.map((season) => ({
    season,
    trips: trips.filter((trip) => seasonOf(trip.startedOn) === season).length,
  }));

  const earlierTrips = all.filter((trip) => Number(trip.startedOn.slice(0, 4)) < year);
  const thisSido = sidoSet(trips, sidoOf);
  const beforeSido = sidoSet(earlierTrips, sidoOf);

  /*
    작년과 견준다. 딱 한 해 전이 비어 있으면 그 앞의 가장 가까운 해와
    견준다 — "2023년보다"라고 적으니 헷갈릴 일은 없다.
  */
  const previousYear = yearsOf(earlierTrips)[0];
  let compare: YearCompare | null = null;
  if (previousYear !== undefined) {
    const before = buildSketch(tripsOfYear(all, previousYear));
    const photoGap = sketch.photoCount - before.photoCount;
    compare = {
      previousYear,
      tripsLine: compareLine(sketch.tripCount, before.tripCount, previousYear),
      photosLine:
        photoGap === 0
          ? null
          : `사진은 ${Math.abs(photoGap).toLocaleString("ko-KR")}장 ${photoGap > 0 ? "더" : "덜"} 남겼어요`,
    };
  }

  return {
    year,
    tripCount: sketch.tripCount,
    placeCount: sketch.placeCount,
    photoCount: sketch.photoCount,
    distanceKm: Math.round(sketch.distanceKm),
    distanceWords: distanceInWords(sketch.distanceKm),
    topPlace: withPhotos[0] ?? null,
    seasons,
    seasonLine: seasonLineOf(seasons),
    photoPaths: withPhotos.slice(0, 6).map((dot) => dot.photoPath!),
    sido: [...thisSido],
    firstSido: earlierTrips.length === 0 ? null : [...thisSido].filter((name) => !beforeSido.has(name)),
    compare,
    companions: sketch.byCompanion,
  };
}
