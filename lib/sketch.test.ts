// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildSketch, sketchPoints, tripDistanceKm, type SketchTrip } from "./sketch";

function trip(partial: Partial<SketchTrip> & { id: string }): SketchTrip {
  return {
    startedOn: "2026-09-13",
    endedOn: "2026-09-13",
    companions: null,
    visits: [],
    ...partial,
  };
}

const 화진포 = { placeName: "화진포해변", spotId: null, lat: 38.4798, lng: 128.4391, photoCount: 2 };
const 안목 = { placeName: "안목해변", spotId: null, lat: 37.7728, lng: 128.9474, photoCount: 1 };
const 대천 = { placeName: "대천해수욕장", spotId: "대천해수욕장", lat: 36.3094, lng: 126.5141, photoCount: 3 };
const 남산 = { placeName: "남산둘레길", spotId: null, lat: 37.5548, lng: 126.9797, photoCount: 2 };

const ALL = [
  trip({ id: "강릉", startedOn: "2026-09-13", endedOn: "2026-09-14", companions: "민수", visits: [화진포, 안목] }),
  trip({ id: "남산", startedOn: "2026-09-08", companions: "혼자", visits: [남산] }),
  trip({ id: "대천", startedOn: "2025-07-25", companions: "가족", visits: [대천] }),
  trip({ id: "대천또", startedOn: "2025-08-02", companions: "가족", visits: [대천] }),
];

describe("tripDistanceKm", () => {
  it("방문이 하나뿐이면 0", () => {
    expect(tripDistanceKm(trip({ id: "a", visits: [남산] }))).toBe(0);
  });

  it("방문이 없어도 0", () => {
    expect(tripDistanceKm(trip({ id: "a" }))).toBe(0);
  });

  it("옮겨 다닌 만큼 더한다 — 고성에서 강릉은 80km 안팎", () => {
    const km = tripDistanceKm(trip({ id: "a", visits: [화진포, 안목] }));
    expect(km).toBeGreaterThan(70);
    expect(km).toBeLessThan(110);
  });
});

describe("buildSketch", () => {
  const sketch = buildSketch(ALL);

  it("여행과 방문을 센다", () => {
    expect(sketch.tripCount).toBe(4);
    expect(sketch.visitCount).toBe(5);
  });

  it("같은 곳을 두 번 가도 장소는 하나로 센다", () => {
    // 대천을 두 번 갔지만 다녀온 곳은 네 군데다.
    expect(sketch.placeCount).toBe(4);
  });

  it("사진을 모두 더한다", () => {
    expect(sketch.photoCount).toBe(2 + 1 + 2 + 3 + 3);
  });

  it("100선은 서로 다른 곳만 센다", () => {
    expect(sketch.curatedCount).toBe(1);
  });

  it("여행과 여행 사이는 잇지 않는다", () => {
    // 강릉 여행 안의 이동만 거리가 된다. 나머지는 방문이 하나씩이다.
    expect(sketch.distanceKm).toBeCloseTo(tripDistanceKm(ALL[0]), 6);
  });

  it("연도는 최근 순", () => {
    expect(sketch.byYear).toEqual([
      { label: "2026", count: 2 },
      { label: "2025", count: 2 },
    ]);
  });

  it("함께한 사람은 많은 순", () => {
    expect(sketch.byCompanion).toEqual([
      { label: "가족", count: 2 },
      { label: "민수", count: 1 },
      { label: "혼자", count: 1 },
    ]);
    expect(sketch.topCompanion).toEqual({ label: "가족", count: 2 });
  });

  it("계절은 봄여름가을겨울 차례로", () => {
    expect(sketch.bySeason.map((s) => s.label)).toEqual(["여름", "가을"]);
  });

  it("아무도 적지 않았으면 함께한 사람이 없다", () => {
    const anonymous = buildSketch([trip({ id: "a", visits: [남산] })]);
    expect(anonymous.byCompanion).toEqual([]);
    expect(anonymous.topCompanion).toBeNull();
  });

  it("기록이 없어도 무너지지 않는다", () => {
    const empty = buildSketch([]);
    expect(empty.tripCount).toBe(0);
    expect(empty.distanceKm).toBe(0);
    expect(empty.topCompanion).toBeNull();
  });
});

describe("sketchPoints", () => {
  it("같은 자리를 여러 번 갔어도 한 번만 찍는다", () => {
    expect(sketchPoints(ALL)).toHaveLength(4);
  });

  it("1km 안쪽은 같은 자리로 본다", () => {
    const 가까운곳 = { ...남산, lat: 남산.lat + 0.001, placeName: "남산 다른 입구" };
    const points = sketchPoints([trip({ id: "a", visits: [남산, 가까운곳] })]);
    expect(points).toHaveLength(1);
  });

  it("기록이 없으면 점도 없다", () => {
    expect(sketchPoints([])).toEqual([]);
  });
});

describe("좌표가 없는 방문", () => {
  it("지도에 찍지 않는다 — cx=NaN 이 그려지면 브라우저가 오류를 쏟는다", () => {
    const 좌표없음 = {
      placeName: "어딘가",
      spotId: null,
      lat: undefined as unknown as number,
      lng: undefined as unknown as number,
      photoCount: 0,
    };
    const points = sketchPoints([trip({ id: "a", visits: [좌표없음, 남산] })]);
    expect(points).toEqual([{ lat: 남산.lat, lng: 남산.lng }]);
  });

  it("그래도 방문 수와 사진 수에는 들어간다", () => {
    const 좌표없음 = {
      placeName: "어딘가",
      spotId: null,
      lat: Number.NaN,
      lng: Number.NaN,
      photoCount: 4,
    };
    const sketch = buildSketch([trip({ id: "a", visits: [좌표없음] })]);
    expect(sketch.visitCount).toBe(1);
    expect(sketch.photoCount).toBe(4);
  });
});
