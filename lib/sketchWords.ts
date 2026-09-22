import type { Sketch } from "./sketch";

/*
  숫자를 말로 바꾼다.

  "379km"는 먼 건지 가까운 건지 알 수 없다. "13번"도 많은 건지 적은 건지
  모른다. 사람은 숫자가 아니라 문장을 기억한다 — 그래서 이 화면에서 가장
  중요한 것은 지도도 숫자도 아니고, 맨 위에 적히는 한 문장이다.

  지어내지는 않는다. 모든 문장은 실제로 센 값에서만 나오고, 셀 것이
  모자라면 아무 말도 하지 않는다. 틀린 말을 하느니 비워 두는 편이 낫다.
*/

const NUMERALS = [
  "", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열",
  "열한", "열두", "열세", "열네", "열다섯", "열여섯", "열일곱", "열여덟", "열아홉", "스무",
];

/** 1~20은 우리말로. 그보다 크면 숫자 그대로가 오히려 읽기 쉽다. */
export function koreanCount(n: number): string {
  return NUMERALS[n] ?? String(n);
}

/**
 * "세 번", "열세 번", "23번".
 *
 * 우리말 수에는 띄어쓰기가 붙고 아라비아 숫자에는 붙지 않는다.
 * 부르는 쪽에서 `${koreanCount(n)} 번` 하면 "13 번"이 되어 어색하다.
 */
export function times(n: number): string {
  const word = NUMERALS[n];
  return word ? `${word} 번` : `${n}번`;
}

/*
  거리를 견주는 자.

  "379km"보다 "서울에서 부산까지 한 번"이 몸으로 와닿는다. 직선거리라서
  실제 도로 거리와는 다르지만, 스케치가 재는 것도 직선거리라 견주는 잣대와
  단위가 같다.
*/
const ROUTES = [
  { label: "서울에서 부산", km: 325 },
  { label: "서울에서 강릉", km: 165 },
] as const;

export function distanceInWords(km: number): string | null {
  for (const route of ROUTES) {
    /*
      반올림만으로는 200km 에 "서울에서 부산까지 한 번"이 나온다. 60% 를
      부풀리는 말이다. 그 자에 실제로 닿았을 때만(9할) 쓰고, 모자라면
      더 짧은 자로 넘어간다.
    */
    if (km < route.km * 0.9) continue;
    return `${route.label}까지를 ${times(Math.round(km / route.km))} 오갈 거리`;
  }
  return null;
}

/** 얼마나 자주 다녔는지. 몇 번 안 다녔으면 말하지 않는다. */
export function paceInWords(tripCount: number, spanDays: number): string | null {
  if (tripCount < 3 || spanDays < 30) return null;

  const daysPerTrip = spanDays / tripCount;
  if (daysPerTrip <= 12) return "열흘에 한 번꼴로";
  if (daysPerTrip <= 20) return "보름에 한 번꼴로";
  if (daysPerTrip <= 45) return "한 달에 한 번꼴로";
  if (daysPerTrip <= 80) return "두 달에 한 번꼴로";
  return "계절마다 한 번쯤";
}

/** 한 번 갈 때 몇 장이나 찍는지. */
export function photoPaceInWords(photoCount: number, tripCount: number): string | null {
  if (tripCount === 0 || photoCount === 0) return null;
  const each = Math.round(photoCount / tripCount);
  if (each < 2) return null;
  return `한 번에 ${each}장씩`;
}

/*
  그해를 한 문장으로.

  앞에 오는 규칙이 이긴다. 기억을 부르는 힘이 센 순서다 —
  누구와 > 어떤 곳 > 언제 > 얼마나. 마지막에는 아무것도 못 고른
  사람을 위한 기본 문장이 있다.
*/
/**
 * 그해를 한 문장으로.
 *
 * 한 해를 고른 게 아니라 전체를 보고 있을 때는 "…한 해"라고 하면 안 된다.
 * 그때는 해가 여럿이다.
 */
export function headline(sketch: Sketch, scope: "year" | "all" = "year"): string {
  const { tripCount, topCompanion, seaTripCount, jeju, bySeason, placeCount } = sketch;

  if (tripCount === 0) return "";

  // ① 한 사람과 절반 넘게 다녔으면 그 사람이 그해다.
  if (topCompanion && topCompanion.count * 2 > tripCount && topCompanion.count >= 2) {
    return `${topCompanion.label}와 ${times(topCompanion.count)}`;
  }

  // ② 바다가 절반을 넘으면 바다의 해다.
  if (seaTripCount * 2 > tripCount && seaTripCount >= 2) {
    return scope === "year" ? `바다만 ${times(seaTripCount)} 다닌 해` : `바다만 ${times(seaTripCount)}`;
  }

  // ③ 제주는 그 자체로 한 문장이 된다.
  if (jeju) return scope === "year" ? "제주까지 다녀온 해" : "제주까지 다녀왔어요";

  // ④ 한 계절에 몰렸으면 그 계절의 해다. 해가 여럿이면 쏠림을 말할 수 없다.
  const top = [...bySeason].sort((a, b) => b.count - a.count)[0];
  if (scope === "year" && top && top.count * 10 >= tripCount * 7 && tripCount >= 3) {
    return `${top.label}에만 다닌 해`;
  }

  // ⑤ 그 밖에는 센 것을 그대로 말한다.
  if (tripCount === 1) return placeCount > 1 ? "한 번의 긴 여행" : "한 번의 여행";
  return scope === "year"
    ? `${times(tripCount)} 길을 나선 해`
    : `${times(tripCount)} 길을 나섰어요`;
}
