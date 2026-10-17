import { describe, it, expect } from "vitest";
import { groupIntoTrips } from "./grouping";
import { addShots, groupByDay, isDayKey, removeShots, shotsByDay, shotsFor, snapToDay } from "./unlocated";
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

/*
  단체 카톡방에서 받은 사진과 내가 찍은 사진을 함께 올리면, 같은 날의 위치 모르는 사진은 내 사진이 찍힌 곳에 맞춰 넣는다.
  찾아서 넣은 좌표와 찍힌 좌표가 조금 어긋나 같은 곳이 두 곳이 되던 문제를 없앤다.
*/
describe("shotsByDay · 같은 날 사진의 자리에 맞춰 넣기", () => {
  const 선산 = { lat: 37.3721, lng: 127.3102 };
  const 식당 = { lat: 37.4102, lng: 127.2801 }; // 선산에서 4km 남짓
  const group = (items: { id: string; iso: string; guessed?: boolean }[]) => groupByDay(items.map((i) => photo(i.id, i.iso, i.guessed)))[0];

  it("그날 위치 있는 사진이 없으면 null — 사람이 정해야 한다", () => {
    expect(shotsByDay(group([{ id: "k", iso: "2026-10-04T10:00:00" }]), "2026-10-04", [shot("a", "2026-10-05T10:00:00")])).toBeNull();
    expect(shotsByDay(group([{ id: "k", iso: "2026-10-04T10:00:00" }]), "2026-10-04", [])).toBeNull();
  });

  it("그날 한 곳에서만 찍었으면 그 곳의 좌표를 그대로 쓴다 — 시각은 그대로", () => {
    const located = [shot("a", "2026-10-04T11:20:00", 선산.lat, 선산.lng), shot("b", "2026-10-04T11:29:00", 선산.lat + 0.0003, 선산.lng)];
    const shots = shotsByDay(group([{ id: "k1", iso: "2026-10-04T11:25:00" }, { id: "k2", iso: "2026-10-04T18:00:00" }]), "2026-10-04", located)!;
    expect(shots.map((s) => [s.id, s.lat, s.lng])).toEqual([
      ["k1", 선산.lat, 선산.lng],
      ["k2", 선산.lat, 선산.lng],
    ]);
    expect(shots[0].takenAt.getTime()).toBe(at("2026-10-04T11:25:00").getTime());
  });

  it("여러 곳이면 시각이 가장 가까운 사진의 곳에 넣는다", () => {
    const located = [shot("a", "2026-10-04T11:20:00", 선산.lat, 선산.lng), shot("r", "2026-10-04T13:00:00", 식당.lat, 식당.lng)];
    const shots = shotsByDay(group([{ id: "k1", iso: "2026-10-04T11:40:00" }, { id: "k2", iso: "2026-10-04T12:45:00" }]), "2026-10-04", located)!;
    expect(shots.map((s) => [s.id, s.lat])).toEqual([["k1", 선산.lat], ["k2", 식당.lat]]);
  });

  it("시각을 어림한 사진은 그날 사진이 가장 많은 곳의 마지막 사진 시각에 붙인다 — 방문이 갈라지지 않게", () => {
    const located = [
      shot("a", "2026-10-04T11:20:00", 선산.lat, 선산.lng),
      shot("b", "2026-10-04T11:25:00", 선산.lat, 선산.lng),
      shot("c", "2026-10-04T11:29:00", 선산.lat, 선산.lng),
      shot("r", "2026-10-04T13:00:00", 식당.lat, 식당.lng),
    ];
    const shots = shotsByDay(group([{ id: "k", iso: "2026-10-04T21:40:00", guessed: true }]), "2026-10-04", located)!;
    expect([shots[0].lat, shots[0].lng]).toEqual([선산.lat, 선산.lng]);
    expect(shots[0].takenAt.getTime()).toBe(at("2026-10-04T11:29:00").getTime());
  });

  it("합치고 나면 같은 곳이 한 방문이다 — 내 사진과 받은 사진이 두 곳으로 갈라지지 않는다", () => {
    const located = [shot("a", "2026-10-04T11:20:00", 선산.lat, 선산.lng), shot("b", "2026-10-04T12:16:00", 선산.lat + 0.001, 선산.lng)];
    const trips = groupIntoTrips(located);
    const fresh = shotsByDay(group([{ id: "k1", iso: "2026-10-04T11:50:00" }]), "2026-10-04", located)!;
    const merged = addShots(trips, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].visits).toHaveLength(1);
    expect(merged[0].visits[0].shots.map((s) => s.id)).toEqual(["a", "k1", "b"]);
  });

  it("날짜를 옮긴 묶음은 그 날짜의 위치 있는 사진에 맞춘다", () => {
    const located = [shot("a", "2026-10-11T10:00:00", 선산.lat, 선산.lng)];
    const shots = shotsByDay(group([{ id: "k", iso: "2026-10-04T10:30:00" }]), "2026-10-11", located)!;
    expect(shots[0].takenAt.getTime()).toBe(at("2026-10-11T10:30:00").getTime());
    expect(shots[0].lat).toBe(선산.lat);
  });
});

describe("snapToDay · 찾아서 고른 장소를 같은 날 사진의 자리에 맞추기", () => {
  const 선산 = { lat: 37.3721, lng: 127.3102 };
  const located = [shot("a", "2026-10-04T11:20:00", 선산.lat, 선산.lng)];

  it("그날 사진이 3km 안에 있으면 그 사진의 좌표로 맞춘다", () => {
    const snapped = snapToDay({ lat: 37.3799, lng: 127.3102 }, "2026-10-04", located);
    expect(snapped?.id).toBe("a");
  });

  it("멀리 있거나(3km 넘게) 다른 날 사진이면 맞추지 않는다", () => {
    expect(snapToDay({ lat: 37.5, lng: 127.3102 }, "2026-10-04", located)).toBeNull();
    expect(snapToDay({ lat: 37.3721, lng: 127.3102 }, "2026-10-05", located)).toBeNull();
  });

  it("여럿이면 가장 가까운 사진", () => {
    const more = [...located, shot("b", "2026-10-04T12:00:00", 37.3731, 127.3102)];
    expect(snapToDay({ lat: 37.3732, lng: 127.3102 }, "2026-10-04", more)?.id).toBe("b");
  });
});
