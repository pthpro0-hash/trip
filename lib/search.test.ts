// @vitest-environment node
import { describe, it, expect } from "vitest";
import spotsData from "./data/spots.json";
import { matchesQuery, scoreSpot, sortByRelevance, suggestCompletions } from "./search";
import type { Spot } from "./types";

const SPOTS = spotsData as Spot[];

function names(spots: Spot[]) {
  return spots.map((s) => s.name);
}

function search(query: string) {
  return sortByRelevance(SPOTS.filter((s) => matchesQuery(s, query)), query);
}

describe("검색 대상", () => {
  it("대표 음식으로는 검색되지 않는다", () => {
    // 경복궁의 대표 음식에 '왕갈비'가 있지만 궁궐이 '갈비' 검색에 나오면 안 된다.
    expect(names(search("갈비"))).not.toContain("경복궁");
  });

  it("특산물로는 검색되지 않는다", () => {
    const withSpecialty = SPOTS.find((s) => s.specialty.length > 0)!;
    expect(scoreSpot(withSpecialty, withSpecialty.specialty[0])).toBe(0);
  });

  it("권역 이름으로 검색된다", () => {
    const results = names(search("제주"));
    // 이름에 '제주'가 없는 제주권 여행지도 나와야 한다.
    expect(results).toContain("비자림");
    expect(results).toContain("우도");
  });

  it("테마와 계절로 검색된다", () => {
    expect(names(search("야경")).length).toBeGreaterThan(3);
    expect(names(search("가을")).length).toBeGreaterThan(10);
  });
});

describe("한 글자 검색", () => {
  it("요약·볼거리의 부분 일치를 무시한다", () => {
    // '회'는 경복궁의 볼거리 '경회루' 안에 들어 있다.
    expect(names(search("회"))).not.toContain("경복궁");
  });

  it("'산'이 산책 같은 낱말에 걸려 과도하게 매칭되지 않는다", () => {
    const results = search("산");
    expect(results.length).toBeLessThan(40);
    expect(names(results)).not.toContain("경복궁");
  });

  it("이름에 그 글자가 있으면 여전히 찾는다", () => {
    expect(names(search("산"))).toContain("팔공산");
  });
});

describe("정렬", () => {
  it("이름이 정확히 일치하는 곳이 가장 앞에 온다", () => {
    expect(names(search("우도"))[0]).toBe("우도");
  });

  it("이름에 있는 곳이 요약에만 있는 곳보다 앞에 온다", () => {
    const results = names(search("바다"));
    const named = results.findIndex((n) => n.includes("바다"));
    const 대관령 = results.indexOf("대관령"); // 요약의 '구름바다'로만 걸리는 곳
    expect(named).toBeGreaterThanOrEqual(0);
    if (대관령 >= 0) expect(named).toBeLessThan(대관령);
  });

  it("빈 검색어면 원래 순서를 유지한다", () => {
    expect(sortByRelevance(SPOTS, "  ")).toEqual(SPOTS);
  });
});

describe("suggestCompletions", () => {
  it("이름이 일치하는 곳만 최대 개수만큼 제안한다", () => {
    const suggestions = suggestCompletions(SPOTS, "해수욕장", 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    for (const spot of suggestions) {
      expect(spot.name).toContain("해수욕장");
    }
  });

  it("빈 검색어에는 아무것도 제안하지 않는다", () => {
    expect(suggestCompletions(SPOTS, "")).toEqual([]);
  });
});
