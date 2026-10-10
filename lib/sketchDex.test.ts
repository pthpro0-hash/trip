// @vitest-environment node
import { describe, it, expect } from "vitest";
import { SIDO } from "./sido";
import { SIDO_NAMES, buildDex } from "./sketchDex";
import type { SketchTrip, SketchVisit } from "./sketch";

/* 도감 — 밟은 시도와 다녀온 100선을 칸으로. 시도는 좌표·동으로 가리는 셈을 받아 쓴다(시험에서는 좌표 위도로 갈음). */
const sidoOf = (visit: SketchVisit) => (visit.lat > 37.4 ? "서울" : visit.lat > 35 ? "경북" : visit.lat > 33 ? "제주" : null);
const visit = (placeName: string, lat: number, spotId: string | null = null): SketchVisit => ({ placeName, spotId, lat, lng: 127, photoCount: 3 });
const trip = (id: string, ...visits: SketchVisit[]): SketchTrip => ({ id, startedOn: "2026-05-01", endedOn: "2026-05-01", companions: null, visits });
const spots = [
  { id: "경복궁", name: "경복궁", lat: 37.58, lng: 126.97 },
  { id: "북촌", name: "북촌", lat: 37.58, lng: 126.98 },
  { id: "불국사", name: "불국사", lat: 35.79, lng: 129.33 },
  { id: "바다", name: "바다", lat: 20, lng: 100 },
];
const names = ["서울", "경북", "제주"];

describe("SIDO_NAMES", () => {
  it("경계 데이터의 시도 이름과 같다", () => {
    expect([...SIDO_NAMES].sort()).toEqual(SIDO.map((sido) => sido.name).sort());
  });
});

describe("buildDex · 내 도감", () => {
  it("기록이 없으면 모두 빈칸이다", () => {
    const dex = buildDex([], spots, names, sidoOf);
    expect(dex.sidoDone).toBe(0);
    expect(dex.spotDone).toBe(0);
    expect(dex.spotTotal).toBe(3);
  });

  it("밟은 시도에 도장을 찍는다 — 해가 달라도 모든 여행에서", () => {
    const dex = buildDex([trip("a", visit("어딘가", 37.5)), trip("b", visit("어딘가", 33.4))], spots, names, sidoOf);
    expect(dex.sidos.map((s) => [s.name, s.visited])).toEqual([["서울", true], ["경북", false], ["제주", true]]);
    expect(dex.sidoDone).toBe(2);
  });

  it("다녀온 100선은 방문에 붙은 spotId 로 알고, 시도별로 묶는다", () => {
    const dex = buildDex([trip("a", visit("경복궁", 37.58, "경복궁"))], spots, names, sidoOf);
    expect(dex.sidos[0].spots).toEqual([{ id: "경복궁", name: "경복궁", done: true }, { id: "북촌", name: "북촌", done: false }]);
    expect(dex.spotDone).toBe(1);
  });

  it("시도를 가릴 수 없는 곳은 칸에 넣지 않는다", () => {
    const dex = buildDex([], spots, names, sidoOf);
    expect(dex.sidos.flatMap((s) => s.spots).map((s) => s.id)).not.toContain("바다");
  });
});
