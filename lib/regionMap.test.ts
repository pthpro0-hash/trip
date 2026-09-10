import { describe, it, expect } from "vitest";
import { computeRegionPins } from "./regionMap";
import type { Spot } from "./types";

function makeSpot(id: string, lat: number, lng: number): Spot {
  return {
    id,
    name: id,
    region: "수도권",
    lat,
    lng,
    summary: "",
    highlights: [],
    seasons: ["사계절"],
    specialty: [],
    foods: [],
    themes: [],
  };
}

describe("computeRegionPins", () => {
  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(computeRegionPins([])).toEqual([]);
  });

  it("점이 하나뿐이면 중앙(50, 50)에 놓는다", () => {
    const [pin] = computeRegionPins([makeSpot("a", 37.5, 127)]);
    expect(pin.x).toBe(50);
    expect(pin.y).toBe(50);
  });

  it("가장 북쪽/서쪽 점은 좌상단 쪽, 남쪽/동쪽 점은 우하단 쪽에 놓인다", () => {
    const north = makeSpot("north", 38, 127); // 북쪽·서쪽
    const south = makeSpot("south", 37, 128); // 남쪽·동쪽
    const [a, b] = computeRegionPins([north, south], 0);

    expect(a.y).toBeLessThan(b.y); // north는 위(y가 작음)
    expect(a.x).toBeLessThan(b.x); // north는 왼쪽(x가 작음)
  });

  it("padding 범위 안에서만 좌표를 배치한다", () => {
    const pins = computeRegionPins(
      [makeSpot("a", 38, 127), makeSpot("b", 37, 128)],
      15,
    );
    for (const pin of pins) {
      expect(pin.x).toBeGreaterThanOrEqual(15);
      expect(pin.x).toBeLessThanOrEqual(85);
      expect(pin.y).toBeGreaterThanOrEqual(15);
      expect(pin.y).toBeLessThanOrEqual(85);
    }
  });
});
