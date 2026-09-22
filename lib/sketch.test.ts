// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildSketch,
  dotRadius,
  groupByYear,
  monthStrip,
  sketchShapes,
  tripDistanceKm,
  type SketchTrip,
} from "./sketch";

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

describe("sketchShapes · 점", () => {
  it("같은 자리를 여러 번 갔어도 한 번만 찍는다", () => {
    expect(sketchShapes(ALL).dots).toHaveLength(4);
  });

  it("1km 안쪽은 같은 자리로 본다", () => {
    const 가까운곳 = { ...남산, lat: 남산.lat + 0.001, placeName: "남산 다른 입구" };
    expect(sketchShapes([trip({ id: "a", visits: [남산, 가까운곳] })]).dots).toHaveLength(1);
  });

  it("같은 자리의 사진은 모두 더한다 — 점의 크기가 된다", () => {
    const 두번 = [
      trip({ id: "a", startedOn: "2025-07-25", endedOn: "2025-07-25", visits: [대천] }),
      trip({ id: "b", startedOn: "2025-08-02", endedOn: "2025-08-02", visits: [대천] }),
    ];
    const [dot] = sketchShapes(두번).dots;
    expect(dot.photoCount).toBe(6);
  });

  it("가장 많이 찍은 때의 계절을 입는다", () => {
    const dots = sketchShapes([
      // 같은 자리를 봄에 한 장, 가을에 다섯 장 찍었다.
      trip({ id: "봄", startedOn: "2026-04-01", endedOn: "2026-04-01", visits: [{ ...남산, photoCount: 1 }] }),
      trip({ id: "가을", startedOn: "2026-10-01", endedOn: "2026-10-01", visits: [{ ...남산, photoCount: 5 }] }),
    ]).dots;
    expect(dots[0].season).toBe("가을");
  });

  it("가장 최근에 들른 여행으로 이어 준다", () => {
    const dots = sketchShapes([
      trip({ id: "먼저", startedOn: "2025-04-01", endedOn: "2025-04-01", visits: [남산] }),
      trip({ id: "나중", startedOn: "2026-10-01", endedOn: "2026-10-01", visits: [남산] }),
    ]).dots;
    expect(dots[0].tripId).toBe("나중");
  });

  it("기록이 없으면 점도 길도 없다", () => {
    expect(sketchShapes([])).toEqual({ dots: [], paths: [] });
  });
});

describe("sketchShapes · 길", () => {
  it("한 여행 안에서 옮겨 다닌 순서대로 잇는다", () => {
    const [path] = sketchShapes([
      trip({ id: "강릉", startedOn: "2026-09-13", endedOn: "2026-09-14", visits: [화진포, 안목] }),
    ]).paths;
    expect(path.points).toEqual([
      { lat: 화진포.lat, lng: 화진포.lng },
      { lat: 안목.lat, lng: 안목.lng },
    ]);
    expect(path.season).toBe("가을");
  });

  it("한 자리에 머문 여행에는 그릴 길이 없다", () => {
    expect(sketchShapes([trip({ id: "a", visits: [남산] })]).paths).toEqual([]);
  });

  it("여행과 여행 사이는 잇지 않는다 — 집에 갔다 다시 나온 것이다", () => {
    const paths = sketchShapes([
      trip({ id: "1", startedOn: "2026-09-13", endedOn: "2026-09-13", visits: [화진포, 안목] }),
      trip({ id: "2", startedOn: "2026-10-01", endedOn: "2026-10-01", visits: [남산, 대천] }),
    ]).paths;
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.tripId)).toEqual(["1", "2"]);
  });
});

describe("dotRadius", () => {
  it("많이 찍은 곳이 크다", () => {
    expect(dotRadius(40, 40)).toBeGreaterThan(dotRadius(4, 40));
  });

  it("넓이가 사진 수에 비례한다 — 네 배면 반지름은 두 배", () => {
    const min = 5;
    expect(dotRadius(40, 40) - min).toBeCloseTo((dotRadius(10, 40) - min) * 2, 5);
  });

  it("사진이 없어도 점은 보인다", () => {
    expect(dotRadius(0, 40)).toBe(5);
    expect(dotRadius(3, 0)).toBe(5);
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
    const { dots } = sketchShapes([trip({ id: "a", visits: [좌표없음, 남산] })]);
    expect(dots).toHaveLength(1);
    expect(dots[0].lat).toBe(남산.lat);
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

describe("groupByYear", () => {
  it("최근 해부터 쌓는다", () => {
    expect(groupByYear(ALL).map((y) => y.year)).toEqual([2026, 2025]);
  });

  it("한 해 안에서는 최근 여행이 위로", () => {
    const [올해] = groupByYear(ALL);
    expect(올해.trips.map((t) => t.id)).toEqual(["강릉", "남산"]);
  });

  it("여행이 없는 해는 나오지 않는다", () => {
    const years = groupByYear([
      trip({ id: "a", startedOn: "2020-05-01", endedOn: "2020-05-01" }),
      trip({ id: "b", startedOn: "2026-05-01", endedOn: "2026-05-01" }),
    ]);
    // 2021~2025 를 빈 장으로 끼워 넣지 않는다.
    expect(years.map((y) => y.year)).toEqual([2026, 2020]);
  });

  it("해를 넘긴 여행은 떠난 해로 친다", () => {
    const years = groupByYear([
      trip({ id: "해넘이", startedOn: "2025-12-31", endedOn: "2026-01-01" }),
    ]);
    expect(years).toHaveLength(1);
    expect(years[0].year).toBe(2025);
  });

  it("기록이 없으면 장도 없다", () => {
    expect(groupByYear([])).toEqual([]);
  });
});

describe("monthStrip", () => {
  const strip = monthStrip([
    trip({ id: "1", startedOn: "2026-09-13", endedOn: "2026-09-14" }),
    trip({ id: "2", startedOn: "2026-09-28", endedOn: "2026-09-28" }),
    trip({ id: "3", startedOn: "2026-03-02", endedOn: "2026-03-02" }),
  ]);

  it("열두 달이 빠짐없이 나온다 — 빈 달이 말해 주는 것이 있다", () => {
    expect(strip).toHaveLength(12);
    expect(strip.map((cell) => cell.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("그 달에 몇 번 다녔는지 센다", () => {
    expect(strip[8].tripCount).toBe(2);
    expect(strip[2].tripCount).toBe(1);
  });

  it("안 다닌 달은 색이 없다", () => {
    expect(strip[6].tripCount).toBe(0);
    expect(strip[6].season).toBeNull();
  });

  it("다닌 달은 그 달의 계절을 입는다", () => {
    expect(strip[8].season).toBe("가을");
    expect(strip[2].season).toBe("봄");
  });
});
