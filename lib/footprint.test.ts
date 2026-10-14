// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SketchTrip } from "./sketch";
import { buildSketch, monthStrip, sketchShapes } from "./sketch";
import { yearStory } from "./sketchStory";
import { buildSnapshot, sharePhotoPaths } from "./share";
import {
  DONE_R,
  PICK_R,
  dotRadius,
  footprintSteps,
  footprintStepsOfShare,
  labelOf,
  monthCountsOfShare,
  stepTitle,
  toggleMonth,
  tripsPerMonth,
  type FootprintStep,
} from "./footprint";

/*
  한 해를 날짜순으로 찍어 보는 발자취.

  선은 잇지 않는다. 여행과 여행 사이에는 실제로 걸은 길이 없어, 이으면 없는 동선이
  생긴다(sketchShapes 가 같은 까닭으로 여행 안에서만 잇는다). 현재 점은 크게, 이전
  점은 작게 남긴다.
*/

const visit = (
  placeName: string,
  lat: number,
  lng: number,
  photoCount: number,
  extra: { visitedOn?: string; photoPath?: string | null } = {},
) => ({ placeName, spotId: null, lat, lng, photoCount, dong: null, photoPath: null, ...extra });

const trip = (id: string, startedOn: string, visits: ReturnType<typeof visit>[]): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions: null,
  visits,
});

const trips: SketchTrip[] = [
  // 일부러 시간 순서를 섞어 둔다.
  trip("t3", "2026-08-13", [
    visit("안목해변", 37.77, 128.95, 31, { visitedOn: "2026-08-13", photoPath: "a.webp" }),
    visit("속초해변", 38.19, 128.6, 12, { visitedOn: "2026-08-14" }),
  ]),
  trip("t1", "2026-03-22", [visit("남산", 37.55, 126.98, 16)]),
  trip("t2", "2026-05-03", [
    visit("대천해수욕장", 36.3, 126.5, 12),
    visit("전주 한옥마을", 35.82, 127.15, 20, { visitedOn: "2026-05-04" }),
  ]),
];

describe("footprintSteps · 날짜순으로 찍을 곳", () => {
  const steps = footprintSteps(trips);

  it("여행이 섞여 있어도 날짜순", () => {
    expect(steps.map((step) => step.placeName)).toEqual([
      "남산",
      "대천해수욕장",
      "전주 한옥마을",
      "안목해변",
      "속초해변",
    ]);
  });

  it("그곳에 간 날을 쓴다 — 여행 시작일이 아니라(사흘째에 간 곳은 사흘째)", () => {
    const 속초 = steps.find((step) => step.placeName === "속초해변")!;
    expect([속초.month, 속초.day]).toEqual([8, 14]);
    const 전주 = steps.find((step) => step.placeName === "전주 한옥마을")!;
    expect([전주.month, 전주.day]).toEqual([5, 4]);
  });

  it("방문한 날을 모르면 여행 시작일로 갈음한다", () => {
    const 남산 = steps.find((step) => step.placeName === "남산")!;
    expect([남산.month, 남산.day]).toEqual([3, 22]);
  });

  it("같은 날이면 여행 안에서 들른 차례대로", () => {
    const same = footprintSteps([
      trip("x", "2026-06-01", [visit("첫째", 37, 127, 1), visit("둘째", 37.1, 127.1, 1), visit("셋째", 37.2, 127.2, 1)]),
    ]);
    expect(same.map((step) => step.placeName)).toEqual(["첫째", "둘째", "셋째"]);
  });

  it("같은 곳을 두 번 갔으면 두 번 찍는다 — 방문마다 한 번", () => {
    const twice = footprintSteps([
      trip("a", "2026-04-01", [visit("안목해변", 37.77, 128.95, 5)]),
      trip("b", "2026-09-01", [visit("안목해변", 37.77, 128.95, 9)]),
    ]);
    expect(twice.map((step) => [step.month, step.placeName])).toEqual([
      [4, "안목해변"],
      [9, "안목해변"],
    ]);
  });

  it("여행 id 와 대표 사진, 사진 수를 함께 넘긴다", () => {
    const 안목 = steps.find((step) => step.placeName === "안목해변")!;
    expect(안목.tripId).toBe("t3");
    expect(안목.photoPath).toBe("a.webp");
    expect(안목.photoCount).toBe(31);
  });

  it("좌표가 없는 방문은 찍을 수 없어 건너뛴다", () => {
    const skipped = footprintSteps([trip("a", "2026-04-01", [visit("좌표없음", NaN, NaN, 3), visit("남산", 37.55, 126.98, 2)])]);
    expect(skipped.map((step) => step.placeName)).toEqual(["남산"]);
  });

  it("기록이 없으면 빈 배열", () => {
    expect(footprintSteps([])).toEqual([]);
  });
});

describe("tripsPerMonth · 월별 여행 수", () => {
  it("열두 칸, 그 달에 든 여행의 수", () => {
    const counts = tripsPerMonth(footprintSteps(trips));
    expect(counts).toHaveLength(12);
    expect(counts[2]).toBe(1); // 3월
    expect(counts[4]).toBe(1); // 5월 — 곳이 둘이어도 여행은 하나
    expect(counts[7]).toBe(1); // 8월
    expect(counts[0]).toBe(0);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("한 달에 여행이 둘이면 둘", () => {
    const counts = tripsPerMonth(
      footprintSteps([trip("a", "2026-05-01", [visit("가", 37, 127, 1)]), trip("b", "2026-05-20", [visit("나", 37.1, 127.1, 1)])]),
    );
    expect(counts[4]).toBe(2);
  });
});

describe("toggleMonth · 달 고르기", () => {
  it("달을 누르면 그 달만, 같은 달을 다시 누르면 전부로", () => {
    expect(toggleMonth(null, 8)).toBe(8);
    expect(toggleMonth(8, 8)).toBeNull();
  });

  it("다른 달을 누르면 그 달로 옮겨 간다", () => {
    expect(toggleMonth(8, 5)).toBe(5);
  });
});

describe("dotRadius · 점의 크기", () => {
  const step = (month: number): FootprintStep => ({
    placeName: "가",
    lat: 37,
    lng: 127,
    month,
    day: 1,
    tripId: "t",
    photoCount: 1,
    photoPath: null,
  });

  it("처음부터 모든 점이 같은 크기로 찍혀 있다 — 재생은 없다", () => {
    expect(dotRadius(step(3), null)).toBe(DONE_R);
    expect(dotRadius(step(8), null)).toBe(DONE_R);
  });

  it("달을 고르면 그 달의 점만 남는다", () => {
    expect(dotRadius(step(8), 8)).toBe(PICK_R);
    expect(dotRadius(step(5), 8)).toBe(0);
  });
});

describe("stepTitle · 날짜와 장소명", () => {
  const base: FootprintStep = {
    placeName: "안목해변",
    lat: 37,
    lng: 127,
    month: 8,
    day: 13,
    tripId: "t",
    photoCount: 31,
    photoPath: null,
  };

  it("날짜와 장소명", () => {
    expect(stepTitle(base)).toBe("8월 13일 · 안목해변");
  });

  it("링크로 받은 것은 날을 몰라 달까지만", () => {
    expect(stepTitle({ ...base, day: null })).toBe("8월 · 안목해변");
  });
});

describe("labelOf · 지도 아래 띠", () => {
  const steps = footprintSteps(trips);
  const totals = { trips: 3, places: 5, photos: 91 };
  const counts = tripsPerMonth(steps);

  it("달을 고르지 않았으면 한 해를 말한다", () => {
    const label = labelOf(steps, null, counts, totals);
    expect(label.title).toBe("다녀온 곳 5곳");
    expect(label.sub).toBe("여행 3번 · 사진 91장");
  });

  it("달을 고르면 그 달의 여행 수와 곳들을 나열한다", () => {
    const label = labelOf(steps, 8, counts, totals);
    expect(label.title).toBe("8월 · 여행 1번");
    expect(label.sub).toBe("13일 안목해변 · 14일 속초해변");
  });

  it("한 달에 곳이 많으면 앞의 몇 곳과 나머지 수", () => {
    const many = footprintSteps([
      trip(
        "a",
        "2026-06-01",
        Array.from({ length: 9 }, (_, i) => visit(`곳${i + 1}`, 37 + i * 0.1, 127 + i * 0.1, 1, { visitedOn: `2026-06-${String(i + 1).padStart(2, "0")}` })),
      ),
    ]);
    const label = labelOf(many, 6, tripsPerMonth(many), { trips: 1, places: 9, photos: 9 });
    expect(label.sub).toBe("1일 곳1 · 2일 곳2 · 3일 곳3 · 4일 곳4 · 5일 곳5 · 6일 곳6 외 3곳");
  });

  it("링크로 받은 것은 날 없이 이름만", () => {
    const shared = steps.map((step) => ({ ...step, day: null, tripId: "" }));
    const label = labelOf(shared, 8, counts, totals);
    expect(label.sub).toBe("안목해변 · 속초해변");
  });
});

/*
  링크로 받은 사람도 볼 수 있다. 스냅샷에는 곳 이름·달·사진 수·흐린 좌표뿐이고
  날짜와 여행 id 는 없다(lib/share). 있는 것만으로 만든다.
*/
describe("스냅샷에서 되짚기", () => {
  const sidoOf = (visit: { dong?: string | null }) => visit.dong?.split(" ")[0] ?? null;
  const sketch = buildSketch(trips);
  const shapes = sketchShapes(trips);
  const months = monthStrip(trips);
  const story = yearStory(trips, 2026, sidoOf);
  const files = new Map(sharePhotoPaths(shapes, story).map((path, index) => [path, `k1-${index}.webp`]));
  const snap = (scope: "photos" | "map" | "sido") =>
    buildSnapshot({ year: 2026, scope, style: "map", headline: "", sketch, shapes, months, story, files, cover: null });

  it("달 순서로, 날과 여행 id 없이", () => {
    const steps = footprintStepsOfShare(snap("photos"));
    expect(steps.map((step) => step.placeName)).toEqual(["남산", "대천해수욕장", "전주 한옥마을", "안목해변", "속초해변"]);
    for (const step of steps) {
      expect(step.day).toBeNull();
      expect(step.tripId).toBe("");
    }
    expect(steps.map((step) => step.month)).toEqual([3, 5, 5, 8, 8]);
  });

  it("사진까지는 사진 파일 이름이, 지도만은 사진이 없다", () => {
    expect(footprintStepsOfShare(snap("photos")).some((step) => step.photoPath)).toBe(true);
    expect(footprintStepsOfShare(snap("map")).every((step) => step.photoPath === null)).toBe(true);
  });

  it("시도 이름만이면 곳이 없어 찍을 것도 없다", () => {
    expect(footprintStepsOfShare(snap("sido"))).toEqual([]);
  });

  it("월별 여행 수는 스냅샷의 달 띠에서", () => {
    const counts = monthCountsOfShare(snap("map"));
    expect(counts).toHaveLength(12);
    expect(counts[2]).toBe(1);
    expect(counts[4]).toBe(1);
    expect(counts[7]).toBe(1);
  });

  it("스냅샷에 정확한 날짜는 없다 — 이 발자취도 달까지만", () => {
    const text = JSON.stringify(footprintStepsOfShare(snap("photos")));
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe("해외 곳은 지도에 그리지 않는다 — 지도는 한국만", () => {
  const mixed = [
    trip("a", "2025-04-01", [visit("남산", 37.55, 126.98, 5), visit("런던 아이", 51.503, -0.119, 9)]),
    trip("b", "2025-09-01", [visit("도쿄타워", 35.658, 139.745, 4)]),
  ];

  it("발자취는 한국 곳만 찍는다", () => {
    expect(footprintSteps(mixed).map((step) => step.placeName)).toEqual(["남산"]);
  });

  it("그림(점)도 한국 곳만 — 해외 점이 그해 지도를 일그러뜨리지 않는다", () => {
    expect(sketchShapes(mixed).dots.map((dot) => dot.placeName)).toEqual(["남산"]);
  });
});
