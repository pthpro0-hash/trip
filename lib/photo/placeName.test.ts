// @vitest-environment node
import { describe, it, expect } from "vitest";
import { pickPlaceName, scorePlaceName, withinReach } from "./placeName";
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

/*
  아래 거리와 이름은 실제 사진 200장을 돌려 카카오가 돌려준 값 그대로다.
  사용자가 "여기는 용현리였고 방갈리였다"고 바로잡아 준 것을 못 박아 둔다.
*/
describe("가까운 것만 '여기'라고 부른다", () => {
  const 서산_용현리: NearbyPlace[] = [
    { name: "사기장골", distanceM: 330 },
    { name: "골개골", distanceM: 440 },
    { name: "함장골", distanceM: 599 },
    { name: "새터말골", distanceM: 859 },
  ];

  const 태안_방갈리: NearbyPlace[] = [{ name: "민어도", distanceM: 265 }];

  const 당진_솔뫼: NearbyPlace[] = [
    { name: "솔뫼성지 역사관", distanceM: 106 },
    { name: "후주골", distanceM: 452 },
    { name: "비석골", distanceM: 537 },
    { name: "고라실골", distanceM: 613 },
  ];

  it("골짜기 이름만 있으면 법정동으로 물러난다", () => {
    expect(pickPlaceName(서산_용현리, SPOTS, "서산시 운산면 용현리")?.title).toBe(
      "서산시 운산면 용현리",
    );
  });

  it("265m 떨어진 섬을 '여기'라고 하지 않는다", () => {
    expect(pickPlaceName(태안_방갈리, SPOTS, "태안군 원북면 방갈리")?.title).toBe(
      "태안군 원북면 방갈리",
    );
  });

  it("106m의 진짜 목적지가 452m의 짧은 이름에 밀리지 않는다", () => {
    // 짧을수록 좋다는 규칙만으로는 "후주골"이 이겼다.
    expect(pickPlaceName(당진_솔뫼, SPOTS, "당진시 우강면 송산리")?.title).toBe(
      "솔뫼성지 역사관",
    );
  });

  it("넓게 퍼진 곳은 멀어도 인정한다 — 해변·둘레길", () => {
    expect(pickPlaceName(강릉_송정, SPOTS, "강릉시 송정동")?.title).toBe("송정해변");
    expect(pickPlaceName(남산_회현동, SPOTS, "중구 회현동1가")?.title).toBe("남산둘레길");
  });

  it("1km 밖은 넓은 곳이라도 보지 않는다", () => {
    const 멀리: NearbyPlace[] = [{ name: "어딘가해변", distanceM: 1400 }];
    expect(pickPlaceName(멀리, SPOTS, "어느 읍 어느 리")?.title).toBe("어느 읍 어느 리");
  });

  it("가까운 곳이 하나도 없고 법정동도 없으면 null", () => {
    expect(pickPlaceName(서산_용현리, SPOTS)).toBeNull();
  });
});

describe("withinReach", () => {
  it("200m 안쪽은 이름과 무관하게 남는다", () => {
    expect(withinReach([{ name: "아무개골", distanceM: 150 }])).toHaveLength(1);
  });

  it("200m 밖에서는 지명형 어미만 남는다", () => {
    const kept = withinReach([
      { name: "도소골", distanceM: 411 },
      { name: "송정해변", distanceM: 978 },
    ]);
    expect(kept.map((p) => p.name)).toEqual(["송정해변"]);
  });
});
