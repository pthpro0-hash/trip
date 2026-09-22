// @vitest-environment node
import { describe, it, expect } from "vitest";
import { KOREA_FULL_VIEWBOX, project } from "@/lib/koreaMap";
import { regionViewBox } from "./regionView";

const FRAME = { width: 290, height: 450 };

/** 그 틀 안에 들어오는가. */
function holds(box: { x: number; y: number; width: number; height: number }, lat: number, lng: number) {
  const p = project(lat, lng);
  return p.x >= box.x && p.x <= box.x + box.width && p.y >= box.y && p.y <= box.y + box.height;
}

const 강릉 = { lat: 37.7728, lng: 128.9474 };
const 제주 = { lat: 33.458, lng: 126.94 };

describe("regionViewBox", () => {
  it("권역을 고르지 않았으면 늘 보던 전국 그대로", () => {
    expect(regionViewBox(null, [강릉], FRAME)).toEqual(KOREA_FULL_VIEWBOX);
  });

  it("권역을 고르면 전국보다 좁게 당긴다", () => {
    const box = regionViewBox("제주권", [제주], FRAME);
    expect(box.width).toBeLessThan(KOREA_FULL_VIEWBOX.width);
    expect(box.height).toBeLessThan(KOREA_FULL_VIEWBOX.height);
  });

  it("고른 권역이 틀 안에 들어온다", () => {
    const box = regionViewBox("강원권", [], FRAME);
    expect(holds(box, 강릉.lat, 강릉.lng)).toBe(true);
    // 고성(북쪽 끝)과 영월(남쪽) 둘 다.
    expect(holds(box, 38.38, 128.47)).toBe(true);
    expect(holds(box, 37.18, 128.46)).toBe(true);
  });

  it("내 눈대중이 빗나가도 다녀온 곳은 반드시 담는다", () => {
    // 제주권 네모 밖에 있는 점을 일부러 넣는다 (마라도 남쪽 바다).
    const 밖 = { lat: 32.9, lng: 126.2 };
    const box = regionViewBox("제주권", [밖], FRAME);
    expect(holds(box, 밖.lat, 밖.lng)).toBe(true);
  });

  it("지도가 찌그러지지 않게 화면 비율을 맞춘다", () => {
    const box = regionViewBox("경상권", [], FRAME);
    expect(box.width / box.height).toBeCloseTo(FRAME.width / FRAME.height, 5);
  });

  it("비율을 맞출 때 담아야 할 것을 잘라내지 않는다", () => {
    // 가로로 납작한 권역을 세로 틀에 넣어도 양 끝이 살아 있어야 한다.
    const box = regionViewBox("제주권", [], FRAME);
    expect(holds(box, 33.2, 126.15)).toBe(true);
    expect(holds(box, 33.55, 126.95)).toBe(true);
  });

  it("좌표를 모르는 점이 섞여도 틀을 망가뜨리지 않는다", () => {
    const box = regionViewBox("강원권", [{ lat: Number.NaN, lng: Number.NaN }], FRAME);
    expect(Number.isFinite(box.x)).toBe(true);
    expect(Number.isFinite(box.width)).toBe(true);
    expect(box.width).toBeGreaterThan(0);
  });

  it("권역마다 서로 다른 곳을 비춘다", () => {
    const 수도 = regionViewBox("수도권", [], FRAME);
    const 제 = regionViewBox("제주권", [], FRAME);
    // 제주는 한참 남쪽이다 (y 가 클수록 남쪽).
    expect(제.y).toBeGreaterThan(수도.y);
  });
});
