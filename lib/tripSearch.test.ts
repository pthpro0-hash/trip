// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  companionOptions,
  matchesTime,
  parseTimeTerm,
  scoreTrip,
  searchTrips,
  yearOptions,
  type SearchableTrip,
} from "./tripSearch";

// 오늘이 2026-09-22 라고 두고 본다. "작년"은 2025년이다.
const NOW = new Date(2026, 8, 22);

function trip(partial: Partial<SearchableTrip> & { id: string }): SearchableTrip {
  return {
    title: null,
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: null,
    note: null,
    placeNames: [],
    dongs: [],
    ...partial,
  };
}

const 강릉 = trip({
  id: "강릉",
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  companions: "민수",
  note: "해뜨기 전에 도착해서 사진이 잘 나왔다",
  placeNames: ["화진포해변", "안목해변"],
  dongs: ["강원특별자치도 고성군 거진읍", "강원특별자치도 강릉시 송정동"],
});

const 대천 = trip({
  id: "대천",
  startedOn: "2025-07-25",
  endedOn: "2025-07-25",
  companions: "가족",
  placeNames: ["대천해수욕장"],
  dongs: ["충청남도 보령시 대천5동"],
});

const 남산 = trip({
  id: "남산",
  startedOn: "2026-09-08",
  endedOn: "2026-09-08",
  companions: "혼자",
  placeNames: ["남산둘레길"],
  dongs: ["서울특별시 중구 회현동"],
});

const ALL = [강릉, 대천, 남산];

describe("사람이 지은 제목", () => {
  const 첫휴가 = trip({
    id: "첫휴가",
    title: "민수랑 첫 휴가",
    placeNames: ["화진포해변"],
  });

  it("제목으로 찾는다", () => {
    expect(searchTrips([첫휴가, 대천], "첫 휴가", NOW).map((t) => t.id)).toEqual(["첫휴가"]);
  });

  it("제목이 장소명보다 앞선다", () => {
    const 제목 = trip({ id: "제목", title: "바다" });
    const 장소 = trip({ id: "장소", placeNames: ["바다"] });
    expect(scoreTrip(제목, "바다", NOW)).toBeGreaterThan(scoreTrip(장소, "바다", NOW));
  });

  it("초성으로도 제목을 찾는다", () => {
    expect(searchTrips([첫휴가, 대천], "ㅊㅎㄱ", NOW).map((t) => t.id)).toEqual(["첫휴가"]);
  });

  it("제목이 없어도 예전처럼 장소로 찾는다", () => {
    expect(searchTrips(ALL, "안목", NOW).map((t) => t.id)).toEqual(["강릉"]);
  });
});

describe("parseTimeTerm", () => {
  it("작년과 올해를 읽는다", () => {
    expect(parseTimeTerm("작년", NOW)).toEqual({ year: 2025 });
    expect(parseTimeTerm("올해", NOW)).toEqual({ year: 2026 });
    expect(parseTimeTerm("재작년", NOW)).toEqual({ year: 2024 });
  });

  it("연도와 달을 읽는다", () => {
    expect(parseTimeTerm("2025년", NOW)).toEqual({ year: 2025 });
    expect(parseTimeTerm("2025", NOW)).toEqual({ year: 2025 });
    expect(parseTimeTerm("9월", NOW)).toEqual({ month: 9 });
  });

  it("계절을 읽는다", () => {
    expect(parseTimeTerm("가을", NOW)).toEqual({ season: "가을" });
  });

  it("13월 같은 것은 시기가 아니다", () => {
    expect(parseTimeTerm("13월", NOW)).toBeNull();
  });

  it("장소 이름은 시기가 아니다", () => {
    expect(parseTimeTerm("민수", NOW)).toBeNull();
    expect(parseTimeTerm("해변", NOW)).toBeNull();
  });
});

describe("matchesTime", () => {
  it("연도로 가른다", () => {
    expect(matchesTime(대천, { year: 2025 })).toBe(true);
    expect(matchesTime(대천, { year: 2026 })).toBe(false);
  });

  it("계절로 가른다", () => {
    expect(matchesTime(대천, { season: "여름" })).toBe(true);
    expect(matchesTime(강릉, { season: "가을" })).toBe(true);
    expect(matchesTime(강릉, { season: "겨울" })).toBe(false);
  });

  it("연도와 달을 함께 볼 때 둘 다 맞아야 한다", () => {
    expect(matchesTime(대천, { year: 2025, month: 7 })).toBe(true);
    expect(matchesTime(대천, { year: 2025, month: 9 })).toBe(false);
  });

  it("걸친 여행은 어느 날이든 맞으면 든다", () => {
    const 해넘이 = trip({ id: "해넘이", startedOn: "2025-12-31", endedOn: "2026-01-01" });
    expect(matchesTime(해넘이, { year: 2025 })).toBe(true);
    expect(matchesTime(해넘이, { year: 2026 })).toBe(true);
  });
});

describe("searchTrips", () => {
  it("사람 이름으로 찾는다", () => {
    expect(searchTrips(ALL, "민수", NOW).map((t) => t.id)).toEqual(["강릉"]);
  });

  it("장소 이름으로 찾는다", () => {
    expect(searchTrips(ALL, "해변", NOW).map((t) => t.id)).toEqual(["강릉"]);
  });

  it("행정동으로 찾는다", () => {
    expect(searchTrips(ALL, "강릉시", NOW).map((t) => t.id)).toEqual(["강릉"]);
  });

  it("메모에 적은 말로도 찾는다", () => {
    expect(searchTrips(ALL, "해뜨기", NOW).map((t) => t.id)).toEqual(["강릉"]);
  });

  it("애매한 기억 그대로 던져도 찾는다 — '작년 가족'", () => {
    expect(searchTrips(ALL, "작년 가족", NOW).map((t) => t.id)).toEqual(["대천"]);
  });

  it("낱말이 모두 맞아야 한다 — '작년 민수'는 없다", () => {
    // 민수와 간 여행은 올해이고, 작년 여행은 가족과 갔다.
    expect(searchTrips(ALL, "작년 민수", NOW)).toEqual([]);
  });

  it("계절과 사람을 섞어 찾는다", () => {
    expect(searchTrips(ALL, "여름 가족", NOW).map((t) => t.id)).toEqual(["대천"]);
  });

  it("초성으로도 찾는다", () => {
    // ㄴㅅ = 남산
    expect(searchTrips(ALL, "ㄴㅅ", NOW).map((t) => t.id)).toEqual(["남산"]);
  });

  it("띄어쓰기가 달라도 찾는다", () => {
    expect(searchTrips(ALL, "대천 해수욕장", NOW).map((t) => t.id)).toEqual(["대천"]);
  });

  it("행정동은 낱말 앞에서 끊어 본다 — '안동'이 '장안동'에 걸리지 않는다", () => {
    const 대전 = trip({ id: "대전", dongs: ["대전광역시 서구 장안동"] });
    expect(searchTrips([대전], "안동", NOW)).toEqual([]);
    expect(searchTrips([대전], "장안동", NOW).map((t) => t.id)).toEqual(["대전"]);
  });

  it("맞는 것이 없으면 빈 목록", () => {
    expect(searchTrips(ALL, "제주", NOW)).toEqual([]);
  });

  it("검색어가 없으면 전부 그대로", () => {
    expect(searchTrips(ALL, "   ", NOW)).toHaveLength(3);
  });

  it("장소 이름이 정확히 맞으면 위로 온다", () => {
    const 부분 = trip({ id: "부분", placeNames: ["안목해변 카페거리"] });
    const 정확 = trip({ id: "정확", placeNames: ["안목해변"] });
    expect(searchTrips([부분, 정확], "안목해변", NOW).map((t) => t.id)).toEqual([
      "정확",
      "부분",
    ]);
  });
});

describe("scoreTrip", () => {
  it("맞지 않으면 0", () => {
    expect(scoreTrip(남산, "민수", NOW)).toBe(0);
  });

  it("사람보다 정확한 장소 이름이 높다", () => {
    expect(scoreTrip(대천, "대천해수욕장", NOW)).toBeGreaterThan(scoreTrip(대천, "가족", NOW));
  });
});

describe("필터 후보", () => {
  it("실제로 나온 동행자만 많은 순으로", () => {
    const many = [강릉, 대천, 남산, trip({ id: "또", companions: "가족" })];
    expect(companionOptions(many)).toEqual(["가족", "민수", "혼자"]);
  });

  it("기록이 걸쳐 있는 연도를 최근 순으로", () => {
    expect(yearOptions(ALL)).toEqual([2026, 2025]);
  });

  it("기록이 없으면 후보도 없다", () => {
    expect(companionOptions([])).toEqual([]);
    expect(yearOptions([])).toEqual([]);
  });
});
