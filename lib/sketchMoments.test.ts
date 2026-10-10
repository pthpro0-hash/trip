// @vitest-environment node
import { describe, it, expect } from "vitest";
import { dayInWords, yearMoments } from "./sketchMoments";
import type { SketchTrip, SketchVisit } from "./sketch";

const visit = (placeName: string, photoCount: number, lat: number, lng: number, visitedOn?: string): SketchVisit => ({
  placeName, spotId: null, lat, lng, photoCount, visitedOn,
});
const trip = (id: string, startedOn: string, ...visits: SketchVisit[]): SketchTrip => ({ id, startedOn, endedOn: startedOn, companions: null, visits });

describe("dayInWords", () => {
  it("월·일을 사람 말로 — 앞의 0 을 뗀다", () => {
    expect(dayInWords("2026-09-04")).toBe("9월 4일");
    expect(dayInWords("2026-12-31")).toBe("12월 31일");
  });
});

describe("yearMoments · 올해의 순간", () => {
  it("기록이 없으면 순간도 없다", () => {
    expect(yearMoments([])).toEqual([]);
  });

  it("첫 길 — 가장 이른 날의 곳. 여행 순서가 뒤섞여 있어도", () => {
    const moments = yearMoments([trip("b", "2026-09-13", visit("안목", 3, 37.77, 128.94)), trip("a", "2026-06-12", visit("정동진", 2, 37.69, 129.03))]);
    expect(moments[0]).toMatchObject({ key: "first", value: "6월 12일", note: "정동진에서" });
  });

  it("하루 최다 — 날짜별 사진 수의 합, 그날 가장 많이 찍은 곳. 방문 날짜가 있으면 그것으로 센다", () => {
    const moments = yearMoments([
      trip("t", "2026-09-13", visit("고성", 10, 38.4, 128.4, "2026-09-13"), visit("안목", 30, 37.77, 128.94, "2026-09-14"), visit("송정", 20, 37.78, 128.93, "2026-09-14")),
    ]);
    expect(moments.find((m) => m.key === "busiest")).toMatchObject({ value: "50장", note: "9월 14일 · 안목" });
  });

  it("사진이 한 장뿐이면 하루 최다는 말하지 않는다", () => {
    expect(yearMoments([trip("t", "2026-09-13", visit("고성", 1, 38.4, 128.4))]).map((m) => m.key)).toEqual(["first"]);
  });

  it("가장 멀리 — 자주 다닌 곳(사진이 몰린 곳)에서 가장 먼 곳", () => {
    const moments = yearMoments([
      trip("a", "2026-05-01", visit("서울숲", 60, 37.54, 127.04)),
      trip("b", "2026-06-01", visit("서촌", 40, 37.58, 126.97)),
      trip("c", "2026-08-02", visit("성산", 10, 33.46, 126.94)),
    ]);
    const far = moments.find((m) => m.key === "farthest")!;
    expect(far.value).toMatch(/^약 /);
    expect(far.note).toBe("성산 · 자주 다닌 곳에서");
  });

  it("다 가까우면(20km 안) 가장 멀리는 말하지 않는다", () => {
    const moments = yearMoments([trip("a", "2026-05-01", visit("A", 5, 37.5, 127.0), visit("B", 5, 37.55, 127.05))]);
    expect(moments.map((m) => m.key)).not.toContain("farthest");
  });

  it("방문이 하나뿐이면 가장 멀리는 말하지 않는다", () => {
    expect(yearMoments([trip("a", "2026-05-01", visit("A", 5, 37.5, 127.0))]).map((m) => m.key)).not.toContain("farthest");
  });
});
