import { describe, it, expect } from "vitest";
import { SIDO, sidoAt, sidoBounds, sidoOf, sidoOfDong, sidoTally } from "./sido";

describe("SIDO", () => {
  it("17개 시도가 다 있다 — 세종까지", () => {
    expect(SIDO).toHaveLength(17);
    expect(SIDO.map((s) => s.name)).toContain("세종");
  });
});

describe("sidoOfDong", () => {
  it("법정동 맨 앞 칸이 시도다", () => {
    expect(sidoOfDong("강원특별자치도 강릉시 송정동")).toBe("강원");
    expect(sidoOfDong("서울특별시 종로구 세종로")).toBe("서울");
  });

  it("옛 이름도 받는다 — 기록에는 그때 받은 이름이 남아 있다", () => {
    expect(sidoOfDong("강원도 강릉시 송정동")).toBe("강원");
    expect(sidoOfDong("전라북도 전주시 완산구")).toBe("전북");
  });

  it("모르는 것은 null", () => {
    expect(sidoOfDong("강릉시 송정동")).toBeNull();
    expect(sidoOfDong(null)).toBeNull();
    expect(sidoOfDong("")).toBeNull();
  });
});

describe("sidoAt", () => {
  it("좌표로 시도를 찾는다", () => {
    expect(sidoAt(37.7728, 128.9474)).toBe("강원"); // 안목해변 근처
    expect(sidoAt(33.4996, 126.5312)).toBe("제주"); // 제주시
    expect(sidoAt(36.48, 127.289)).toBe("세종");
  });

  /*
    경기도에는 서울이, 전남에는 광주가, 경북에는 대구가 구멍으로 뚫려
    있다. 구멍을 안 보면 서울시청이 경기도가 된다.
  */
  it("둘러싼 도의 구멍 안이면 그 안의 시다", () => {
    expect(sidoAt(37.5663, 126.9779)).toBe("서울");
    expect(sidoAt(35.8714, 128.6014)).toBe("대구");
    /*
      광주는 원본(Natural Earth 1:10m)부터 점 열두 개로 거칠게 그려져
      있어 광산구 쪽이 통째로 빠져 있다. 북구청처럼 확실히 안쪽인 점으로
      잰다. 실제 기록은 법정동으로 가리므로 이 거칢이 셈을 틀리게 하지는
      않는다(아래 sidoOf 참고).
    */
    expect(sidoAt(35.174, 126.912)).toBe("광주");
  });

  it("바닷가에서 경계를 살짝 벗어나도 가장 가까운 시도로 친다", () => {
    // 해운대 모래사장. 줄인 경계에서는 바다로 빠지기 쉬운 자리다.
    expect(sidoAt(35.1587, 129.1604)).toBe("부산");
  });

  it("이 나라가 아니면 null", () => {
    expect(sidoAt(35.6762, 139.6503)).toBeNull(); // 도쿄
    expect(sidoAt(Number.NaN, 127)).toBeNull();
  });
});

describe("sidoOf · sidoTally", () => {
  it("광주 시청처럼 거친 경계 밖에 떨어지는 곳도 법정동이 있으면 맞힌다", () => {
    expect(sidoOf({ dong: "광주광역시 서구 치평동", lat: 35.1595, lng: 126.8526 })).toBe("광주");
  });

  it("법정동이 먼저, 없으면 좌표", () => {
    // 법정동이 강원이라고 하면 좌표가 어디든 강원이다.
    expect(sidoOf({ dong: "강원특별자치도 속초시", lat: 0, lng: 0 })).toBe("강원");
    expect(sidoOf({ dong: null, lat: 37.5663, lng: 126.9779 })).toBe("서울");
  });

  it("시도마다 다녀온 곳을 센다", () => {
    const tally = sidoTally([
      { dong: "강원특별자치도 강릉시", lat: 0, lng: 0 },
      { dong: "강원특별자치도 속초시", lat: 0, lng: 0 },
      { dong: null, lat: 33.4996, lng: 126.5312 },
    ]);
    expect(tally.get("강원")).toBe(2);
    expect(tally.get("제주")).toBe(1);
    expect(tally.has("서울")).toBe(false);
  });
});

describe("sidoBounds", () => {
  it("시도의 남서·북동 모서리", () => {
    const [sw, ne] = sidoBounds("제주");
    expect(sw.lat).toBeLessThan(ne.lat);
    expect(sw.lng).toBeLessThan(ne.lng);
    expect(sw.lat).toBeGreaterThan(33);
    expect(ne.lat).toBeLessThan(34);
  });

  it("없는 이름이면 빈 배열", () => {
    expect(sidoBounds("평양")).toEqual([]);
  });
});
