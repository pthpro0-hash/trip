import { describe, it, expect } from "vitest";
import {
  dwellMs,
  indexAt,
  monthOf,
  monthSpan,
  monthTotals,
  rangeLabel,
  replayOrder,
  trailSegments,
  withinMonths,
  yearRange,
} from "./timeline";

const at = (visitId: string, startedAt: string, photoCount = 1) => ({ visitId, startedAt, photoCount });

const 여름 = at("v1", "2025-07-25 13:00:00", 6);
const 가을 = at("v2", "2025-10-03 09:00:00", 4);
const 봄 = at("v3", "2026-03-14 06:11:00", 18);
const 봄둘째 = at("v4", "2026-03-20 10:00:00", 2);

describe("monthSpan", () => {
  it("첫 달부터 마지막 달까지 빠짐없이 — 안 나간 달도 자리를 둔다", () => {
    const span = monthSpan([봄, 여름]);
    expect(span[0]).toBe("2025-07");
    expect(span.at(-1)).toBe("2026-03");
    expect(span).toHaveLength(9);
    // 해가 바뀌는 자리에서 13월이 생기지 않는다.
    expect(span).toContain("2025-12");
    expect(span).toContain("2026-01");
  });

  it("아무것도 없으면 빈 줄", () => {
    expect(monthSpan([])).toEqual([]);
  });
});

describe("monthTotals", () => {
  it("달마다 사진 수를 더한다", () => {
    const totals = monthTotals([봄, 봄둘째, 여름]);
    expect(totals.get("2026-03")).toBe(20);
    expect(totals.get("2025-07")).toBe(6);
  });
});

describe("withinMonths", () => {
  const all = [여름, 가을, 봄, 봄둘째];

  it("두 끝을 포함한다", () => {
    expect(withinMonths(all, ["2025-10", "2026-03"]).map((p) => p.visitId)).toEqual(["v2", "v3", "v4"]);
  });

  it("기간이 없으면 전부", () => {
    expect(withinMonths(all, null)).toHaveLength(4);
  });
});

describe("yearRange", () => {
  const months = monthSpan([여름, 봄]);

  it("그해의 첫 막대부터 마지막 막대까지", () => {
    expect(yearRange(months, "2025")).toEqual(["2025-07", "2025-12"]);
    expect(yearRange(months, "2026")).toEqual(["2026-01", "2026-03"]);
  });

  it("그해 막대가 없으면 null", () => {
    expect(yearRange(months, "2024")).toBeNull();
  });
});

describe("indexAt", () => {
  it("가로 위치로 몇 번째 막대인지", () => {
    expect(indexAt(0, 100, 10)).toBe(0);
    expect(indexAt(55, 100, 10)).toBe(5);
    expect(indexAt(99.9, 100, 10)).toBe(9);
  });

  it("줄 밖으로 끌어도 양 끝에 붙는다", () => {
    expect(indexAt(-30, 100, 10)).toBe(0);
    expect(indexAt(400, 100, 10)).toBe(9);
  });
});

describe("rangeLabel", () => {
  it("구간과 한 달을 다르게 적는다", () => {
    expect(rangeLabel(["2026-03", "2026-06"])).toBe("2026.03 ~ 2026.06");
    expect(rangeLabel(["2026-03", "2026-03"])).toBe("2026.03");
  });
});

describe("replayOrder", () => {
  it("찍은 때 순서대로", () => {
    expect(replayOrder([봄, 여름, 봄둘째, 가을]).map((p) => p.visitId)).toEqual(["v1", "v2", "v3", "v4"]);
  });

  it("같은 때면 늘 같은 순서 — 두 번 걸어도 같은 길", () => {
    const a = at("a", "2026-01-01 10:00:00");
    const b = at("b", "2026-01-01 10:00:00");
    expect(replayOrder([b, a])).toEqual(replayOrder([a, b]));
  });

  it("건네받은 목록을 건드리지 않는다", () => {
    const list = [봄, 여름];
    replayOrder(list);
    expect(list[0]).toBe(봄);
  });
});

describe("dwellMs", () => {
  it("곳이 많을수록 걸음을 재촉한다", () => {
    expect(dwellMs(5)).toBeGreaterThan(dwellMs(20));
    expect(dwellMs(20)).toBeGreaterThan(dwellMs(50));
  });
});

describe("monthOf", () => {
  it("벽시계 시각에서 달만", () => {
    expect(monthOf("2026-09-14 06:11:00")).toBe("2026-09");
  });
});

describe("trailSegments", () => {
  const stop = (tripId: string, lat: number) => ({ tripId, lat, lng: 127 });
  const stops = [stop("t1", 37.5), stop("t1", 37.4), stop("t2", 36.3), stop("t2", 36.2)];

  it("여행이 바뀌는 자리에서 끊는다 — 가지 않은 길을 긋지 않게", () => {
    expect(trailSegments(stops, 4)).toEqual([
      [{ lat: 37.5, lng: 127 }, { lat: 37.4, lng: 127 }],
      [{ lat: 36.3, lng: 127 }, { lat: 36.2, lng: 127 }],
    ]);
  });

  it("앞의 몇 곳까지만", () => {
    expect(trailSegments(stops, 3)).toEqual([
      [{ lat: 37.5, lng: 127 }, { lat: 37.4, lng: 127 }],
      [{ lat: 36.3, lng: 127 }],
    ]);
    expect(trailSegments(stops, 0)).toEqual([]);
  });
});
