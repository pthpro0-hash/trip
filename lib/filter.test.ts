import { describe, it, expect } from "vitest";
import { filterSpots, suggestRelaxedFilters } from "./filter";
import type { Spot } from "./types";

const SPOTS: Spot[] = [
  {
    id: "a", name: "A", region: "경상권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["가을"], specialty: [], foods: ["f1", "f2"], themes: ["자연경관"],
  },
  {
    id: "b", name: "B", region: "경상권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["봄"], specialty: [], foods: ["f1", "f2"], themes: ["역사유적"],
  },
  {
    id: "c", name: "C", region: "제주권", lat: 0, lng: 0, summary: "", highlights: ["x"],
    seasons: ["가을"], specialty: [], foods: ["f1", "f2"], themes: ["자연경관"],
  },
];

describe("filterSpots", () => {
  it("조건이 없으면 전체를 반환한다", () => {
    expect(filterSpots(SPOTS, {})).toHaveLength(3);
  });

  it("region 조건으로 필터링한다", () => {
    const result = filterSpots(SPOTS, { regions: ["경상권"] });
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("region과 season은 AND로 결합된다", () => {
    const result = filterSpots(SPOTS, { regions: ["경상권"], seasons: ["가을"] });
    expect(result.map((s) => s.id)).toEqual(["a"]);
  });

  it("region, season, theme 세 조건 모두 AND로 결합된다", () => {
    const result = filterSpots(SPOTS, {
      regions: ["경상권"],
      seasons: ["가을"],
      themes: ["역사유적"],
    });
    expect(result).toHaveLength(0);
  });
});

describe("suggestRelaxedFilters", () => {
  it("결과가 0건일 때 완화 가능한 조건과 예상 건수를 제안한다", () => {
    const criteria = { regions: ["경상권"] as const, seasons: ["가을"] as const, themes: ["역사유적"] as const };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.find((s) => s.relaxed === "themes")?.count).toBe(1);
  });

  it("완화해도 0건이면 제안 목록에서 제외한다", () => {
    const criteria = { regions: ["제주권"] as const, themes: ["역사유적"] as const };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.every((s) => s.count > 0)).toBe(true);
  });
});
