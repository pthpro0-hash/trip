// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  canMerge,
  dayBoundaries,
  groupIntoTrips,
  mergeAdjacentVisits,
  mergeTrips,
  splitTripAtDay,
  tripDays,
} from "./grouping";
import { buildTripTitle } from "./tripTitle";
import type { Shot, Visit } from "./types";

const 고성 = { lat: 38.4798, lng: 128.4391 };
const 강릉 = { lat: 37.7728, lng: 128.9474 };
const 송정 = { lat: 37.7863, lng: 128.9303 };

function shot(id: string, iso: string, at: { lat: number; lng: number }): Shot {
  return { id, takenAt: new Date(iso), ...at };
}

// 실제로 1박 2일이었던 여행 (09-13 고성 → 09-14 강릉)
const 강릉여행 = groupIntoTrips([
  shot("a", "2026-09-13T09:21", 고성),
  shot("b", "2026-09-13T09:27", 고성),
  shot("c", "2026-09-14T06:11", 강릉),
  shot("d", "2026-09-14T08:41", 송정),
])[0];

describe("dayBoundaries", () => {
  it("날이 바뀌는 지점의 거리와 시간을 잰다", () => {
    const [boundary] = dayBoundaries(강릉여행);
    expect(boundary.day).toBe("2026-09-14");
    expect(boundary.km).toBeGreaterThan(70);
    expect(boundary.hours).toBeGreaterThan(20);
  });

  it("멀리 떨어져 있으면 알 수 없다고 표시한다", () => {
    // 실제로 이 여행과 06-13→06-14 나들이는 데이터가 거의 같았다.
    expect(dayBoundaries(강릉여행)[0].uncertain).toBe(true);
  });

  it("근처에서 잤으면 알 수 없다고 하지 않는다", () => {
    const 한곳에서 = groupIntoTrips([
      shot("a", "2026-09-13T18:00", 강릉),
      shot("b", "2026-09-14T08:00", 송정),
    ])[0];
    expect(dayBoundaries(한곳에서)[0].uncertain).toBe(false);
  });

  it("하루짜리 여행에는 나눌 자리가 없다", () => {
    const 하루 = groupIntoTrips([shot("a", "2026-09-13T09:00", 고성)])[0];
    expect(dayBoundaries(하루)).toEqual([]);
  });
});

describe("splitTripAtDay", () => {
  it("그 날 앞에서 둘로 가른다", () => {
    const split = splitTripAtDay(강릉여행, "2026-09-14");
    expect(split).not.toBeNull();
    const [before, after] = split!;
    expect(tripDays(before)).toEqual(["2026-09-13"]);
    expect(tripDays(after)).toEqual(["2026-09-14"]);
    expect(before.shots.length + after.shots.length).toBe(강릉여행.shots.length);
  });

  it("나뉜 쪽도 방문이 다시 잡힌다", () => {
    const [, after] = splitTripAtDay(강릉여행, "2026-09-14")!;
    // 강릉과 송정은 2km 떨어져 있어 방문 둘이다.
    expect(after.visits).toHaveLength(2);
  });

  it("첫날에서는 나누지 않는다 — 한쪽이 비어 버린다", () => {
    expect(splitTripAtDay(강릉여행, "2026-09-13")).toBeNull();
  });

  it("없는 날에서는 나누지 않는다", () => {
    expect(splitTripAtDay(강릉여행, "2026-12-25")).toBeNull();
  });
});

describe("mergeTrips", () => {
  it("나눈 것을 되돌릴 수 있다", () => {
    const [before, after] = splitTripAtDay(강릉여행, "2026-09-14")!;
    const merged = mergeTrips(before, after);
    expect(merged.shots.map((s) => s.id)).toEqual(강릉여행.shots.map((s) => s.id));
    expect(tripDays(merged)).toEqual(tripDays(강릉여행));
  });

  it("순서가 뒤바뀌어 들어와도 시간순으로 정리한다", () => {
    const [before, after] = splitTripAtDay(강릉여행, "2026-09-14")!;
    const merged = mergeTrips(after, before);
    expect(merged.shots.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("canMerge", () => {
  const 나눈것 = splitTripAtDay(강릉여행, "2026-09-14")!;

  it("방금 나눈 것은 도로 합칠 수 있다", () => {
    expect(canMerge(나눈것[0], 나눈것[1])).toBe(true);
  });

  it("가운데 날에 사진이 없어도 합칠 수 있다", () => {
    const 앞 = groupIntoTrips([shot("a", "2026-09-13T18:00", 고성)])[0];
    const 뒤 = groupIntoTrips([shot("b", "2026-09-15T09:00", 강릉)])[0];
    expect(canMerge(앞, 뒤)).toBe(true);
  });

  it("한참 떨어진 여행에는 묻지 않는다", () => {
    const 앞 = groupIntoTrips([shot("a", "2026-06-13T18:00", 고성)])[0];
    expect(canMerge(앞, 강릉여행)).toBe(false);
  });

  it("순서가 뒤바뀌면 합치지 않는다", () => {
    expect(canMerge(나눈것[1], 나눈것[0])).toBe(false);
  });
});

describe("mergeAdjacentVisits", () => {
  const visit = (ids: string[]): Visit => ({
    shots: ids.map((id) => shot(id, "2026-08-22T10:00", 고성)),
  });

  it("같은 이름이 연달아 나오면 하나로 합친다", () => {
    const { visits, labels } = mergeAdjacentVisits(
      [visit(["a"]), visit(["b"]), visit(["c"])],
      ["매향리", "매향리", "궁평리해수욕장"],
    );
    expect(labels).toEqual(["매향리", "궁평리해수욕장"]);
    expect(visits[0].shots.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("사이에 다른 곳이 끼면 합치지 않는다 — 실제로 오갔다", () => {
    const { labels } = mergeAdjacentVisits(
      [visit(["a"]), visit(["b"]), visit(["c"])],
      ["궁평리해수욕장", "매향리", "궁평리해수욕장"],
    );
    expect(labels).toEqual(["궁평리해수욕장", "매향리", "궁평리해수욕장"]);
  });

  it("사진은 한 장도 잃지 않는다", () => {
    const { visits } = mergeAdjacentVisits(
      [visit(["a", "b"]), visit(["c"]), visit(["d"])],
      ["같은곳", "같은곳", "같은곳"],
    );
    expect(visits).toHaveLength(1);
    expect(visits[0].shots).toHaveLength(4);
  });

  it("빈 목록도 무너지지 않는다", () => {
    expect(mergeAdjacentVisits([], [])).toEqual({ visits: [], labels: [] });
  });
});

describe("buildTripTitle", () => {
  it("사진을 가장 많이 찍은 곳을 앞세운다", () => {
    // 가평에서 25장 중 20장을 송산리에서 찍었는데, 들른 차례로 쓰면
    // 1장뿐인 "큰섬"이 제목이 된다.
    expect(
      buildTripTitle([
        { label: "큰섬", photoCount: 1 },
        { label: "가평군 설악면 송산리", photoCount: 20 },
        { label: "가평군 설악면 사룡리", photoCount: 3 },
      ]),
    ).toBe("가평군 설악면 송산리 외 2곳");
  });

  it("한 곳뿐이면 그 이름만", () => {
    expect(buildTripTitle([{ label: "대천해수욕장", photoCount: 19 }])).toBe("대천해수욕장");
  });

  it("두 곳이면 가운뎃점으로 잇는다", () => {
    expect(
      buildTripTitle([
        { label: "솔뫼성지 역사관", photoCount: 11 },
        { label: "다블뤼기념관", photoCount: 15 },
      ]),
    ).toBe("다블뤼기념관·솔뫼성지 역사관");
  });

  it("같은 곳을 여러 번 들러도 한 곳으로 센다", () => {
    expect(
      buildTripTitle([
        { label: "궁평리해수욕장", photoCount: 4 },
        { label: "매향리", photoCount: 3 },
        { label: "궁평리해수욕장", photoCount: 1 },
      ]),
    ).toBe("궁평리해수욕장·매향리");
  });

  it("같은 수면 먼저 들른 곳을 앞세운다 — 매번 바뀌지 않게", () => {
    expect(
      buildTripTitle([
        { label: "먼저", photoCount: 5 },
        { label: "나중", photoCount: 5 },
      ]),
    ).toBe("먼저·나중");
  });

  it("이름이 없으면 빈 제목", () => {
    expect(buildTripTitle([])).toBe("");
    expect(buildTripTitle([{ label: "  ", photoCount: 3 }])).toBe("");
  });
});
