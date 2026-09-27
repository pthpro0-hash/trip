// @vitest-environment node
import { describe, it, expect } from "vitest";
import { COLLAGE_MAX, collagePicks, collageTiles, fitText, textWidth, type Tile } from "./collage";

const BOX: Tile = { x: 48, y: 168, width: 624, height: 680 };
const GAP = 8;
const area = (tile: Tile) => tile.width * tile.height;
const overlaps = (a: Tile, b: Tile) =>
  a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 && a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;

describe("collageTiles", () => {
  for (let count = 1; count <= COLLAGE_MAX; count++) {
    it(`${count}장이면 ${count}칸 — 틀 안에, 겹치지 않게, 첫 칸이 가장 크게`, () => {
      const tiles = collageTiles(count, BOX, GAP);
      expect(tiles).toHaveLength(count);
      for (const tile of tiles) {
        expect(tile.x).toBeGreaterThanOrEqual(BOX.x - 0.01);
        expect(tile.y).toBeGreaterThanOrEqual(BOX.y - 0.01);
        expect(tile.x + tile.width).toBeLessThanOrEqual(BOX.x + BOX.width + 0.01);
        expect(tile.y + tile.height).toBeLessThanOrEqual(BOX.y + BOX.height + 0.01);
      }
      for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) expect(overlaps(tiles[i], tiles[j])).toBe(false);
      }
      expect(Math.max(...tiles.map(area))).toBeCloseTo(area(tiles[0]));
    });
  }

  it("틀을 빈틈없이 채운다 — 마지막 줄이 틀 바닥에 닿는다", () => {
    const tiles = collageTiles(7, BOX, GAP);
    const bottom = Math.max(...tiles.map((tile) => tile.y + tile.height));
    expect(bottom).toBeCloseTo(BOX.y + BOX.height);
  });

  it("사진이 없으면 칸도 없고, 너무 많으면 아홉 칸까지", () => {
    expect(collageTiles(0, BOX, GAP)).toEqual([]);
    expect(collageTiles(20, BOX, GAP)).toHaveLength(COLLAGE_MAX);
  });
});

describe("collagePicks", () => {
  const dot = (name: string, count: number, day: string, path: string | null = `${name}.webp`) => ({
    placeName: name,
    photoCount: count,
    lastVisitedOn: day,
    photoPath: path,
  });

  it("큰 칸에는 사진을 가장 많이 남긴 곳, 나머지는 간 날 순서로", () => {
    const picks = collagePicks([
      dot("속초", 8, "2026-08-14"),
      dot("우도", 12, "2026-04-10"),
      dot("안목", 31, "2026-08-13"),
      dot("대천", 6, "2026-07-25"),
    ]);
    expect(picks.map((pick) => pick.placeName)).toEqual(["안목", "우도", "대천", "속초"]);
  });

  it("사진 없는 곳은 빼고, 사진 많은 곳부터 max 곳까지", () => {
    const picks = collagePicks(
      [dot("가", 1, "2026-01-01"), dot("나", 9, "2026-02-01"), dot("다", 5, "2026-03-01", null), dot("라", 3, "2026-04-01")],
      2,
    );
    expect(picks.map((pick) => pick.placeName)).toEqual(["나", "라"]);
  });

  it("사진이 하나도 없으면 빈 배열", () => {
    expect(collagePicks([dot("가", 0, "2026-01-01", null)])).toEqual([]);
  });
});

describe("fitText", () => {
  it("들어가면 그대로", () => {
    expect(fitText("안목해변", 200, 15)).toBe("안목해변");
  });

  it("넘치면 잘라서 … 를 붙이고, 폭을 넘지 않는다", () => {
    const text = "강릉 안목해변 커피거리 앞 모래사장";
    const fitted = fitText(text, 120, 15);
    expect(fitted.endsWith("…")).toBe(true);
    expect(fitted.length).toBeLessThan(text.length);
    expect(textWidth(fitted, 15)).toBeLessThanOrEqual(120);
  });

  it("한글은 영문보다 넓게 어림한다", () => {
    expect(textWidth("가나다", 20)).toBeGreaterThan(textWidth("abc", 20));
  });
});
