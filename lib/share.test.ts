// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "./sketch";
import { yearStory } from "./sketchStory";
import {
  buildSnapshot,
  isShareId,
  isSnapshot,
  newShareId,
  shapesOfShare,
  shareCardOf,
  sharePhotoPaths,
  storyOfShare,
  type ShareScope,
} from "./share";

const v = (placeName: string, lat: number, lng: number, photoCount: number, photoPath: string | null, dong: string) => ({
  placeName,
  spotId: null,
  lat,
  lng,
  photoCount,
  dong,
  photoPath,
});

const trips: SketchTrip[] = [
  {
    id: "trip-aaa",
    startedOn: "2026-04-10",
    endedOn: "2026-04-11",
    companions: "민수",
    visits: [v("우도", 33.506789, 126.954321, 12, "u1/v1/a.webp", "제주 제주시")],
  },
  {
    id: "trip-bbb",
    startedOn: "2026-08-13",
    endedOn: "2026-08-15",
    companions: "지영",
    visits: [
      v("안목해변", 37.771234, 128.947654, 31, "u1/v2/b.webp", "강원 강릉시"),
      v("속초해변", 38.190111, 128.600222, 8, "u1/v3/c.webp", "강원 속초시"),
    ],
  },
];

const sidoOf = (visit: { dong?: string | null }) => visit.dong?.split(" ")[0] ?? null;
const sketch = buildSketch(trips);
const shapes = sketchShapes(trips);
const months = monthStrip(trips);
const story = yearStory(trips, 2026, sidoOf);
const paths = sharePhotoPaths(shapes, story);
const files = new Map(paths.map((path, index) => [path, `k1-${index}.webp`]));

const snap = (scope: ShareScope, style: "map" | "collage" | "line" = "map") =>
  buildSnapshot({ year: 2026, scope, style, headline: "바다를 본 해", sketch, shapes, months, story, files, cover: "k1-card.png" });

/*
  링크로 보여 주는 것은 베낀 것이 전부다. 고르지 않은 것이 베낀 것에
  조금이라도 섞이면, 화면에서 안 보여도 주소를 아는 누구나 꺼내 볼 수
  있다. 그래서 화면이 아니라 스냅샷 자체를 들여다본다.
*/
describe("buildSnapshot · 어느 범위에서도 싣지 않는 것", () => {
  for (const scope of ["photos", "map", "sido"] as const) {
    it(`${scope}: 함께한 사람, 날짜, 여행 id, 원본 경로가 없다`, () => {
      const text = JSON.stringify(snap(scope));
      expect(text).not.toContain("민수");
      expect(text).not.toContain("지영");
      expect(text).not.toContain("trip-aaa");
      expect(text).not.toContain("2026-08-13");
      expect(text).not.toContain("2026-04-10");
      expect(text).not.toContain("u1/");
    });
  }

  it("좌표는 약 1km 로 뭉갠다", () => {
    for (const dot of snap("map").dots) {
      expect(Math.round(dot.lat * 100) / 100).toBe(dot.lat);
      expect(Math.round(dot.lng * 100) / 100).toBe(dot.lng);
    }
    expect(JSON.stringify(snap("photos"))).not.toContain("37.771234");
  });
});

describe("buildSnapshot · 범위마다", () => {
  it("사진까지 — 사진은 링크 보관함 파일 이름으로", () => {
    const shared = snap("photos");
    expect(shared.files.length).toBeGreaterThan(0);
    expect(shared.dots.find((dot) => dot.placeName === "안목해변")?.photo).toBe(files.get("u1/v2/b.webp"));
    expect(shared.story.topPlace).toEqual({ placeName: "안목해변", photoCount: 31, photo: files.get("u1/v2/b.webp") });
    expect(shared.story.photos.every((file) => shared.files.includes(file))).toBe(true);
    expect(shared.dots[0].month).toMatch(/^2026-\d\d$/);
  });

  it("지도만 — 사진은 어디에도 없고, 곳 이름과 길은 있다", () => {
    const shared = snap("map");
    expect(shared.files).toEqual([]);
    expect(shared.story.photos).toEqual([]);
    expect(shared.dots.every((dot) => dot.photo === null)).toBe(true);
    expect(shared.story.topPlace?.photo).toBeNull();
    expect(JSON.stringify(shared)).not.toContain("k1-0.webp");
    expect(shared.dots.map((dot) => dot.placeName)).toContain("우도");
    expect(shared.paths.length).toBe(1);
  });

  it("시도 이름만 — 좌표도 곳 이름도 없이 시도와 숫자만", () => {
    const shared = snap("sido");
    expect(shared.dots).toEqual([]);
    expect(shared.paths).toEqual([]);
    expect(shared.story.topPlace).toBeNull();
    expect(shared.card).toBe("sido");
    const text = JSON.stringify(shared);
    for (const name of ["우도", "안목해변", "속초해변", "126.95", "128.95"]) expect(text).not.toContain(name);
    expect(shared.story.sido.sort()).toEqual(["강원", "제주"]);
    expect(shared.stats.tripCount).toBe(2);
  });

  it("사진 없이는 콜라주를 그릴 수 없다 — 지도만이면 지도형으로", () => {
    expect(shareCardOf("map", "collage")).toBe("map");
    expect(shareCardOf("photos", "collage")).toBe("collage");
    expect(shareCardOf("map", "line")).toBe("line");
    expect(shareCardOf("sido", "line")).toBe("sido");
  });
});

describe("sharePhotoPaths", () => {
  it("가장 많이 찍은 곳부터, 겹치지 않게, 상한까지", () => {
    expect(paths[0]).toBe("u1/v2/b.webp");
    expect(new Set(paths).size).toBe(paths.length);
    expect(sharePhotoPaths(shapes, story, 2)).toHaveLength(2);
  });
});

describe("스냅샷을 다시 카드로", () => {
  it("여행 id 가 비어 있어 카드가 링크를 걸지 않는다", () => {
    const back = shapesOfShare(snap("photos"));
    expect(back.dots.every((dot) => dot.tripId === "")).toBe(true);
    expect(back.dots.find((dot) => dot.placeName === "안목해변")?.photoPath).toBe(files.get("u1/v2/b.webp"));
  });

  it("장면용 이야기에는 함께한 사람과 날짜가 없다", () => {
    const back = storyOfShare(snap("photos"));
    expect(back.companions).toEqual([]);
    expect(back.topPlace?.lastVisitedOn).toBe("");
    expect(back.photoPaths).toEqual(snap("photos").story.photos);
  });
});

describe("링크 id", () => {
  it("짐작할 수 없는 22자, 주소에 쓸 수 있는 글자만", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newShareId()));
    expect(ids.size).toBe(50);
    for (const id of ids) {
      expect(id).toHaveLength(22);
      expect(isShareId(id)).toBe(true);
    }
  });

  it("엉뚱한 id 는 받지 않는다", () => {
    expect(isShareId("abc")).toBe(false);
    expect(isShareId("../../etc/passwd-aaaaaaaaaa")).toBe(false);
  });

  it("모르는 판의 스냅샷은 그리지 않는다", () => {
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot({ v: 2 })).toBe(false);
    const valid = JSON.parse(JSON.stringify(snap("map")));
    expect(isSnapshot(valid)).toBe(true);
    // 만든 사람의 브라우저가 적은 것이다 — 그리다 넘어질 모양이면 받지 않는다.
    expect(isSnapshot({ ...valid, files: [1] })).toBe(false);
    expect(isSnapshot({ ...valid, story: { ...valid.story, sido: "강원" } })).toBe(false);
    expect(isSnapshot({ ...valid, card: "poster" })).toBe(false);
    expect(isSnapshot({ ...valid, stats: {} })).toBe(false);
  });
});
