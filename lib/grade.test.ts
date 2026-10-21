import { describe, it, expect } from "vitest";
import { fits, gradeLabel, isGrade, limitLabel, limitOf, nearlyFull, roomLeft, upgradesFrom, usedRatio } from "./grade";

describe("회원 등급 · 보관 한도", () => {
  it("1등급 무제한 · 2등급 2,000장 · 3등급 1,000장 · 4등급 500장", () => {
    expect([1, 2, 3, 4].map((g) => limitOf(g as 1 | 2 | 3 | 4))).toEqual([null, 2000, 1000, 500]);
    expect(gradeLabel(1)).toBe("1등급 · 무제한");
    expect(gradeLabel(2)).toBe("2등급 · 2,000장");
    expect(limitLabel(500)).toBe("500장");
  });

  it("등급은 1~4 정수뿐이다", () => {
    expect(isGrade(1)).toBe(true);
    expect(isGrade(0)).toBe(false);
    expect(isGrade(5)).toBe(false);
    expect(isGrade("1")).toBe(false);
  });

  it("남은 자리 — 무제한이면 null, 넘었으면(등급이 내려간 경우) 0", () => {
    expect(roomLeft({ grade: 4, limit: 500, used: 312 })).toBe(188);
    expect(roomLeft({ grade: 4, limit: 500, used: 800 })).toBe(0);
    expect(roomLeft({ grade: 1, limit: null, used: 9000 })).toBeNull();
  });

  it("80% 이상이면 거의 찼다고 알린다", () => {
    expect(nearlyFull({ grade: 4, limit: 500, used: 399 })).toBe(false);
    expect(nearlyFull({ grade: 4, limit: 500, used: 400 })).toBe(true);
    expect(nearlyFull({ grade: 1, limit: null, used: 9000 })).toBe(false);
    expect(usedRatio({ grade: 4, limit: 500, used: 800 })).toBe(1);
  });

  it("남은 자리만큼은 들어가고, 넘으면 안 들어간다 — 한도를 못 읽었으면 막지 않는다", () => {
    const quota = { grade: 4 as const, limit: 500, used: 490 };
    expect(fits(quota, 10)).toBe(true);
    expect(fits(quota, 11)).toBe(false);
    expect(fits({ grade: 1, limit: null, used: 0 }, 99999)).toBe(true);
    expect(fits(null, 99999)).toBe(true);
  });

  it("등업 신청은 지금보다 높은 등급만 고른다", () => {
    expect(upgradesFrom(4)).toEqual([1, 2, 3]);
    expect(upgradesFrom(2)).toEqual([1]);
    expect(upgradesFrom(1)).toEqual([]);
  });
});
