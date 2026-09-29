// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { TripDetail } from "./supabase/tripDetail";
import { buildTripSnapshot, isTripSnapshot, tripPhotoPaths, tripShareTitle } from "./tripShare";

/*
  링크에 실리는 것은 여기서 정해진다. 남이 볼 수 있는 것이 무엇인지가
  이 파일의 시험에 그대로 적혀 있어야 한다 — 함께한 사람, 메모, 내부 주소가
  실리지 않는다는 것이 특히.
*/

const trip: TripDetail = {
  id: "trip-secret-id",
  title: "강릉 바다",
  subtitle: "안목해변에서 커피",
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  companions: "김철수, 이영희",
  note: "집에 열쇠를 두고 나왔다",
  visits: [
    {
      id: "visit-secret-id",
      placeName: "안목해변",
      spotId: null,
      dong: "강릉시 견소동",
      lat: 37.77284,
      lng: 128.94741,
      startedAt: new Date("2026-09-13T09:21:23"),
      endedAt: new Date("2026-09-13T11:00:00"),
      photos: [
        { id: "p1", storagePath: "user/v1/a.webp", takenAt: new Date("2026-09-13T09:21:23"), isCover: true },
        { id: "p2", storagePath: "user/v1/b.webp", takenAt: new Date("2026-09-13T10:00:00"), isCover: false },
      ],
    },
    {
      id: "visit-2",
      placeName: "경포대",
      spotId: null,
      dong: null,
      lat: 37.79,
      lng: 128.9,
      startedAt: new Date("2026-09-14T08:05:00"),
      endedAt: new Date("2026-09-14T09:00:00"),
      photos: [{ id: "p3", storagePath: "user/v2/c.webp", takenAt: new Date("2026-09-14T08:05:00"), isCover: false }],
    },
  ],
};

const files = new Map([
  ["user/v1/a.webp", "k1-0.webp"],
  ["user/v1/b.webp", "k1-1.webp"],
  ["user/v2/c.webp", "k1-2.webp"],
]);

describe("buildTripSnapshot", () => {
  const snapshot = buildTripSnapshot(trip, files);
  const text = JSON.stringify(snapshot);

  it("제목·부제·기간과 곳별 사진을 싣는다", () => {
    expect(snapshot.title).toBe("강릉 바다");
    expect(snapshot.subtitle).toBe("안목해변에서 커피");
    expect(snapshot.startedOn).toBe("2026-09-13");
    expect(snapshot.visits.map((v) => [v.placeName, v.day, v.photos])).toEqual([
      ["안목해변", "2026-09-13", ["k1-0.webp", "k1-1.webp"]],
      ["경포대", "2026-09-14", ["k1-2.webp"]],
    ]);
    expect(snapshot.files).toEqual(["k1-0.webp", "k1-1.webp", "k1-2.webp"]);
  });

  it("함께한 사람과 메모는 싣지 않는다", () => {
    expect(text).not.toContain("김철수");
    expect(text).not.toContain("이영희");
    expect(text).not.toContain("열쇠");
  });

  it("여행·방문·사진 id 와 원본 보관 경로는 싣지 않는다", () => {
    expect(text).not.toContain("trip-secret-id");
    expect(text).not.toContain("visit-secret-id");
    expect(text).not.toContain("user/v1");
    expect(text).not.toContain('"p1"');
  });

  it("사진을 찍은 시각은 싣지 않고 날짜까지만", () => {
    expect(text).not.toContain("09:21");
    expect(text).not.toContain("T09");
  });

  it("좌표는 소수 둘째 자리로 뭉갠다", () => {
    expect(snapshot.visits[0].lat).toBe(37.77);
    expect(snapshot.visits[0].lng).toBe(128.95);
  });

  it("올리지 못한 사진은 싣지 않는다", () => {
    const partial = buildTripSnapshot(trip, new Map([["user/v1/a.webp", "k1-0.webp"]]));
    expect(partial.visits[0].photos).toEqual(["k1-0.webp"]);
    expect(partial.visits[1].photos).toEqual([]);
    expect(partial.files).toEqual(["k1-0.webp"]);
  });

  it("오전에 찍은 사진이 전날로 밀리지 않는다", () => {
    expect(snapshot.visits[1].day).toBe("2026-09-14");
  });
});

describe("tripPhotoPaths", () => {
  it("여행에 나온 차례대로 원본 경로를 모은다", () => {
    expect(tripPhotoPaths(trip)).toEqual(["user/v1/a.webp", "user/v1/b.webp", "user/v2/c.webp"]);
  });
});

describe("isTripSnapshot", () => {
  const good = buildTripSnapshot(trip, files);

  it("우리가 만든 것은 받아들인다", () => {
    expect(isTripSnapshot(good)).toBe(true);
    expect(isTripSnapshot(JSON.parse(JSON.stringify(good)))).toBe(true);
  });

  it("모르는 판이나 모양이 틀린 것은 그리지 않는다", () => {
    expect(isTripSnapshot(null)).toBe(false);
    expect(isTripSnapshot({ ...good, v: 2 })).toBe(false);
    expect(isTripSnapshot({ ...good, visits: "x" })).toBe(false);
    expect(isTripSnapshot({ ...good, startedOn: "어제" })).toBe(false);
    expect(isTripSnapshot({ ...good, visits: [{ ...good.visits[0], lat: "37" }] })).toBe(false);
  });

  it("파일 이름에 폴더를 벗어나는 글자가 있으면 받아들이지 않는다", () => {
    expect(isTripSnapshot({ ...good, files: ["../남의폴더/a.webp"] })).toBe(false);
    expect(isTripSnapshot({ ...good, visits: [{ ...good.visits[0], photos: ["a/b.webp"] }] })).toBe(false);
  });
});

describe("tripShareTitle", () => {
  it("제목이 있으면 제목", () => {
    expect(tripShareTitle(buildTripSnapshot(trip, files))).toBe("강릉 바다");
  });

  it("제목을 짓지 않았으면 기간으로", () => {
    expect(tripShareTitle(buildTripSnapshot({ ...trip, title: null }, files))).toBe("2026년 9월 13일 ~ 9월 14일");
    expect(tripShareTitle(buildTripSnapshot({ ...trip, title: " ", endedOn: "2026-09-13" }, files))).toBe(
      "2026년 9월 13일",
    );
  });
});
