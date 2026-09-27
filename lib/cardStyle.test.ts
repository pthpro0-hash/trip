import { describe, it, expect, beforeEach, vi } from "vitest";
import { keepCardStyle, readCardStyle, styleSuffix, subscribeCardStyle } from "./cardStyle";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("cardStyle", () => {
  it("고른 적이 없으면 지도", () => {
    expect(readCardStyle()).toBe("map");
  });

  it("고른 모양을 다음에도 기억한다", () => {
    keepCardStyle("line");
    expect(readCardStyle()).toBe("line");
  });

  it("알 수 없는 값이 남아 있으면 지도로", () => {
    window.localStorage.setItem("sketch:cardStyle", "poster");
    expect(readCardStyle()).toBe("map");
  });

  it("고르면 지켜보는 쪽에 알린다", () => {
    const listener = vi.fn();
    const stop = subscribeCardStyle(listener);
    keepCardStyle("collage");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    keepCardStyle("map");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("저장소가 막혀도 멈추지 않고, 이번 방문 동안은 고른 대로", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => keepCardStyle("collage")).not.toThrow();
    expect(readCardStyle()).toBe("collage");
  });

  it("저장 이름에 모양을 붙인다 — 지도는 처음부터 있던 모양이라 붙이지 않는다", () => {
    expect(styleSuffix("map")).toBe("");
    expect(styleSuffix("collage")).toBe("-콜라주");
    expect(styleSuffix("line")).toBe("-선그림");
  });
});
