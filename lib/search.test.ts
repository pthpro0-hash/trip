// @vitest-environment node
import { describe, it, expect } from "vitest";
import spotsData from "./data/spots.json";
import {
  matchesQuery,
  scoreSpot,
  sortByRelevance,
  suggestCompletions,
  suggestCorrection,
} from "./search";
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

  it("'절'이 '사계절' 태그에 걸리지 않는다", () => {
    // 태그를 부분 문자열로 맞추던 시절엔 사계절인 57곳이 전부 나왔다.
    const results = search("절");
    expect(results.length).toBeLessThan(10);
    expect(names(results)).toContain("간절곶");
  });
});

describe("주소 검색", () => {
  it("시·군 이름으로 그 지역 여행지를 찾는다", () => {
    // '강릉'은 이름·요약 어디에도 없고 주소에만 있다.
    expect(names(search("강릉"))).toContain("정동심곡 바다부채길");
    expect(names(search("경주"))).toContain("불국사 & 석굴암");
  });

  it("구·읍·면·동 단위까지 찾는다", () => {
    expect(names(search("종로"))).toContain("경복궁");
    expect(names(search("애월읍"))).toContain("한담해변");
    expect(names(search("진관동"))).toContain("은평한옥마을");
  });

  it("낱말 중간에 우연히 겹치는 주소는 걸리지 않는다", () => {
    // 장태산 자연휴양림의 주소에 '장안동'이 있지만 '안동' 검색에 나오면 안 된다.
    expect(names(search("안동"))).not.toContain("장태산 자연휴양림");
  });
});

describe("여러 낱말 검색", () => {
  it("띄어쓴 낱말이 모두 맞아야 한다", () => {
    const results = names(search("제주 해변"));
    expect(results.length).toBeGreaterThan(0);
    // 제주권이면서 해변인 곳만 — 서울의 해변도, 제주의 산도 아니다.
    expect(results).toContain("한담해변");
    expect(results).not.toContain("대천해수욕장");
  });

  it("지역과 테마를 조합할 수 있다", () => {
    expect(names(search("서울 야경"))).toContain("남산서울타워");
    expect(names(search("서울 야경"))).not.toContain("통영 디피랑");
  });

  it("한 낱말이라도 안 맞으면 제외한다", () => {
    expect(search("제주 스키장")).toHaveLength(0);
  });
});

describe("초성 검색", () => {
  it("이름의 초성으로 찾는다", () => {
    expect(names(search("ㄱㅂㄱ"))).toContain("경복궁");
    expect(names(search("ㅎㅇㄷ"))).toContain("해운대 & 송정해수욕장");
  });

  it("초성 한 글자로는 찾지 않는다 (거의 모든 이름에 걸린다)", () => {
    expect(search("ㄱ")).toHaveLength(0);
  });
});

describe("오타 보정", () => {
  it("한 글자 틀린 이름을 제안한다", () => {
    expect(suggestCorrection(SPOTS, "경복꿍")?.name).toBe("경복궁");
    expect(suggestCorrection(SPOTS, "남이셤")?.name).toBe("남이섬");
  });

  it("묶음 이름은 조각으로도 맞춘다", () => {
    expect(suggestCorrection(SPOTS, "해운데")?.name).toBe("해운대 & 송정해수욕장");
  });

  it("너무 동떨어진 검색어에는 제안하지 않는다", () => {
    expect(suggestCorrection(SPOTS, "존재하지않는이름zzz")).toBeNull();
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
