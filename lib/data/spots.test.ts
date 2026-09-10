import { describe, it, expect } from "vitest";
import spots from "./spots.json";
import type { Spot } from "../types";

describe("spots.json", () => {
  const typed = spots as Spot[];

  it("정확히 100건이다 (원본 소스 파일이 실제로 담고 있는 건수)", () => {
    expect(typed).toHaveLength(100);
  });

  it("모든 항목이 필수 필드를 가진다", () => {
    for (const spot of typed) {
      expect(spot.id).toBeTruthy();
      expect(spot.name).toBeTruthy();
      expect(typeof spot.lat).toBe("number");
      expect(typeof spot.lng).toBe("number");
      expect(spot.highlights.length).toBeGreaterThan(0);
      expect(spot.foods.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("id가 중복되지 않는다", () => {
    const ids = typed.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
