// @vitest-environment node
import { describe, it, expect } from "vitest";
import { regionOfDong, regionsOfTrip } from "./region";

/*
  아래 행정동 문자열은 실제 기록에 들어 있는 것들이다.
  좌표로 가르지 않고 이 문자열의 맨 앞 칸만 본다.
*/
describe("regionOfDong", () => {
  it.each([
    ["서울특별시 중구 회현동1가", "수도권"],
    ["경기도 가평군 설악면", "수도권"],
    ["인천광역시 중구 운서동", "수도권"],
    ["강원특별자치도 강릉시 송정동", "강원권"],
    ["충청남도 태안군 원북면 방갈리", "충청권"],
    ["세종특별자치시 조치원읍", "충청권"],
    ["전라남도 여수시 돌산읍", "전라권"],
    ["경상북도 경주시 불국동", "경상권"],
    ["부산광역시 해운대구 우동", "경상권"],
    ["제주특별자치도 서귀포시 성산읍", "제주권"],
  ])("%s → %s", (dong, expected) => {
    expect(regionOfDong(dong)).toBe(expected);
  });

  it("이름이 바뀐 곳은 옛 이름으로도 알아본다", () => {
    // 기록에는 그때 받은 이름이 그대로 남아 있다.
    expect(regionOfDong("강원도 속초시 조양동")).toBe("강원권");
    expect(regionOfDong("전라북도 전주시 완산구")).toBe("전라권");
  });

  it("줄여 준 이름도 알아본다", () => {
    expect(regionOfDong("서울 중구 회현동")).toBe("수도권");
    expect(regionOfDong("제주 서귀포시")).toBe("제주권");
  });

  it("모르면 억지로 고르지 않는다", () => {
    expect(regionOfDong(null)).toBeNull();
    expect(regionOfDong("")).toBeNull();
    expect(regionOfDong("   ")).toBeNull();
    expect(regionOfDong("어디먼곳 무슨시")).toBeNull();
  });

  it("한 글자로는 넘겨짚지 않는다 — '경'이 경기도인지 경상도인지 알 수 없다", () => {
    expect(regionOfDong("경 어디구")).toBeNull();
  });
});

describe("regionsOfTrip", () => {
  it("여러 권역을 넘나든 여행은 둘 다로 친다", () => {
    // 서울에서 떠나 강릉에서 잔 1박 2일. 하나만 고르면 강원권으로
    // 걸렀을 때 이 여행이 사라진다.
    const regions = regionsOfTrip([
      { dong: "서울특별시 중구 회현동1가" },
      { dong: "강원특별자치도 강릉시 송정동" },
    ]);
    expect(regions.sort()).toEqual(["강원권", "수도권"]);
  });

  it("같은 권역을 여러 번 들러도 한 번만", () => {
    expect(
      regionsOfTrip([
        { dong: "강원특별자치도 고성군 거진읍" },
        { dong: "강원특별자치도 강릉시 송정동" },
      ]),
    ).toEqual(["강원권"]);
  });

  it("행정동을 모르는 방문은 건너뛴다", () => {
    expect(regionsOfTrip([{ dong: null }, { dong: "제주특별자치도 제주시" }])).toEqual([
      "제주권",
    ]);
  });

  it("아무것도 모르면 빈 목록", () => {
    expect(regionsOfTrip([{ dong: null }])).toEqual([]);
  });
});
