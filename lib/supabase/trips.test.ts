// @vitest-environment node
import { describe, it, expect } from "vitest";
import { overlapsSaved, tripRange, type DateRange } from "./trips";
import type { Shot, Trip } from "@/lib/photo/types";

function trip(dates: string[]): Trip {
  const shots: Shot[] = dates.map((iso, index) => ({
    id: `p${index}`,
    takenAt: new Date(iso),
    lat: 37.5,
    lng: 127,
  }));
  return { shots, visits: [{ shots }] };
}

describe("tripRange", () => {
  it("하루짜리 여행은 시작과 끝이 같다", () => {
    expect(tripRange(trip(["2026-09-08T19:12"]))).toEqual({
      start: "2026-09-08",
      end: "2026-09-08",
    });
  });

  it("1박 2일은 이틀에 걸친다", () => {
    expect(tripRange(trip(["2026-09-13T09:21", "2026-09-14T08:41"]))).toEqual({
      start: "2026-09-13",
      end: "2026-09-14",
    });
  });

  it("오전 사진이 전날로 밀리지 않는다", () => {
    // toISOString 으로 자르면 KST 오전 8시가 전날이 된다.
    expect(tripRange(trip(["2026-07-25T08:16"])).start).toBe("2026-07-25");
  });
});

describe("overlapsSaved", () => {
  const saved: DateRange[] = [{ start: "2026-09-13", end: "2026-09-14" }];

  it("기간이 똑같으면 겹친다", () => {
    expect(overlapsSaved({ start: "2026-09-13", end: "2026-09-14" }, saved)).toBe(true);
  });

  it("첫날만 다시 넣어도 겹친다 — 이걸 놓치면 같은 여행이 두 건이 된다", () => {
    expect(overlapsSaved({ start: "2026-09-13", end: "2026-09-13" }, saved)).toBe(true);
  });

  it("둘째 날만 넣어도 겹친다", () => {
    expect(overlapsSaved({ start: "2026-09-14", end: "2026-09-14" }, saved)).toBe(true);
  });

  it("저장된 기간을 감싸도 겹친다", () => {
    expect(overlapsSaved({ start: "2026-09-12", end: "2026-09-15" }, saved)).toBe(true);
  });

  it("하루 차이로 비켜 있으면 겹치지 않는다", () => {
    expect(overlapsSaved({ start: "2026-09-12", end: "2026-09-12" }, saved)).toBe(false);
    expect(overlapsSaved({ start: "2026-09-15", end: "2026-09-15" }, saved)).toBe(false);
  });

  it("저장된 것이 없으면 겹칠 일도 없다", () => {
    expect(overlapsSaved({ start: "2026-09-13", end: "2026-09-14" }, [])).toBe(false);
  });

  it("여러 건 중 하나라도 겹치면 겹친 것이다", () => {
    const many: DateRange[] = [
      { start: "2026-07-25", end: "2026-07-25" },
      { start: "2026-09-13", end: "2026-09-14" },
    ];
    expect(overlapsSaved({ start: "2026-07-25", end: "2026-07-25" }, many)).toBe(true);
    expect(overlapsSaved({ start: "2026-08-29", end: "2026-08-29" }, many)).toBe(false);
  });
});
