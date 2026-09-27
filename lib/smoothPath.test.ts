// @vitest-environment node
import { describe, it, expect } from "vitest";
import { smoothPath } from "./smoothPath";

describe("smoothPath", () => {
  it("점이 없으면 빈 줄, 하나면 자리만", () => {
    expect(smoothPath([])).toBe("");
    expect(smoothPath([{ x: 10, y: 20 }])).toBe("M10 20");
  });

  it("모든 점을 지난다 — 다녀온 곳을 비껴가지 않는다", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 80 },
      { x: 120, y: 40 },
      { x: 200, y: 90 },
    ];
    const d = smoothPath(points);
    expect(d.startsWith("M0 0")).toBe(true);
    const ends = [...d.matchAll(/C[^C]*?(-?[\d.]+) (-?[\d.]+)(?= C|$)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(ends).toEqual(points.slice(1));
  });

  it("곡선 조각이 점 사이마다 하나씩", () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ]);
    expect(d.match(/C/g)).toHaveLength(2);
  });
});
