import { describe, it, expect } from "vitest";
import { splitRegionIntoClusters } from "./regionClusters";
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

describe("splitRegionIntoClusters", () => {
  it("maxClusterSize 이하면 라벨 없는 단일 클러스터를 반환한다", () => {
    const spots = [makeSpot("a", 37, 127), makeSpot("b", 37.1, 127.1)];
    const clusters = splitRegionIntoClusters(spots, 5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].label).toBe("");
    expect(clusters[0].spots).toHaveLength(2);
  });

  it("개수를 초과하면 여러 클러스터로 나누고 원소 수를 보존한다", () => {
    const spots = Array.from({ length: 10 }, (_, i) => makeSpot(`s${i}`, 35 + i * 0.1, 127));
    const clusters = splitRegionIntoClusters(spots, 4);
    expect(clusters.length).toBeGreaterThan(1);
    const total = clusters.reduce((sum, c) => sum + c.spots.length, 0);
    expect(total).toBe(10);
  });

  it("4개로 갈려도 방향 라벨을 붙인다", () => {
    const spots = Array.from({ length: 8 }, (_, i) => makeSpot(`s${i}`, 35, 126 + i * 0.5));
    const clusters = splitRegionIntoClusters(spots, 2);
    expect(clusters.map((c) => c.label)).toEqual(["서부", "중서부", "중동부", "동부"]);
  });

  it("위도로 갈릴 때 남쪽 클러스터가 북쪽 클러스터보다 위도가 낮다", () => {
    const spots = [
      makeSpot("south1", 35.0, 127),
      makeSpot("south2", 35.2, 127),
      makeSpot("north1", 38.0, 127),
      makeSpot("north2", 38.2, 127),
    ];
    const [first, second] = splitRegionIntoClusters(spots, 2);
    expect(first.label).toBe("남부");
    expect(second.label).toBe("북부");
    expect(Math.max(...first.spots.map((s) => s.lat))).toBeLessThan(
      Math.min(...second.spots.map((s) => s.lat)),
    );
  });
});
