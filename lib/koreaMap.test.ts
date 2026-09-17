import { describe, it, expect } from "vitest";
import {
  KOREA_LAND_PATHS,
  computeViewBox,
  project,
  spreadPoints,
  toViewBoxPercent,
} from "./koreaMap";

describe("project", () => {
  it("북쪽일수록 y가 작고, 동쪽일수록 x가 크다", () => {
    const seoul = project(37.57, 126.98);
    const busan = project(35.18, 129.08);
    expect(seoul.y).toBeLessThan(busan.y);
    expect(seoul.x).toBeLessThan(busan.x);
  });

  it("경도 압축으로 가로가 세로보다 덜 벌어진다 (같은 각도 차이 기준)", () => {
    const origin = project(36, 127);
    const oneDegreeEast = project(36, 128);
    const oneDegreeNorth = project(37, 127);
    expect(Math.abs(oneDegreeEast.x - origin.x)).toBeLessThan(
      Math.abs(oneDegreeNorth.y - origin.y),
    );
  });
});

describe("KOREA_LAND_PATHS", () => {
  it("본토·제주·울릉 3개의 닫힌 경로를 만든다", () => {
    expect(KOREA_LAND_PATHS).toHaveLength(3);
    for (const path of KOREA_LAND_PATHS) {
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith(" Z")).toBe(true);
      expect(path).toContain("C ");
    }
  });
});

describe("computeViewBox", () => {
  it("항상 정사각형을 반환한다", () => {
    const box = computeViewBox([
      { x: 0, y: 0 },
      { x: 300, y: 40 },
    ]);
    expect(box.width).toBe(box.height);
  });

  it("점들이 viewBox 안에 들어온다", () => {
    const points = [
      { x: 100, y: 200 },
      { x: 160, y: 260 },
      { x: 130, y: 210 },
    ];
    const box = computeViewBox(points);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(box.x);
      expect(point.x).toBeLessThanOrEqual(box.x + box.width);
      expect(point.y).toBeGreaterThanOrEqual(box.y);
      expect(point.y).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it("점이 몰려 있어도 minSpan 이하로는 확대하지 않는다", () => {
    const box = computeViewBox([
      { x: 100, y: 100 },
      { x: 101, y: 101 },
    ]);
    expect(box.width).toBeGreaterThanOrEqual(90);
  });

  it("점이 없으면 전국 뷰로 폴백한다", () => {
    expect(computeViewBox([]).width).toBe(340);
  });
});

describe("spreadPoints", () => {
  it("이미 떨어져 있는 점은 그대로 둔다", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(spreadPoints(points, 10, 5)).toEqual(points);
  });

  it("완전히 겹친 점들을 서로 떼어놓는다", () => {
    const spread = spreadPoints(
      [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ],
      10,
      20,
    );
    for (let i = 0; i < spread.length; i += 1) {
      for (let j = i + 1; j < spread.length; j += 1) {
        const distance = Math.hypot(spread[i].x - spread[j].x, spread[i].y - spread[j].y);
        expect(distance).toBeGreaterThan(1);
      }
    }
  });

  it("원래 위치에서 maxOffset 이상 움직이지 않는다", () => {
    const points = Array.from({ length: 6 }, () => ({ x: 20, y: 20 }));
    const maxOffset = 8;
    const spread = spreadPoints(points, 30, maxOffset);
    for (const point of spread) {
      expect(Math.hypot(point.x - 20, point.y - 20)).toBeLessThanOrEqual(maxOffset + 1e-6);
    }
  });

  it("입력 배열을 변형하지 않는다", () => {
    const points = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ];
    spreadPoints(points, 10, 5);
    expect(points).toEqual([
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ]);
  });
});

describe("toViewBoxPercent", () => {
  it("viewBox 좌상단은 0%, 우하단은 100%", () => {
    const viewBox = { x: 100, y: 200, width: 50, height: 50 };
    expect(toViewBoxPercent({ x: 100, y: 200 }, viewBox)).toEqual({ left: 0, top: 0 });
    expect(toViewBoxPercent({ x: 150, y: 250 }, viewBox)).toEqual({ left: 100, top: 100 });
  });
});
