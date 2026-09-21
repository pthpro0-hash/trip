// @vitest-environment node
import { describe, it, expect } from "vitest";
import { availableSeasons, availableThemes, regionStats } from "./regionStats";
import { adjacentRegions, REGIONS } from "./regions";
import { ALL_SEASONS, ALL_THEMES } from "./filter";
import type { Spot } from "./types";

function spot(partial: Partial<Spot> & { id: string }): Spot {
  return {
    name: partial.id,
    region: "수도권",
    lat: 37.5,
    lng: 127,
    summary: "요약",
    highlights: [],
    seasons: [],
    specialty: [],
    foods: [],
    themes: [],
    ...partial,
  };
}

describe("regionStats", () => {
  const spots = [
    spot({ id: "a", themes: ["역사유적", "정원"], seasons: ["봄", "사계절"], foods: ["설렁탕"] }),
    spot({ id: "b", themes: ["역사유적"], seasons: ["가을"], foods: ["설렁탕", "냉면"] }),
    spot({ id: "c", themes: ["자연경관"], seasons: ["사계절"], foods: ["냉면"] }),
  ];

  it("여행지 수를 센다", () => {
    expect(regionStats(spots).count).toBe(3);
  });

  it("테마를 많은 순으로 센다", () => {
    expect(regionStats(spots).themes).toEqual([
      { value: "역사유적", count: 2 },
      { value: "정원", count: 1 },
      { value: "자연경관", count: 1 },
    ]);
  });

  it("사계절은 계절 집계에서 뺀다 — 어느 권역에나 많아 성격을 못 알려준다", () => {
    const stats = regionStats(spots);
    expect(stats.seasons.map((s) => s.value)).not.toContain("사계절");
    expect(stats.seasons).toEqual([
      { value: "봄", count: 1 },
      { value: "가을", count: 1 },
    ]);
  });

  it("사계절 추천은 따로 센다", () => {
    expect(regionStats(spots).allYearCount).toBe(2);
  });

  it("대표 음식도 많은 순으로 센다", () => {
    expect(regionStats(spots).foods).toEqual([
      { value: "설렁탕", count: 2 },
      { value: "냉면", count: 2 },
    ]);
  });

  it("빈 권역도 무너지지 않는다", () => {
    expect(regionStats([])).toEqual({
      count: 0,
      themes: [],
      seasons: [],
      foods: [],
      allYearCount: 0,
    });
  });
});

describe("availableThemes / availableSeasons", () => {
  const spots = [
    spot({ id: "a", themes: ["해변"], seasons: ["여름"] }),
    spot({ id: "b", themes: ["섬"], seasons: ["여름", "사계절"] }),
  ];

  it("그 권역에 실제로 있는 것만 낸다 — 눌러도 0건인 칩은 두지 않는다", () => {
    expect(availableThemes(spots, ALL_THEMES)).toEqual(["해변", "섬"]);
    expect(availableSeasons(spots, ALL_SEASONS)).toEqual(["여름", "사계절"]);
  });

  it("화면에 늘 같은 차례로 나오도록 기준 목록의 순서를 따른다", () => {
    const reversed = [spot({ id: "b", themes: ["섬"] }), spot({ id: "a", themes: ["해변"] })];
    expect(availableThemes(reversed, ALL_THEMES)).toEqual(["해변", "섬"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableThemes([], ALL_THEMES)).toEqual([]);
  });
});

describe("adjacentRegions", () => {
  it("앞뒤 권역을 준다", () => {
    expect(adjacentRegions("강원권")).toEqual({ prev: "수도권", next: "충청권" });
  });

  it("끝에서는 처음으로 돌아온다 — 막다른 길을 만들지 않는다", () => {
    expect(adjacentRegions("수도권").prev).toBe("제주권");
    expect(adjacentRegions("제주권").next).toBe("수도권");
  });

  it("어느 권역에서 출발해도 여섯 곳을 모두 돈다", () => {
    const seen = new Set<string>();
    let current = REGIONS[0];
    for (let step = 0; step < REGIONS.length; step += 1) {
      seen.add(current);
      current = adjacentRegions(current).next;
    }
    expect(seen.size).toBe(REGIONS.length);
    expect(current).toBe(REGIONS[0]);
  });
});
