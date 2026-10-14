import { seasonOf, type Season, type SketchTrip } from "./sketch";
import type { ShareSnapshot } from "./share";
import { isInKorea } from "./weatherGrid";

/*
  발자취 — 다녀온 곳을 지도에 찍어 본다(부모님이 보는 엽서·올해의 책의 지도).

  곳마다 점 하나를 찍고, 달을 누르면 그 달에 간 곳만 남는다. 예전에는 곳을 하나씩
  찍어 나가는 '재생'이 있었는데, 쓰는 사람에게 복잡하기만 해서 뺐다(2026-10-14).

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
      // 지도는 한국만 그린다(해외 곳은 찍지 않는다).
      if (!isInKorea(visit.lat, visit.lng)) return;
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
    .filter((dot) => dot.placeName && isInKorea(dot.lat, dot.lng))
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

/** 달을 골랐으면 그 달(1~12). null 이면 전부 보인다. */
export type MonthPick = number | null;

/** 달을 누른다. 같은 달을 다시 누르면 전부로 돌아간다. */
export function toggleMonth(sel: MonthPick, month: number): MonthPick {
  return sel === month ? null : month;
}

/** 모든 점. */
export const DONE_R = 5;
/** 달을 골랐을 때 그 달의 점. */
export const PICK_R = 6;

/** 점 하나의 크기. 0 이면 그리지 않는다. */
export function dotRadius(step: FootprintStep, sel: MonthPick): number {
  if (sel !== null) return step.month === sel ? PICK_R : 0;
  return DONE_R;
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
  sel: MonthPick,
  monthCounts: number[],
  totals: { trips: number; places: number; photos: number },
): { title: string; sub: string } {
  if (sel !== null) {
    const month = sel;
    const listed = steps.filter((step) => step.month === month);
    const names = listed.slice(0, LISTED).map((step) => `${step.day ? `${step.day}일 ` : ""}${step.placeName}`);
    const rest = listed.length - LISTED;
    return {
      title: `${month}월 · 여행 ${monthCounts[month - 1] ?? 0}번`,
      sub: `${names.join(" · ")}${rest > 0 ? ` 외 ${rest}곳` : ""}`,
    };
  }
  return { title: `다녀온 곳 ${totals.places}곳`, sub: `여행 ${totals.trips}번 · 사진 ${totals.photos.toLocaleString("ko-KR")}장` };
}
