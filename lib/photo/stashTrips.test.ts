// @vitest-environment node
import { describe, it, expect } from "vitest";
import { groupIntoTrips } from "./grouping";
import { fromStashed, shotsOf, toStashed } from "./stashTrips";
import type { Shot, Trip } from "./types";

/*
  로그인하러 떠나기 전에 찾은 여행을 이 브라우저 저장소에 적어 두고, 로그인하고 돌아와 되살린다. 되살린 여행이 떠날 때와 같아야
  카드(제목 · 기간 · 곳)가 그대로 나오고 기록도 같은 모양으로 남는다. 그 변환(저장 가능한 글자 모양 ↔ 여행)을 못 박는다.
*/

const shot = (id: string, at: string, lat: number, lng: number): Shot => ({ id, takenAt: new Date(at), lat, lng });

/** 대관령에서 둘, 안목해변에서 둘, 다음 날 송정에서 하나 — 한 여행, 세 방문. */
function sample(): Trip[] {
  return groupIntoTrips([
    shot("a.jpg", "2026-09-13T09:21:00", 37.684, 128.754),
    shot("b.jpg", "2026-09-13T09:50:00", 37.684, 128.754),
    shot("c.jpg", "2026-09-14T06:11:00", 37.7728, 128.9474),
    shot("d.jpg", "2026-09-14T07:30:00", 37.7728, 128.9474),
    shot("e.jpg", "2026-09-14T10:02:00", 37.7863, 128.9303),
    // 한 달 뒤, 다른 여행
    shot("f.jpg", "2026-10-11T12:00:00", 35.1587, 129.1604),
  ]);
}

describe("toStashed · fromStashed — 여행을 적었다가 되살린다", () => {
  it("되살린 여행은 떠날 때와 같다 — 사진 · 방문 · 차례", () => {
    const trips = sample();
    expect(trips).toHaveLength(2);
    const back = fromStashed(toStashed(trips));
    expect(back).toEqual(trips);
  });

  it("글자만으로 되어 있다 — JSON 으로 오가도 같다(저장소는 글자로 보관한다)", () => {
    const trips = sample();
    const text = JSON.stringify(toStashed(trips));
    expect(fromStashed(JSON.parse(text))).toEqual(trips);
  });

  it("촬영 시각은 벽시계 그대로다 — 하루가 밀리지 않는다", () => {
    const [first] = fromStashed(JSON.parse(JSON.stringify(toStashed(sample()))));
    const taken = first.shots[0].takenAt;
    expect([taken.getFullYear(), taken.getMonth() + 1, taken.getDate(), taken.getHours(), taken.getMinutes()]).toEqual([2026, 9, 13, 9, 21]);
  });

  // 여행의 열쇠가 첫 사진의 id 다(PhotoImport 의 tripKey). 되살려도 첫 사진이 그대로 맨 앞이어야 적어 둔 제목·동행이 제 여행을 찾는다.
  it("첫 사진이 맨 앞에 남는다 — 제목·동행을 찾는 열쇠", () => {
    const back = fromStashed(toStashed(sample()));
    expect(back.map((trip) => trip.shots[0].id)).toEqual(["a.jpg", "f.jpg"]);
  });

  it("방문의 사진은 여행의 사진과 같은 것이다 — 따로 복사본이 생기지 않는다", () => {
    const [trip] = fromStashed(toStashed(sample()));
    for (const visit of trip.visits) {
      for (const member of visit.shots) expect(trip.shots).toContain(member);
    }
  });

  it("방문 수와 방문별 사진 수가 같다", () => {
    const [trip] = fromStashed(toStashed(sample()));
    expect(trip.visits.map((visit) => visit.shots.map((member) => member.id))).toEqual([["a.jpg", "b.jpg"], ["c.jpg", "d.jpg"], ["e.jpg"]]);
  });

  it("여행이 없으면 빈 목록", () => {
    expect(toStashed([])).toEqual([]);
    expect(fromStashed([])).toEqual([]);
  });

  // 화면은 모든 방문에 첫 사진이 있다고 보고 그린다. 깨진 기록 하나가 화면 전체를 깨지 않게 되살릴 때 거른다.
  describe("깨진 기록은 되살리지 않는다", () => {
    const stamp = (id: string) => ({ id, takenAt: 1_790_000_000_000, lat: 37.7, lng: 128.9 });

    it("사진이 하나도 없는 방문은 버린다 — 나머지 방문은 그대로", () => {
      const [trip] = fromStashed([{ shots: [stamp("a.jpg"), stamp("b.jpg")], visits: [["a.jpg"], ["gone.jpg"], ["b.jpg"]] }]);
      expect(trip.visits.map((visit) => visit.shots.map((member) => member.id))).toEqual([["a.jpg"], ["b.jpg"]]);
    });

    it("방문이 모두 비었거나 사진이 없는 여행은 통째로 버린다 — 멀쩡한 여행은 남는다", () => {
      const back = fromStashed([
        { shots: [stamp("a.jpg")], visits: [["gone.jpg"]] },
        { shots: [], visits: [] },
        { shots: [stamp("c.jpg")], visits: [["c.jpg"]] },
      ]);
      expect(back).toHaveLength(1);
      expect(back[0].shots.map((member) => member.id)).toEqual(["c.jpg"]);
    });
  });
});

describe("shotsOf · 사진이 실제로 올라갈 사진들", () => {
  it("방문에 든 사진을 차례로, 같은 사진은 한 번만", () => {
    expect(shotsOf(sample()).map((member) => member.id)).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"]);
  });

  it("여러 여행에 같은 이름의 사진이 있어도 한 번만 센다(이름이 열쇠라서)", () => {
    const twin = shot("a.jpg", "2026-12-01T10:00:00", 36, 128);
    const trips: Trip[] = [...sample(), { shots: [twin], visits: [{ shots: [twin] }] }];
    expect(shotsOf(trips).filter((member) => member.id === "a.jpg")).toHaveLength(1);
  });
});
