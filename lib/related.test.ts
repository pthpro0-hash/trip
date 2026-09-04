import { describe, it, expect } from "vitest";
import { getRelatedSpots } from "./related";
import type { Spot } from "./types";

const base: Omit<Spot, "id" | "name" | "region"> = {
  lat: 0, lng: 0, summary: "", highlights: ["x"], seasons: ["봄"], specialty: [],
  foods: ["f1", "f2"], themes: [],
};

const SPOTS: Spot[] = [
  { ...base, id: "a", name: "A", region: "경상권" },
  { ...base, id: "b", name: "B", region: "경상권" },
  { ...base, id: "c", name: "C", region: "경상권" },
  { ...base, id: "d", name: "D", region: "경상권" },
  { ...base, id: "e", name: "E", region: "제주권" },
];

describe("getRelatedSpots", () => {
  it("같은 권역에서 자기 자신을 제외하고 최대 count개를 반환한다", () => {
    const related = getRelatedSpots(SPOTS, SPOTS[0], 3);
    expect(related).toHaveLength(3);
    expect(related.every((s) => s.region === "경상권")).toBe(true);
    expect(related.find((s) => s.id === "a")).toBeUndefined();
  });

  it("같은 권역 후보가 count보다 적으면 있는 만큼만 반환한다", () => {
    const related = getRelatedSpots(SPOTS, SPOTS[4], 3);
    expect(related).toHaveLength(0);
  });
});
