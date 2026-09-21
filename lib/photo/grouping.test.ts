// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  dayIndex,
  dayKey,
  findLivingArea,
  groupIntoTrips,
  splitIntoVisits,
  tripDays,
} from "./grouping";
import type { Shot } from "./types";

// 실제 아이폰 사진 49장으로 검증한 값들이다. 좌표와 시각은 그때 것을 그대로 쓴다.
const 고성_화진포 = { lat: 38.4798, lng: 128.4391 };
const 강릉_안목 = { lat: 37.7728, lng: 128.9474 };
const 강릉_송정 = { lat: 37.7863, lng: 128.9303 };
const 서울_생활권 = { lat: 37.4987, lng: 127.0496 };
const 당진 = { lat: 36.7621, lng: 126.7721 };

function shot(id: string, iso: string, at: { lat: number; lng: number }): Shot {
  return { id, takenAt: new Date(iso), ...at };
}

describe("dayKey", () => {
  it("벽시계 기준으로 자른다 — UTC로 바꾸면 오전 사진이 전날로 밀린다", () => {
    // 오전 8시를 UTC로 옮기면 전날 23시가 되어 하루 나들이가 이틀로 쪼개졌다.
    expect(dayKey(new Date(2026, 6, 25, 8, 16))).toBe("2026-07-25");
    expect(dayKey(new Date(2026, 6, 25, 9, 7))).toBe("2026-07-25");
  });

  it("자정 직전과 직후는 다른 날", () => {
    expect(dayKey(new Date(2026, 8, 13, 23, 59))).toBe("2026-09-13");
    expect(dayKey(new Date(2026, 8, 14, 0, 1))).toBe("2026-09-14");
  });
});

describe("dayIndex", () => {
  it("이어진 날은 1 차이", () => {
    const a = dayIndex(new Date(2026, 8, 13, 9, 27));
    const b = dayIndex(new Date(2026, 8, 14, 6, 11));
    expect(b - a).toBe(1);
  });

  it("같은 날은 시각이 달라도 0 차이", () => {
    const a = dayIndex(new Date(2026, 8, 14, 6, 11));
    const b = dayIndex(new Date(2026, 8, 14, 8, 44));
    expect(b - a).toBe(0);
  });
});

describe("findLivingArea", () => {
  it("사진이 많은 곳이 아니라 여러 날 되풀이된 곳을 고른다", () => {
    const shots = [
      // 집: 사진은 4장뿐이지만 서로 다른 4일에 걸쳐 있다
      shot("h1", "2026-07-12T10:00", 서울_생활권),
      shot("h2", "2026-07-20T10:00", 서울_생활권),
      shot("h3", "2026-07-28T10:00", 서울_생활권),
      shot("h4", "2026-08-06T10:00", 서울_생활권),
      // 여행지: 사진은 8장이지만 하루뿐이다
      ...Array.from({ length: 8 }, (_, i) =>
        shot(`t${i}`, `2026-09-05T09:${String(48 + i).padStart(2, "0")}`, 당진),
      ),
    ];

    const home = findLivingArea(shots);
    expect(home).not.toBeNull();
    expect(home!.dayCount).toBe(4);
    expect(home!.shots).toHaveLength(4);
    expect(home!.lat).toBeCloseTo(서울_생활권.lat, 3);
  });

  it("하루만 찍힌 곳은 생활권이 아니다 — 여행만 담긴 더미에서 집을 만들어내지 않는다", () => {
    const shots = [
      shot("a", "2026-07-25T08:16", { lat: 36.3094, lng: 126.5141 }),
      shot("b", "2026-08-29T08:42", { lat: 37.16, lng: 128.084 }),
      shot("c", "2026-09-05T09:48", 당진),
    ];
    expect(findLivingArea(shots)).toBeNull();
  });

  it("사진이 없으면 null", () => {
    expect(findLivingArea([])).toBeNull();
  });
});

describe("groupIntoTrips", () => {
  it("1박 2일을 한 여행으로 묶는다 — 스무 시간이 비고 90km를 옮겨도", () => {
    const trips = groupIntoTrips([
      shot("a", "2026-09-13T09:21", 고성_화진포),
      shot("b", "2026-09-13T09:27", 고성_화진포),
      shot("c", "2026-09-14T06:11", 강릉_안목),
      shot("d", "2026-09-14T08:41", 강릉_송정),
    ]);

    expect(trips).toHaveLength(1);
    expect(tripDays(trips[0])).toEqual(["2026-09-13", "2026-09-14"]);
  });

  it("하루 넘게 비면 다른 여행", () => {
    const trips = groupIntoTrips([
      shot("a", "2026-09-08T19:12", { lat: 37.5548, lng: 126.9797 }),
      shot("b", "2026-09-13T09:21", 고성_화진포),
    ]);
    expect(trips).toHaveLength(2);
  });

  it("한 여행 안에서 장소가 바뀌면 방문을 나눈다", () => {
    const [trip] = groupIntoTrips([
      shot("a", "2026-09-13T09:21", 고성_화진포),
      shot("b", "2026-09-14T06:11", 강릉_안목),
      shot("c", "2026-09-14T08:41", 강릉_송정),
    ]);
    expect(trip.visits).toHaveLength(3);
  });

  it("순서가 뒤섞여 들어와도 시간순으로 정리한다", () => {
    const trips = groupIntoTrips([
      shot("c", "2026-09-14T08:41", 강릉_송정),
      shot("a", "2026-09-13T09:21", 고성_화진포),
      shot("b", "2026-09-14T06:11", 강릉_안목),
    ]);
    expect(trips).toHaveLength(1);
    expect(trips[0].shots.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const input = [
      shot("c", "2026-09-14T08:41", 강릉_송정),
      shot("a", "2026-09-13T09:21", 고성_화진포),
    ];
    groupIntoTrips(input);
    expect(input.map((s) => s.id)).toEqual(["c", "a"]);
  });

  it("사진이 없으면 여행도 없다", () => {
    expect(groupIntoTrips([])).toEqual([]);
  });
});

describe("splitIntoVisits", () => {
  it("같은 자리에서 연속으로 찍은 것은 한 방문", () => {
    const visits = splitIntoVisits([
      shot("a", "2026-07-25T08:16", { lat: 36.3094, lng: 126.5141 }),
      shot("b", "2026-07-25T08:17", { lat: 36.3096, lng: 126.5141 }),
      shot("c", "2026-07-25T09:07", { lat: 36.3097, lng: 126.5131 }),
    ]);
    expect(visits).toHaveLength(1);
    expect(visits[0].shots).toHaveLength(3);
  });

  it("2km를 옮기면 다른 방문", () => {
    const visits = splitIntoVisits([
      shot("a", "2026-09-14T06:11", 강릉_안목),
      shot("b", "2026-09-14T08:41", 강릉_송정),
    ]);
    expect(visits).toHaveLength(2);
  });
});
