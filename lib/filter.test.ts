import { describe, it, expect } from "vitest";
import { filterSpots, suggestRelaxedFilters } from "./filter";
import type { Spot, Region, Season, Theme } from "./types";

const SPOTS: Spot[] = [
  {
    id: "a", name: "경복궁", region: "경상권", lat: 0, lng: 0, summary: "조선의 정궁", highlights: ["근정전"],
    seasons: ["가을"], specialty: [], foods: ["설렁탕", "f2"], themes: ["자연경관"],
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

  it("이름으로 검색한다", () => {
    const result = filterSpots(SPOTS, { query: "궁" });
    expect(result.map((s) => s.id)).toEqual(["a"]);
  });

  it("음식으로는 검색하지 않는다 (궁궐이 갈비로 검색되던 문제)", () => {
    expect(filterSpots(SPOTS, { query: "설렁탕" })).toHaveLength(0);
  });

  it("검색어와 region 조건은 AND로 결합된다", () => {
    // '가을'은 a와 c 모두에 해당하지만 제주권은 c뿐이다.
    const result = filterSpots(SPOTS, { query: "가을", regions: ["제주권"] });
    expect(result.map((s) => s.id)).toEqual(["c"]);
  });
});

describe("suggestRelaxedFilters", () => {
  it("결과가 0건일 때 완화 가능한 조건과 예상 건수를 제안한다", () => {
    const criteria = { regions: ["경상권"] as Region[], seasons: ["가을"] as Season[], themes: ["역사유적"] as Theme[] };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.find((s) => s.relaxed === "themes")?.count).toBe(1);
  });

  it("완화해도 0건이면 제안 목록에서 제외한다", () => {
    const criteria = { regions: ["제주권"] as Region[], themes: ["역사유적"] as Theme[] };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.every((s) => s.count > 0)).toBe(true);
  });

  it("검색어 때문에 0건이면 검색어 완화를 제안한다", () => {
    const criteria = { regions: ["경상권"] as Region[], query: "존재하지않는검색어" };
    const suggestions = suggestRelaxedFilters(SPOTS, criteria);
    expect(suggestions.find((s) => s.relaxed === "query")?.count).toBe(2);
  });
});
