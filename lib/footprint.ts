import { seasonOf, type Season, type SketchTrip } from "./sketch";
import type { ShareSnapshot } from "./share";

/*
  발자취 — 한 해를 날짜순으로 찍어 본다.

  한장 요약의 카드는 그해를 한눈에 보여 주지만, 언제 어디를 다녀왔는지의 "순서"는
  사라진다. 여기서는 그 순서를 되살린다. 곳을 날짜순으로 하나씩 지도에 찍고, 현재
  점은 크게, 지나온 점은 작게 남긴다. 달을 누르면 그 달만 남는다.

  선은 잇지 않는다. 여행과 여행 사이에는 실제로 걸은 길이 없어, 이으면 없는 동선이
  생긴다(sketchShapes 가 같은 까닭으로 여행 안에서만 잇는다).

  이 파일은 셈만 한다. 그리는 것은 components/sketch/FootprintPlayer 가 한다.
*/

/** 찍을 곳 하나. 방문 하나가 한 걸음이다 — 같은 곳을 두 번 갔으면 두 번 찍는다. */
export interface FootprintStep {
  placeName: string;
  lat: number;
  lng: number;
  /** 1~12. */
  month: number;
  /** 그날. 링크로 받은 것은 달까지만 알아 null 이다. */
  day: number | null;
  /** 눌러서 갈 여행. 링크로 받은 것은 갈 곳이 없다(""). */
  tripId: string;
  photoCount: number;
  /** 그 방문의 대표 사진(링크로 받은 것은 링크 보관함 파일 이름). 없으면 null. */
  photoPath: string | null;
}

/** 날짜순으로 찍을 곳. 좌표가 없어 찍을 수 없는 방문은 건너뛴다. */
export function footprintSteps(trips: SketchTrip[]): FootprintStep[] {
  const found: { step: FootprintStep; key: string }[] = [];
  for (const trip of trips) {
    trip.visits.forEach((visit, index) => {
      if (!Number.isFinite(visit.lat) || !Number.isFinite(visit.lng)) return;
      // 그곳에 간 날. 모르면 여행 시작일로 갈음한다.
      const date = visit.visitedOn || trip.startedOn;
      const month = Number(date.slice(5, 7));
      if (!(month >= 1 && month <= 12)) return;
      found.push({
        // 날짜, 그다음 여행이 시작한 날, 그다음 여행 안에서 들른 차례.
        key: `${date}|${trip.startedOn}|${String(index).padStart(4, "0")}`,
        step: {
          placeName: visit.placeName,
          lat: visit.lat,
          lng: visit.lng,
          month,
          day: Number(date.slice(8, 10)) || null,
          tripId: trip.id,
          photoCount: visit.photoCount,
          photoPath: visit.photoPath ?? null,
        },
      });
    });
  }
  return found.sort((a, b) => a.key.localeCompare(b.key)).map((entry) => entry.step);
}

/** 달마다(1월부터 열두 칸) 그 달에 든 여행의 수. 곳이 둘이어도 여행은 하나로 센다. */
export function tripsPerMonth(steps: FootprintStep[]): number[] {
  return Array.from({ length: 12 }, (_, index) => new Set(steps.filter((step) => step.month === index + 1).map((step) => step.tripId)).size);
}

/**
 * 링크로 받은 스냅샷에서 되짚는다. 있는 것은 곳 이름·달·사진 수·흐린 좌표뿐이라
 * 날과 여행 id 는 없다. 달 순서로 찍는다(같은 달 안에서는 처음 들른 차례 그대로).
 */
export function footprintStepsOfShare(snapshot: ShareSnapshot): FootprintStep[] {
  return snapshot.dots
    .filter((dot) => dot.placeName && Number.isFinite(dot.lat) && Number.isFinite(dot.lng))
    .map((dot) => ({
      placeName: dot.placeName,
      lat: dot.lat,
      lng: dot.lng,
      month: Number(dot.month.slice(5, 7)),
      day: null,
      tripId: "",
      photoCount: dot.photoCount,
      photoPath: dot.photo,
    }))
    .filter((step) => step.month >= 1 && step.month <= 12)
    .sort((a, b) => a.month - b.month);
}

/** 링크로 받은 스냅샷의 달별 여행 수. */
export function monthCountsOfShare(snapshot: ShareSnapshot): number[] {
  return Array.from({ length: 12 }, (_, index) => snapshot.months.find((cell) => cell.month === index + 1)?.tripCount ?? 0);
}

/** 그 달의 계절. 점의 색이 된다(카드의 범례와 같다). */
export function seasonOfMonth(month: number): Season {
  return seasonOf(`2000-${String(month).padStart(2, "0")}-01`);
}

/**
 * 곳 하나를 찍는 데 걸리는 시간. 곳이 적으면 천천히(1.2초), 많으면 통틀어 30초를
 * 넘지 않게 줄인다. 서른 곳이 넘는 해도 끝까지 보는 데 한참 걸리지 않게 하려는 것이다.
 */
export function stepDelayMs(count: number, totalMs = 30000, eachMs = 1200): number {
  return Math.max(1, Math.min(eachMs, Math.floor(totalMs / Math.max(1, count))));
}

/*
  재생 상태.

    cur      지금 찍은 곳의 차례. 아직 시작하지 않았으면 -1.
    playing  타이머가 돌고 있는가.
    done     끝까지 찍었는가.
    sel      달을 골랐으면 그 달(1~12). 고르면 재생은 멈추고 그 달만 남는다.
*/
export interface PlayState {
  cur: number;
  playing: boolean;
  done: boolean;
  sel: number | null;
}

export const initialPlay: PlayState = { cur: -1, playing: false, done: false, sel: null };

export type PlayAction =
  | { type: "play"; count: number }
  | { type: "tick"; count: number }
  | { type: "pause" }
  | { type: "skip"; count: number }
  | { type: "month"; month: number };

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "play": {
      if (action.count <= 0) return state;
      // 멈춘 자리에서만 이어 간다. 끝났거나 달을 골랐거나 아직 시작 전이면 처음부터.
      if (state.sel === null && !state.done && state.cur >= 0) return { ...state, playing: true };
      const done = action.count === 1;
      return { cur: 0, playing: !done, done, sel: null };
    }
    case "tick": {
      if (!state.playing) return state;
      const next = state.cur + 1;
      if (next >= action.count) return { cur: action.count - 1, playing: false, done: true, sel: null };
      return { ...state, cur: next };
    }
    case "pause":
      return { ...state, playing: false };
    case "skip":
      if (action.count <= 0) return state;
      return { cur: action.count - 1, playing: false, done: true, sel: null };
    case "month":
      return { ...state, playing: false, sel: state.sel === action.month ? null : action.month };
  }
}

export const CURRENT_R = 9;
export const RING_R = 13;
/** 지나온 점. 작고 옅게 남는다. */
export const TRAIL_R = 4;
export const TRAIL_OPACITY = 0.55;
/** 끝까지 찍은 뒤 모든 점. */
export const DONE_R = 5;
/** 달을 골랐을 때 그 달의 점. */
export const PICK_R = 6;

export interface DotLook {
  r: number;
  /** 현재 점을 두르는 테. 없으면 0. */
  ring: number;
  opacity: number;
}

const HIDDEN: DotLook = { r: 0, ring: 0, opacity: 1 };

/** 이 순간 점 하나의 모양. */
export function dotLook(index: number, step: FootprintStep, state: PlayState): DotLook {
  if (state.sel !== null) return step.month === state.sel ? { r: PICK_R, ring: 0, opacity: 1 } : HIDDEN;
  if (state.done) return { r: DONE_R, ring: 0, opacity: 1 };
  if (state.cur < 0 || index > state.cur) return HIDDEN;
  if (index === state.cur) return { r: CURRENT_R, ring: RING_R, opacity: 1 };
  return { r: TRAIL_R, ring: 0, opacity: TRAIL_OPACITY };
}

/** "8월 13일 · 안목해변". 링크로 받은 것은 날을 몰라 "8월 · 안목해변". */
export function stepTitle(step: FootprintStep): string {
  return `${step.month}월${step.day ? ` ${step.day}일` : ""} · ${step.placeName}`;
}

/** 한 달의 곳들을 나열할 때 앞에서 몇 곳까지 적을까. 나머지는 수로. */
const LISTED = 6;

/** 지도 아래 띠에 적을 두 줄. */
export function labelOf(
  steps: FootprintStep[],
  state: PlayState,
  monthCounts: number[],
  totals: { trips: number; places: number; photos: number },
): { title: string; sub: string } {
  if (state.sel !== null) {
    const month = state.sel;
    const listed = steps.filter((step) => step.month === month);
    const names = listed.slice(0, LISTED).map((step) => `${step.day ? `${step.day}일 ` : ""}${step.placeName}`);
    const rest = listed.length - LISTED;
    return {
      title: `${month}월 · 여행 ${monthCounts[month - 1] ?? 0}번`,
      sub: `${names.join(" · ")}${rest > 0 ? ` 외 ${rest}곳` : ""}`,
    };
  }
  if (state.done) {
    return { title: `다녀온 곳 ${totals.places}곳`, sub: `여행 ${totals.trips}번 · 사진 ${totals.photos.toLocaleString("ko-KR")}장` };
  }
  const step = steps[state.cur];
  if (step) return { title: stepTitle(step), sub: `사진 ${step.photoCount}장` };
  return { title: "재생을 눌러 보세요", sub: "다녀온 곳이 날짜순으로 찍혀요" };
}
