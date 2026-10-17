import { describe, it, expect } from "vitest";
import { shapesOfShare } from "./share";
import { buildExample, EXAMPLE_YEAR } from "./example";

/*
  예시 여행 — 사진을 고르기 전에 완성된 모습을 보여 주는 가짜 여행. 실제 한 장 카드가 그리는 것과 같은 모양의 자료여야 하고,
  사진은 여행 100선의 공개 사진이어야 한다(새로 올려 둘 파일이 없다).
*/
describe("buildExample", () => {
  const example = buildExample()!;

  it("만들어진다 — 자료가 빠져 못 만들 때만 null", () => {
    expect(example).not.toBeNull();
  });

  it("사진은 곳마다 두 장, 모두 한국관광공사 사진 주소다", () => {
    expect(example.photos).toHaveLength(6);
    for (const photo of example.photos) expect(photo.url).toMatch(/^https:\/\/tong\.visitkorea\.or\.kr\//);
    expect(new Set(example.photos.map((photo) => photo.file)).size).toBe(6);
  });

  it("들른 곳은 사진 수와 시각이 맞고, 제목은 첫 곳 외 몇 곳이다", () => {
    expect(example.visits.map((visit) => visit.photos)).toEqual([2, 2, 2]);
    expect(example.title).toBe(`${example.visits[0].placeName} 외 2곳`);
    expect(example.visits[0].when).toMatch(/^09-13 \d\d:\d\d~\d\d:\d\d · 2장$/);
  });

  it("한 장 카드 자료의 숫자가 보여 주는 것과 같다", () => {
    const { snapshot } = example;
    expect(snapshot.year).toBe(EXAMPLE_YEAR);
    expect(snapshot.stats.photoCount).toBe(example.photos.length);
    expect(snapshot.stats.placeCount).toBe(example.visits.length);
    expect(snapshot.stats.tripCount).toBe(1);
    expect(snapshot.stats.distanceKm).toBeGreaterThan(0);
    expect(snapshot.dots).toHaveLength(3);
    expect(snapshot.paths[0].points).toHaveLength(3);
  });

  it("카드가 찾는 사진 이름이 모두 주소로 이어진다 — 빈 칸이 생기지 않는다", () => {
    const { snapshot, photoUrls } = example;
    for (const dot of snapshot.dots) expect(photoUrls.has(dot.photo!)).toBe(true);
    for (const file of snapshot.story.photos) expect(photoUrls.has(file)).toBe(true);
    expect(photoUrls.has(snapshot.story.topPlace!.photo!)).toBe(true);
  });

  it("카드가 받는 모양으로 되돌려진다 — 점과 길이 그대로", () => {
    const shapes = shapesOfShare(example.snapshot);
    expect(shapes.dots).toHaveLength(3);
    expect(shapes.paths).toHaveLength(1);
  });

  it("한 해 가운데 9월 한 달만 여행이 있다", () => {
    const { months } = example.snapshot;
    expect(months).toHaveLength(12);
    expect(months.filter((cell) => cell.tripCount > 0).map((cell) => cell.month)).toEqual([9]);
  });
});
