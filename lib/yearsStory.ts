import { buildSketch, sketchShapes, type Sketch, type SketchShapes, type SketchTrip } from "./sketch";
import { tripsOfYear, yearsOf, type SidoOf } from "./sketchStory";
import { times } from "./sketchWords";

/*
  지금까지 전부를 한 장으로.

  모든 해를 한 장에 그냥 겹치면 해가 섞여 뭉개진다 — 어느 선이 올해고
  어느 점이 삼 년 전인지 알 수 없다. 그래서 해마다 색을 달리한다. 계절
  색은 한 해 안에서만 뜻이 있으니 여기서는 쓰지 않는다.

  그리고 해끼리 견준다. "작년보다 두 번 더"는 한 해 화면이 말하고,
  여기서는 모든 해를 한 줄에 세워 어느 해가 가장 많이 떠났는지,
  어느 해에 처음 밟은 곳이 많았는지를 보여 준다.
*/

/*
  해의 색. 가장 최근 해가 첫 색(앱의 파란색)이다 — 가장 먼저 눈이 가야
  할 해다. 서로 이웃한 해끼리 헷갈리지 않게 색상환에서 멀리 떨어진
  것부터 늘어놓았다. 여덟 해를 넘으면 돌아서 다시 쓴다.
*/
export const YEAR_COLORS = [
  "#0071e3",
  "#e2661b",
  "#4f9a3f",
  "#8e44ad",
  "#0a8ea0",
  "#c0392b",
  "#b8860b",
  "#3c5580",
];

/** 해마다 색. years 는 어떤 차례든 괜찮다 — 최근 해부터 색을 준다. */
export function yearColors(years: number[]): Map<number, string> {
  const recentFirst = [...new Set(years)].sort((a, b) => b - a);
  return new Map(recentFirst.map((year, index) => [year, YEAR_COLORS[index % YEAR_COLORS.length]]));
}

export interface YearRow {
  year: number;
  color: string;
  tripCount: number;
  placeCount: number;
  photoCount: number;
  distanceKm: number;
  /** 그해 밟은 시도 수. 시도 셈이 없으면 0. */
  sidoCount: number;
  /** 그해 처음 밟은 시도 수. 기록의 첫 해는 모두가 처음이라 null. */
  newSidoCount: number | null;
}

export interface YearLayer {
  year: number;
  color: string;
  shapes: SketchShapes;
}

export interface YearsStory {
  /** 해마다 한 줄. 오래된 해부터 — 읽으면 시간이 흐른다. */
  rows: YearRow[];
  /** 지도에 겹칠 해마다의 모양. 오래된 해부터 — 최근 해가 맨 위에 그려진다. */
  layers: YearLayer[];
  total: Sketch;
  /** 모든 해에 걸쳐 밟은 시도. */
  sido: string[];
  /** "3년 동안 열두 번 떠났어요" */
  spanLine: string;
  /** 가장 많이 떠난 해. 같으면 최근 해. 해가 하나면 null. */
  busiest: YearRow | null;
  /** 사진을 가장 많이 남긴 해. */
  mostPhotos: YearRow | null;
  /** 처음 밟은 시도가 가장 많았던 해(기록의 첫 해는 빼고). 없으면 null. */
  mostNew: YearRow | null;
}

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

/** 가장 큰 값의 줄. 같으면 최근 해. 모두 0 이면 null. */
function topBy(rows: YearRow[], value: (row: YearRow) => number | null): YearRow | null {
  let best: YearRow | null = null;
  for (const row of rows) {
    const v = value(row);
    if (v === null || v <= 0) continue;
    if (!best || v > (value(best) ?? 0) || (v === value(best) && row.year > best.year)) best = row;
  }
  return best;
}

export function yearsStory(all: SketchTrip[], sidoOf?: SidoOf): YearsStory {
  const years = yearsOf(all).sort((a, b) => a - b);
  const colors = yearColors(years);
  const seen = new Set<string>();

  const rows: YearRow[] = [];
  const layers: YearLayer[] = [];
  for (const [index, year] of years.entries()) {
    const trips = tripsOfYear(all, year);
    const sketch = buildSketch(trips);
    const sido = sidoSet(trips, sidoOf);
    const fresh = [...sido].filter((name) => !seen.has(name));
    for (const name of sido) seen.add(name);
    const color = colors.get(year)!;
    rows.push({
      year,
      color,
      tripCount: sketch.tripCount,
      placeCount: sketch.placeCount,
      photoCount: sketch.photoCount,
      distanceKm: Math.round(sketch.distanceKm),
      sidoCount: sido.size,
      newSidoCount: index === 0 ? null : fresh.length,
    });
    layers.push({ year, color, shapes: sketchShapes(trips) });
  }

  const total = buildSketch(all);
  return {
    rows,
    layers,
    total,
    sido: [...seen],
    spanLine: spanLineOf(rows, total.tripCount),
    ...yearsHighlights(rows),
  };
}

/** "3년 동안 열두 번 떠났어요" */
export function spanLineOf(rows: YearRow[], tripCount: number): string {
  if (rows.length === 0) return "";
  return rows.length > 1
    ? `${rows.length}년 동안 ${times(tripCount)} 떠났어요`
    : `${rows[0].year}년에 ${times(tripCount)} 떠났어요`;
}

/** 해끼리 견준 셋. 해가 하나면 견줄 것이 없어 모두 null. 링크 페이지도 이것으로 다시 센다. */
export function yearsHighlights(rows: YearRow[]): Pick<YearsStory, "busiest" | "mostPhotos" | "mostNew"> {
  const several = rows.length > 1;
  return {
    busiest: several ? topBy(rows, (row) => row.tripCount) : null,
    mostPhotos: several ? topBy(rows, (row) => row.photoCount) : null,
    mostNew: several ? topBy(rows, (row) => row.newSidoCount) : null,
  };
}
