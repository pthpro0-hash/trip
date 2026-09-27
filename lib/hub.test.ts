import { describe, it, expect } from "vitest";
import {
  groupPins,
  hubPlaces,
  inseparable,
  placesIn,
  tripLabel,
  tripsIn,
  type HubTripInput,
} from "./hub";

const 강릉여행: HubTripInput = {
  id: "t1",
  title: "민수랑 첫 휴가",
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  visits: [
    { id: "v2", placeName: "안목해변", lat: 37.77, lng: 128.95, startedAt: "2026-09-14 06:11:00", photoCount: 18 },
    { id: "v1", placeName: "화진포해변", lat: 38.48, lng: 128.44, startedAt: "2026-09-13 09:21:00", photoCount: 4 },
  ],
};

const 대천여행: HubTripInput = {
  id: "t2",
  title: null,
  startedOn: "2025-07-25",
  endedOn: "2025-07-25",
  visits: [
    { id: "v3", placeName: "대천해수욕장", lat: 36.3, lng: 126.5, startedAt: "2025-07-25 13:00:00", photoCount: 6 },
  ],
};

describe("hubPlaces", () => {
  it("방문 하나가 지도의 한 곳이 되고 대표 사진이 붙는다", () => {
    const places = hubPlaces([강릉여행], new Map([["v2", "나/v2/a.webp"]]));

    expect(places).toHaveLength(2);
    expect(places.find((p) => p.visitId === "v2")?.coverPath).toBe("나/v2/a.webp");
    // 사진을 올리지 않은 방문은 사진 없이 선다.
    expect(places.find((p) => p.visitId === "v1")?.coverPath).toBeNull();
  });

  it("좌표가 없는 방문은 얹지 않는다", () => {
    const 좌표없음: HubTripInput = {
      ...대천여행,
      visits: [{ ...대천여행.visits[0], lat: Number.NaN }],
    };
    expect(hubPlaces([좌표없음], new Map())).toHaveLength(0);
  });
});

describe("tripLabel", () => {
  it("이름이 있으면 이름", () => {
    expect(tripLabel(강릉여행)).toBe("민수랑 첫 휴가");
  });

  it("이름이 없으면 날짜로 부른다", () => {
    expect(tripLabel(대천여행)).toBe("2025.07.25");
    expect(tripLabel({ title: null, startedOn: "2026-09-13", endedOn: "2026-09-14" })).toBe(
      "2026.09.13 ~ 09.14",
    );
  });
});

describe("placesIn · tripsIn", () => {
  const places = hubPlaces([강릉여행, 대천여행], new Map());
  const 강원만 = { south: 37, west: 128, north: 39, east: 129.5 };
  const startedOn = (id: string) => (id === "t1" ? 강릉여행.startedOn : 대천여행.startedOn);

  it("화면 안의 곳만 남긴다", () => {
    expect(placesIn(places, 강원만).map((p) => p.placeName).sort()).toEqual([
      "안목해변",
      "화진포해변",
    ]);
  });

  it("화면 안의 곳을 여행으로 묶고, 들른 순서대로 늘어놓는다", () => {
    const trips = tripsIn(placesIn(places, 강원만), startedOn);

    expect(trips).toHaveLength(1);
    expect(trips[0].label).toBe("민수랑 첫 휴가");
    // 화진포(13일)를 먼저 들렀다.
    expect(trips[0].places.map((p) => p.placeName)).toEqual(["화진포해변", "안목해변"]);
    expect(trips[0].photoCount).toBe(22);
  });

  it("새 여행부터 늘어놓는다", () => {
    const 전국 = { south: 33, west: 124, north: 39, east: 132 };
    expect(tripsIn(placesIn(places, 전국), startedOn).map((t) => t.tripId)).toEqual(["t1", "t2"]);
  });
});

describe("groupPins", () => {
  it("겹치는 핀을 묶고, 사진이 가장 많은 곳이 얼굴이 된다", () => {
    const groups = groupPins(
      [
        { id: "작은곳", x: 100, y: 100, weight: 2 },
        { id: "큰곳", x: 110, y: 105, weight: 30 },
        { id: "먼곳", x: 300, y: 300, weight: 5 },
      ],
      48,
    );

    expect(groups).toHaveLength(2);
    const 무리 = groups.find((g) => g.ids.length === 2)!;
    expect(무리.lead).toBe("큰곳");
    expect(무리.weight).toBe(32);
    // 무리는 얼굴이 있는 자리에 선다. 가운데로 옮기면 아무도 안 간 곳에 뜬다.
    expect([무리.x, 무리.y]).toEqual([110, 105]);
  });

  it("떨어져 있으면 묶지 않는다", () => {
    const groups = groupPins(
      [
        { id: "a", x: 0, y: 0, weight: 1 },
        { id: "b", x: 100, y: 0, weight: 1 },
      ],
      48,
    );
    expect(groups).toHaveLength(2);
  });

  it("같은 입력이면 늘 같은 무리가 된다 — 확대할 때마다 얼굴이 바뀌지 않게", () => {
    const pins = [
      { id: "b", x: 0, y: 0, weight: 3 },
      { id: "a", x: 5, y: 5, weight: 3 },
    ];
    expect(groupPins(pins, 48)).toEqual(groupPins([...pins].reverse(), 48));
  });
});

describe("inseparable", () => {
  it("같은 곳에 두 번 간 것은 끝까지 당겨도 갈라지지 않는다", () => {
    expect(
      inseparable([
        { lat: 37.7728, lng: 128.9474 },
        { lat: 37.7729, lng: 128.9475 },
      ]),
    ).toBe(true);
  });

  it("몇 백 m 떨어졌으면 당기면 갈라진다", () => {
    expect(
      inseparable([
        { lat: 37.7728, lng: 128.9474 },
        { lat: 37.7863, lng: 128.9303 },
      ]),
    ).toBe(false);
  });
});
