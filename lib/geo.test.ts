// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  distanceKm,
  formatDistance,
  legDistancesKm,
  moveItem,
  orderByProximity,
  totalDistanceKm,
} from "./geo";

const SEOUL = { lat: 37.5665, lng: 126.978 };
const BUSAN = { lat: 35.1796, lng: 129.0756 };

describe("distanceKm", () => {
  it("같은 지점은 0", () => {
    expect(distanceKm(SEOUL, SEOUL)).toBe(0);
  });

  it("서울-부산 직선거리는 실제와 같은 범위(약 325km)", () => {
    const km = distanceKm(SEOUL, BUSAN);
    expect(km).toBeGreaterThan(310);
    expect(km).toBeLessThan(340);
  });

  it("방향을 바꿔도 같은 값", () => {
    expect(distanceKm(SEOUL, BUSAN)).toBeCloseTo(distanceKm(BUSAN, SEOUL), 9);
  });
});

describe("formatDistance", () => {
  it("1km 미만은 10m 단위의 미터", () => {
    expect(formatDistance(0.42)).toBe("420m");
  });

  it("아주 가까워도 0m로 보이지 않는다", () => {
    expect(formatDistance(0.004)).toBe("10m");
  });

  it("10km 미만은 소수 한 자리", () => {
    expect(formatDistance(3.42)).toBe("3.4km");
  });

  it("10km 이상은 정수", () => {
    expect(formatDistance(12.6)).toBe("13km");
  });

  it("값이 없으면 빈 문자열", () => {
    expect(formatDistance(Number.NaN)).toBe("");
  });
});

describe("legDistancesKm / totalDistanceKm", () => {
  const points = [SEOUL, BUSAN, SEOUL];

  it("구간 수는 지점 수보다 하나 적다", () => {
    expect(legDistancesKm(points)).toHaveLength(2);
  });

  it("한 곳뿐이면 구간이 없다", () => {
    expect(legDistancesKm([SEOUL])).toEqual([]);
    expect(totalDistanceKm([SEOUL])).toBe(0);
  });

  it("합계는 각 구간의 합", () => {
    const legs = legDistancesKm(points);
    expect(totalDistanceKm(points)).toBeCloseTo(legs[0] + legs[1], 9);
  });
});

describe("orderByProximity", () => {
  const a = { id: "a", lat: 37, lng: 127 };
  const b = { id: "b", lat: 38, lng: 127 };
  const c = { id: "c", lat: 39, lng: 127 };

  it("출발점이 없으면 목록의 첫 곳부터 잇는다", () => {
    expect(orderByProximity([c, a, b]).map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("출발점을 주면 거기서 가장 가까운 곳부터 잇는다", () => {
    expect(orderByProximity([c, a, b], { lat: 37, lng: 127 }).map((s) => s.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("한 곳 이하면 그대로 둔다", () => {
    expect(orderByProximity([a]).map((s) => s.id)).toEqual(["a"]);
    expect(orderByProximity([])).toEqual([]);
  });

  it("어느 곳도 잃거나 늘지 않는다", () => {
    expect(orderByProximity([c, a, b])).toHaveLength(3);
  });

  it("원본을 건드리지 않는다", () => {
    const input = [c, a, b];
    orderByProximity(input);
    expect(input.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });
});

describe("moveItem", () => {
  it("뒤로 옮긴다", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
  });

  it("앞으로 옮긴다", () => {
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });

  it("범위를 벗어나면 원본 그대로", () => {
    const input = [1, 2, 3];
    expect(moveItem(input, 0, -1)).toBe(input);
    expect(moveItem(input, 3, 0)).toBe(input);
    expect(moveItem(input, 1, 1)).toBe(input);
  });
});
