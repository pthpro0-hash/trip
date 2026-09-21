// @vitest-environment node
import { describe, it, expect } from "vitest";
import { pickPlaceName, scorePlaceName } from "./placeName";
import type { NearbyPlace } from "./types";

// 아래 목록과 거리는 실제 카카오 응답에서 그대로 가져온 것이다.
const 남산_회현동: NearbyPlace[] = [
  { name: "서울특별시교육청융합과학교육원 남산분관 천체투영실", distanceM: 113 },
  { name: "서울특별시교육청융합과학교육원 남산분원", distanceM: 114 },
  { name: "안중근의사기념관", distanceM: 159 },
  { name: "한양도성유적전시관", distanceM: 210 },
  { name: "피크닉", distanceM: 248 },
  { name: "남산둘레길", distanceM: 268 },
];

const 강릉_송정: NearbyPlace[] = [
  { name: "관동팔경녹색경관길 강문송정해변솔숲길", distanceM: 556 },
  { name: "바람개비다육식물원", distanceM: 678 },
  { name: "송정해변", distanceM: 978 },
  { name: "그대 나의 뮤즈 반고흐 to 마티스", distanceM: 992 },
];

const 강릉_안목: NearbyPlace[] = [
  { name: "강릉카페거리", distanceM: 24 },
  { name: "안목해변", distanceM: 99 },
  { name: "환희컵박물관", distanceM: 401 },
];

const 보령_대천: NearbyPlace[] = [
  { name: "대천해수욕장", distanceM: 112 },
  { name: "호텔마스타대천 워터파크", distanceM: 463 },
  { name: "보령머드테마파크", distanceM: 599 },
];

const SPOTS = ["대천해수욕장", "남산서울타워", "해운대 & 송정해수욕장", "청풍호"];

describe("pickPlaceName", () => {
  it("100선이 주변 목록에 있으면 그것이 최우선", () => {
    expect(pickPlaceName(보령_대천, SPOTS)).toEqual({
      title: "대천해수욕장",
      isCuratedSpot: true,
    });
  });

  it("남산 자락에서는 기관 정식명칭이 아니라 남산둘레길을 고른다", () => {
    // 가장 가까운 것은 113m의 천체투영실이지만, 기억에 남는 이름이 아니다.
    expect(pickPlaceName(남산_회현동, SPOTS)?.title).toBe("남산둘레길");
  });

  it("긴 코스명보다 짧은 지명을 고른다 — 556m를 제치고 978m가 이긴다", () => {
    expect(pickPlaceName(강릉_송정, SPOTS)?.title).toBe("송정해변");
  });

  it("24m의 '카페거리'보다 99m의 '해변'을 고른다", () => {
    expect(pickPlaceName(강릉_안목, SPOTS)?.title).toBe("안목해변");
  });

  it("100선 이름은 부분만 겹쳐도 알아본다", () => {
    const nearby: NearbyPlace[] = [{ name: "송정해수욕장", distanceM: 50 }];
    expect(pickPlaceName(nearby, SPOTS)).toEqual({
      title: "해운대 & 송정해수욕장",
      isCuratedSpot: true,
    });
  });

  it("주변에 아무것도 없으면 행정동이라도 돌려준다", () => {
    expect(pickPlaceName([], SPOTS, "서울특별시 중구 회현동")).toEqual({
      title: "서울특별시 중구 회현동",
      isCuratedSpot: false,
    });
  });

  it("행정동조차 없으면 null", () => {
    expect(pickPlaceName([], SPOTS)).toBeNull();
  });
});

describe("scorePlaceName", () => {
  it("가까울수록 점수가 낮다", () => {
    expect(scorePlaceName({ name: "송정해변", distanceM: 100 })).toBeLessThan(
      scorePlaceName({ name: "송정해변", distanceM: 900 }),
    );
  });

  it("이름이 짧을수록 점수가 낮다", () => {
    expect(scorePlaceName({ name: "피크닉", distanceM: 200 })).toBeLessThan(
      scorePlaceName({ name: "서울특별시교육청융합과학교육원 남산분원", distanceM: 200 }),
    );
  });

  it("장소를 부르는 말로 끝나면 가산점", () => {
    expect(scorePlaceName({ name: "송정해변", distanceM: 200 })).toBeLessThan(
      scorePlaceName({ name: "송정빌딩", distanceM: 200 }),
    );
  });

  it("코스 번호로 끝나는 이름에는 가산점이 붙지 않는다", () => {
    const course = scorePlaceName({ name: "해파랑길 49코스", distanceM: 200 });
    const beach = scorePlaceName({ name: "화진포해변", distanceM: 200 });
    expect(beach).toBeLessThan(course);
  });
});
