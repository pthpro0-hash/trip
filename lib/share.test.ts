// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "./sketch";
import { PLACE_SHOWN, yearStory } from "./sketchStory";
import { yearsStory } from "./yearsStory";
import {
  ALL_YEARS,
  SHARE_PHOTO_LIMIT,
  buildAllSnapshot,
  layersOfShare,
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

/*
  "그해의 곳들"은 링크로 받은 사람도 본다. 따로 싣지 않는다 — 스냅샷의 점(곳 이름·
  사진 수·달·사진 파일)에서 되짚는다. 그래서 범위가 곧 목록의 범위다: 사진까지면
  사진이 있고, 지도만이면 이름뿐이고, 시도 이름만이면 목록이 없다. 날짜는 달까지,
  여행 id 는 없으니 눌러도 갈 곳이 없다.
*/
describe("sharePhotoPaths · 그해의 곳들의 사진", () => {
  // 사진을 10장 이상 남긴 곳이 열넷 — 콜라주 후보와 자리를 다툰다.
  const many: SketchTrip[] = [
    {
      id: "trip-many",
      startedOn: "2026-05-01",
      endedOn: "2026-05-02",
      companions: null,
      visits: Array.from({ length: 14 }, (_, i) =>
        v(`곳${String(i).padStart(2, "0")}`, 34 + i * 0.3, 126 + i * 0.3, 60 - i, `u1/m/${i}.webp`, "강원 강릉시"),
      ),
    },
  ];
  const manyShapes = sketchShapes(many);
  const manyStory = yearStory(many, 2026, sidoOf);
  const uploaded = sharePhotoPaths(manyShapes, manyStory);

  it("먼저 보이는 열 곳의 대표 사진은 자리가 모자라도 언제나 올린다", () => {
    const shown = manyStory.places.filter((place) => place.rank < PLACE_SHOWN);
    expect(shown).toHaveLength(10);
    for (const place of shown) expect(uploaded).toContain(place.photoPath);
  });

  it("총 상한은 넘지 않는다", () => {
    expect(uploaded.length).toBeLessThanOrEqual(SHARE_PHOTO_LIMIT);
  });
});

describe("스냅샷 → 그해의 곳들", () => {
  it("사진까지: 곳 이름·사진·달까지 — 여행 id 도 날짜도 없다", () => {
    const { places } = storyOfShare(snap("photos"));
    expect(places.map((place) => place.placeName).sort()).toEqual(["속초해변", "안목해변", "우도"]);
    for (const place of places) {
      expect(place.tripId).toBe("");
      expect(place.lastVisitedOn).toMatch(/^\d{4}-\d{2}$/);
    }
    expect(places.find((place) => place.placeName === "안목해변")?.photoPath).toBe(files.get("u1/v2/b.webp"));
  });

  it("지도만: 이름은 있고 사진은 없다", () => {
    const { places } = storyOfShare(snap("map"));
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((place) => place.photoPath === null)).toBe(true);
  });

  it("시도 이름만: 곳 목록이 없다", () => {
    expect(storyOfShare(snap("sido")).places).toEqual([]);
  });

  it("열 곳까지만 — '더 보기'는 내 화면에서만 열린다", () => {
    const many: SketchTrip[] = [
      {
        id: "trip-many",
        startedOn: "2026-05-01",
        endedOn: "2026-05-02",
        companions: null,
        visits: Array.from({ length: 14 }, (_, i) =>
          v(`곳${String(i).padStart(2, "0")}`, 34 + i * 0.3, 126 + i * 0.3, 60 - i, `u1/m/${i}.webp`, "강원 강릉시"),
        ),
      },
    ];
    const manyShapes = sketchShapes(many);
    const manyStory = yearStory(many, 2026, sidoOf);
    const manyFiles = new Map(sharePhotoPaths(manyShapes, manyStory).map((path, index) => [path, `k2-${index}.webp`]));
    const snapshot = buildSnapshot({
      year: 2026,
      scope: "photos",
      style: "map",
      headline: "",
      sketch: buildSketch(many),
      shapes: manyShapes,
      months: monthStrip(many),
      story: manyStory,
      files: manyFiles,
      cover: null,
    });
    const { places } = storyOfShare(snapshot);
    expect(places).toHaveLength(10);
    // 올린 사진이 곧 보이는 사진이다 — 빈 칸이 없다.
    expect(places.every((place) => place.photoPath !== null)).toBe(true);
  });

  it("어느 범위에서도 스냅샷에 정확한 날짜와 여행 id 는 없다 (달까지만)", () => {
    for (const scope of ["photos", "map", "sido"] as const) {
      const text = JSON.stringify(snap(scope));
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
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

/*
  "전체"도 같은 약속이다. 전체 카드는 곳 이름도 사진도 그리지 않으니
  아예 싣지 않는다.
*/
describe("buildAllSnapshot", () => {
  const several = [...trips, { ...trips[0], id: "trip-ccc", startedOn: "2025-10-01", endedOn: "2025-10-02" }];
  const story = yearsStory(several, sidoOf);
  const all = (scope: ShareScope) => buildAllSnapshot({ scope, headline: "바다만 세 번", story, cover: null });

  for (const scope of ["map", "sido"] as const) {
    it(`${scope}: 이름·날짜·여행 id·사진·곳 이름이 없다`, () => {
      const text = JSON.stringify(all(scope));
      for (const secret of ["민수", "지영", "trip-aaa", "trip-ccc", "2026-08-13", "u1/", "우도", "안목해변"]) {
        expect(text).not.toContain(secret);
      }
      expect(all(scope).files).toEqual([]);
      expect(all(scope).year).toBe(ALL_YEARS);
    });
  }

  it("지도면 해마다의 점과 길, 해마다의 숫자", () => {
    const shared = all("map");
    expect(shared.card).toBe("years");
    expect(shared.years?.map((row) => row.year)).toEqual([2025, 2026]);
    const layers = layersOfShare(JSON.parse(JSON.stringify(shared)));
    expect(layers.map((layer) => layer.year)).toEqual([2025, 2026]);
    expect(layers[1].shapes.dots.length).toBe(story.layers[1].shapes.dots.length);
    expect(layers[1].shapes.paths.length).toBe(story.layers[1].shapes.paths.length);
  });

  it("시도 이름만이면 좌표 없이 시도 카드", () => {
    const shared = all("sido");
    expect(shared.card).toBe("sido");
    expect(shared.dots).toEqual([]);
    expect(shared.paths).toEqual([]);
    expect(shared.story.sido.sort()).toEqual(["강원", "제주"]);
  });

  it("사진까지를 달라고 해도 사진은 싣지 않는다", () => {
    expect(all("photos").scope).toBe("map");
    expect(all("photos").files).toEqual([]);
  });

  it("스냅샷 검사를 통과한다", () => {
    expect(isSnapshot(JSON.parse(JSON.stringify(all("map"))))).toBe(true);
  });
});
