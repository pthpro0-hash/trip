import { describe, it, expect } from "vitest";
import type { FootprintStep } from "./footprint";
import { FIRST_PAGE_PHOTOS, REST_PAGE_PHOTOS, legendOf, splitTripPhotos } from "./mailboxBook";

const photos = (n: number) => Array.from({ length: n }, (_, index) => `p${index}.webp`);

describe("splitTripPhotos · 여행 한 번의 사진을 쪽에 나눈다", () => {
  it("첫 쪽에는 제목·인사말 자리가 있어 여섯 장, 둘째 쪽에는 열다섯 장까지", () => {
    expect(FIRST_PAGE_PHOTOS).toBe(6);
    expect(REST_PAGE_PHOTOS).toBe(15);
  });

  it("여섯 장 이하면 한 쪽에 모두 — 둘째 쪽이 없다", () => {
    expect(splitTripPhotos(photos(0))).toEqual({ first: [], rest: [] });
    expect(splitTripPhotos(photos(6))).toEqual({ first: photos(6), rest: [] });
  });

  it("넘치면 둘째 쪽으로 — 차례는 그대로", () => {
    const split = splitTripPhotos(photos(10));
    expect(split.first).toEqual(photos(10).slice(0, 6));
    expect(split.rest).toEqual(photos(10).slice(6));
  });

  it("엽서 하나에 담을 수 있는 최대 스무 장은 두 쪽 안에 모두 들어간다 — 사진이 잘리지 않는다", () => {
    const split = splitTripPhotos(photos(20));
    expect(split.first).toHaveLength(6);
    expect(split.rest).toHaveLength(14);
    expect([...split.first, ...split.rest]).toEqual(photos(20));
  });

  it("두 쪽에 다 못 담는 수(스물한 장 넘게)는 앞에서부터 담는다", () => {
    const split = splitTripPhotos(photos(30));
    expect(split.first.length + split.rest.length).toBe(21);
  });
});

describe("legendOf · 지도 쪽의 곳 목록", () => {
  const step = (index: number): FootprintStep => ({
    placeName: `곳${index}`,
    lat: 35,
    lng: 127,
    month: (index % 12) + 1,
    day: index + 1,
    tripId: "t",
    photoCount: 1,
    photoPath: null,
  });

  it("번호와 이름과 날짜 — 지도의 점 번호와 같은 차례", () => {
    const { rows, more } = legendOf([step(0), step(1)]);
    expect(rows).toEqual([
      { n: 1, name: "곳0", when: "1월 1일" },
      { n: 2, name: "곳1", when: "2월 2일" },
    ]);
    expect(more).toBe(0);
  });

  it("날을 모르면 달만", () => {
    expect(legendOf([{ ...step(0), day: null }]).rows[0].when).toBe("1월");
  });

  it("서른 곳까지만 적고 나머지는 '외 N곳'으로", () => {
    const { rows, more } = legendOf(Array.from({ length: 34 }, (_, index) => step(index)));
    expect(rows).toHaveLength(30);
    expect(rows.at(-1)?.n).toBe(30);
    expect(more).toBe(4);
  });

  it("없으면 빈 목록", () => {
    expect(legendOf([])).toEqual({ rows: [], more: 0 });
  });
});
