import { describe, it, expect } from "vitest";
import { groupIntoTrips } from "./grouping";
import { addShots, groupByDay, isDayKey, removeShots, shotsFor } from "./unlocated";
import type { Shot } from "./types";

/*
  위치를 모르는 사진: 찍은 날로 묶고, 사람이 정한 날짜와 장소로 평소 사진(Shot)처럼 만들어 여행에 끼운다.
*/
const at = (iso: string) => new Date(iso);
const photo = (id: string, iso: string, guessed = false) => ({ id, takenAt: at(iso), guessed });
const shot = (id: string, iso: string, lat = 37.57, lng = 126.98): Shot => ({ id, takenAt: at(iso), lat, lng });
const 경복궁 = { lat: 37.5796, lng: 126.977 };

describe("groupByDay", () => {
  it("찍은 날(벽시계)로 묶고 날짜순·찍은 순으로 놓는다", () => {
    const groups = groupByDay([
      photo("c.jpg", "2026-09-14T09:00:00"),
      photo("a.jpg", "2026-09-13T23:50:00"),
      photo("b.jpg", "2026-09-13T08:00:00"),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2026-09-13", "2026-09-14"]);
    expect(groups[0].photos.map((p) => p.id)).toEqual(["b.jpg", "a.jpg"]);
  });

  it("한 장이라도 날짜를 어림한 것이면 그 묶음은 어림한 것으로 표시한다", () => {
    const [group] = groupByDay([photo("a.jpg", "2026-09-13T08:00:00"), photo("b.jpg", "2026-09-13T09:00:00", true)]);
    expect(group.guessed).toBe(true);
    expect(groupByDay([photo("a.jpg", "2026-09-13T08:00:00")])[0].guessed).toBe(false);
  });

  it("날짜를 읽을 수 없는 것이 섞여 있어도 터지지 않고 나머지만 묶는다", () => {
    const groups = groupByDay([
      { id: "ok.jpg", takenAt: at("2026-09-13T08:00:00") },
      { id: "str.jpg", takenAt: "," as unknown as Date },
      { id: "nan.jpg", takenAt: new Date(Number.NaN) },
    ]);
    expect(groups.map((group) => group.photos.map((p) => p.id))).toEqual([["ok.jpg"]]);
  });

  it("사진이 없으면 묶음도 없다", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("isDayKey", () => {
  it("달력에 있는 날만 받는다", () => {
    expect(isDayKey("2026-09-13")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-9-3")).toBe(false);
    expect(isDayKey("")).toBe(false);
  });
});

describe("shotsFor", () => {
  const [group] = groupByDay([photo("a.jpg", "2026-09-13T08:15:30"), photo("b.jpg", "2026-09-13T21:05:00")]);

  it("정한 장소의 좌표를 붙이고 시각은 그대로 둔다", () => {
    const shots = shotsFor(group, "2026-09-13", 경복궁);
    expect(shots.map((s) => [s.id, s.lat, s.lng])).toEqual([
      ["a.jpg", 경복궁.lat, 경복궁.lng],
      ["b.jpg", 경복궁.lat, 경복궁.lng],
    ]);
    expect(shots[0].takenAt.getTime()).toBe(at("2026-09-13T08:15:30").getTime());
  });

  it("날짜를 바꾸면 날짜만 옮기고 시·분·초와 차례는 유지한다", () => {
    const shots = shotsFor(group, "2026-10-02", 경복궁);
    expect(shots[0].takenAt.getTime()).toBe(at("2026-10-02T08:15:30").getTime());
    expect(shots[1].takenAt.getTime()).toBe(at("2026-10-02T21:05:00").getTime());
  });
});

describe("addShots · removeShots", () => {
  it("이어지는 날짜의 여행이 없으면 새 여행으로 날짜순 자리에 끼운다", () => {
    const trips = groupIntoTrips([shot("a", "2026-06-13T09:00:00"), shot("z", "2026-11-01T09:00:00")]);
    const next = addShots(trips, [shot("m", "2026-09-14T09:00:00", 경복궁.lat, 경복궁.lng)]);
    expect(next.map((trip) => trip.shots[0].id)).toEqual(["a", "m", "z"]);
  });

  it("날짜가 겹치거나 이어지는 여행이 있으면 그 여행에 합친다 — 다른 곳은 다른 방문으로 남는다", () => {
    const trips = groupIntoTrips([
      shot("a", "2026-09-13T09:00:00", 38.2, 128.5),
      shot("b", "2026-09-14T09:00:00", 38.2, 128.5),
      shot("c", "2026-09-15T09:00:00", 38.2, 128.5),
    ]);
    // 여행 한가운데(14일) 하루만 있는 묶음도 합쳐진다.
    const next = addShots(trips, [shot("m", "2026-09-14T12:00:00", 경복궁.lat, 경복궁.lng)]);
    expect(next).toHaveLength(1);
    expect(next[0].shots.map((s) => s.id)).toEqual(["a", "b", "m", "c"]);
    expect(next[0].visits.length).toBeGreaterThan(1);
  });

  it("빼면 남은 사진으로 여행을 다시 짓고, 하나도 안 남으면 여행을 없앤다", () => {
    const trips = addShots(groupIntoTrips([shot("a", "2026-09-13T09:00:00", 38.2, 128.5)]), [
      shot("m1", "2026-09-13T12:00:00", 경복궁.lat, 경복궁.lng),
    ]);
    const only = removeShots(trips, new Set(["m1"]));
    expect(only).toHaveLength(1);
    expect(only[0].shots.map((s) => s.id)).toEqual(["a"]);

    const none = removeShots(only, new Set(["a"]));
    expect(none).toEqual([]);
  });

  it("관계없는 여행은 건드리지 않는다", () => {
    const trips = groupIntoTrips([shot("a", "2026-06-13T09:00:00"), shot("z", "2026-11-01T09:00:00")]);
    const next = removeShots(trips, new Set(["nope"]));
    expect(next).toEqual(trips);
    expect(next[0]).toBe(trips[0]);
  });
});
