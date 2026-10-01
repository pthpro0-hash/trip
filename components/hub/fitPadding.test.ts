// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fitBottomPadding, MIN_FIT_HEIGHT } from "./fitPadding";

/*
  시트를 끝까지 올리고 월을 고르면 "여행 13 · 사진 300장"인데 목록은 "이 화면에는 다녀온 곳이
  없어요"가 떴다. 곳들을 지도에 맞춰 넣을 때 시트가 덮은 높이를 그대로 아래 여백으로 줬는데,
  끝까지 올린 시트는 지도 거의 전부를 덮어 여백이 지도 높이를 넘었다 — 맞출 땅이 음수가 되어
  지도가 엉뚱한 곳으로 가 버렸다. 여백은 맞출 땅이 최소한 남는 만큼만 준다.
*/
const EDGE = 36;

describe("fitBottomPadding · 시트가 덮은 만큼의 아래 여백", () => {
  it("시트가 낮으면 덮은 높이 그대로", () => {
    expect(fitBottomPadding(700, 150, EDGE)).toBe(150);
  });

  it("반쯤 올려도 맞출 땅이 남으면 그대로", () => {
    expect(fitBottomPadding(700, 336, EDGE)).toBe(336);
  });

  it("끝까지 올리면 맞출 땅이 최소한(MIN_FIT_HEIGHT)은 남게 줄인다", () => {
    const bottom = fitBottomPadding(700, 636, EDGE);
    expect(700 - bottom - EDGE * 2).toBeGreaterThanOrEqual(MIN_FIT_HEIGHT);
    expect(bottom).toBeLessThan(636);
  });

  it("작은 화면에서도 음수가 되지 않는다", () => {
    expect(fitBottomPadding(200, 190, EDGE)).toBeGreaterThanOrEqual(0);
    expect(fitBottomPadding(0, 100, EDGE)).toBe(0);
  });

  it("덮은 높이가 0 이면 0", () => {
    expect(fitBottomPadding(700, 0, EDGE)).toBe(0);
  });
});
