/*
  시간으로 거르고, 시간으로 되짚는다.

  지도는 "어디"를 보여 주고, 이 파일은 "언제"를 맡는다. 월별 막대로
  기간을 고르면 지도가 그 기간만 남기고, 다시 걷기는 고른 여행을 찍은
  순서대로 따라간다.
*/

/** 찍은 때가 있는 것. HubPlace 가 이 꼴을 갖췄다. */
interface Dated {
  visitId: string;
  startedAt: string;
  photoCount: number;
}

/** 두 끝을 포함하는 달의 구간. "2026-03" 꼴. */
export type MonthRange = readonly [from: string, to: string];

/** "2026-09-14 06:11:00" → "2026-09" */
export function monthOf(stamp: string): string {
  return stamp.slice(0, 7);
}

function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * 첫 달부터 마지막 달까지 빠짐없이.
 *
 * 다녀오지 않은 달도 막대 자리를 둔다. 비어 있는 달이 보여야 "이 여름엔
 * 한 번도 안 나갔구나"가 눈에 들어온다.
 */
export function monthSpan(places: Dated[]): string[] {
  if (places.length === 0) return [];
  const months = places.map((place) => monthOf(place.startedAt)).sort();
  const last = months.at(-1)!;
  const span: string[] = [];
  // 몇십 년을 넘기는 일은 없다. 잘못된 날짜가 끝없이 돌게 하지 않도록 막아 둔다.
  for (let month = months[0]; span.length < 600; month = nextMonth(month)) {
    span.push(month);
    if (month === last) break;
  }
  return span;
}

/** 달마다 찍은 사진 수. 막대의 키가 된다. */
export function monthTotals(places: Dated[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const place of places) {
    const month = monthOf(place.startedAt);
    totals.set(month, (totals.get(month) ?? 0) + place.photoCount);
  }
  return totals;
}

/** 고른 기간 안의 것만. 기간이 없으면 전부. */
export function withinMonths<T extends Dated>(places: T[], range: MonthRange | null): T[] {
  if (!range) return places;
  return places.filter((place) => {
    const month = monthOf(place.startedAt);
    return month >= range[0] && month <= range[1];
  });
}

/** 한 해 전체. 그해에 막대가 하나도 없으면 null. */
export function yearRange(months: string[], year: string): MonthRange | null {
  const inYear = months.filter((month) => month.startsWith(`${year}-`));
  return inYear.length > 0 ? [inYear[0], inYear.at(-1)!] : null;
}

/** 막대 줄 위의 가로 위치가 몇 번째 막대인지. 줄 밖으로 끌어도 양 끝에 붙는다. */
export function indexAt(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
}

/** "2026.03 ~ 2026.06", 한 달이면 "2026.03" */
export function rangeLabel(range: MonthRange): string {
  const dot = (month: string) => month.replace("-", ".");
  return range[0] === range[1] ? dot(range[0]) : `${dot(range[0])} ~ ${dot(range[1])}`;
}

/**
 * 다시 걸을 순서. 찍은 때 순서대로.
 *
 * 같은 때면 방문 id 로 가른다 — 되풀이할 때마다 순서가 바뀌면 같은
 * 여행을 두 번 걸어도 다른 길이 된다.
 */
export function replayOrder<T extends Dated>(places: T[]): T[] {
  return [...places].sort(
    (a, b) => a.startedAt.localeCompare(b.startedAt) || a.visitId.localeCompare(b.visitId),
  );
}

/**
 * 한 곳에 머무는 시간.
 *
 * 몇 곳 안 되면 사진을 들여다볼 틈을 넉넉히 준다. 전부를 걸을 때 한
 * 곳에 2초 반씩 머물면 쉰 곳에 2분이 넘는다 — 그때는 걸음을 재촉한다.
 */
export function dwellMs(stops: number): number {
  if (stops <= 12) return 2600;
  if (stops <= 30) return 1900;
  return 1300;
}

interface Stop {
  tripId: string;
  lat: number;
  lng: number;
}

/**
 * 앞의 몇 곳까지 걸은 자국. 여행이 바뀌는 자리에서 끊는다.
 *
 * 전부를 걸을 때 4월의 서울 여행 끝과 7월의 수원 여행 처음을 이으면,
 * 아무도 가지 않은 길이 지도에 그려진다. 한 여행 안에서만 잇는다.
 */
export function trailSegments(stops: Stop[], upTo: number): { lat: number; lng: number }[][] {
  const segments: { lat: number; lng: number }[][] = [];
  for (let i = 0; i < Math.min(upTo, stops.length); i += 1) {
    const { lat, lng } = stops[i];
    if (i === 0 || stops[i - 1].tripId !== stops[i].tripId) segments.push([]);
    segments.at(-1)!.push({ lat, lng });
  }
  return segments;
}

/** 몇 해 전 오늘 다녀온 곳. */
export interface Echo<T> {
  place: T;
  yearsAgo: number;
  /** 날짜까지 같은가. 같으면 "오늘", 며칠 어긋나면 "이맘때". */
  exact: boolean;
}

/** "YYYY-MM-DD" 를 날수로. 한국은 서머타임이 없지만, 셈은 UTC 로 해 둔다. */
function dayNumber(year: number, month: number, day: number): number {
  // 2월 29일이 없는 해로 옮기면 28일로 친다.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Date.UTC(year, month - 1, Math.min(day, last)) / 86_400_000;
}

/**
 * 몇 해 전 이맘때 다녀온 곳 하나.
 *
 * 사진을 새로 넣지 않아도 들어올 이유가 생긴다. 딱 그날만 찾으면 거의
 * 걸리지 않으므로 앞뒤 며칠을 봐준다. 가장 가까운 날, 그다음 가장 최근
 * 해, 그다음 사진이 많은 곳을 고른다.
 *
 * 연말연시를 넘나드는 것도 챙긴다 — 1월 2일에 보면 재작년 12월 31일은
 * "1년 전 이맘때"다.
 */
export function echoOf<T extends Dated>(places: T[], today: string, windowDays = 3): Echo<T> | null {
  const [ty, tm, td] = today.split("-").map(Number);
  if (!ty || !tm || !td) return null;

  let best: (Echo<T> & { gap: number }) | null = null;
  for (const place of places) {
    const [py, pm, pd] = place.startedAt.slice(0, 10).split("-").map(Number);
    if (!py || py >= ty) continue;
    const at = dayNumber(py, pm, pd);

    // 그해, 그리고 앞뒤 해로 오늘을 옮겨 보고 가장 가까운 것을 쓴다.
    for (const year of [py - 1, py, py + 1]) {
      if (year >= ty) continue;
      const gap = Math.abs(dayNumber(year, tm, td) - at);
      if (gap > windowDays) continue;
      const candidate = { place, yearsAgo: ty - year, exact: gap === 0, gap };
      if (
        !best ||
        gap < best.gap ||
        (gap === best.gap && candidate.yearsAgo < best.yearsAgo) ||
        (gap === best.gap && candidate.yearsAgo === best.yearsAgo && place.photoCount > best.place.photoCount)
      ) {
        best = candidate;
      }
    }
  }
  if (!best) return null;
  return { place: best.place, yearsAgo: best.yearsAgo, exact: best.exact };
}

/** "1년 전 오늘" · "2년 전 이맘때" */
export function echoLabel(echo: { yearsAgo: number; exact: boolean }): string {
  return `${echo.yearsAgo}년 전 ${echo.exact ? "오늘" : "이맘때"}`;
}
