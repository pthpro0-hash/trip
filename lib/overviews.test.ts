// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/* 소개글은 검색할 때 받는다 — 받기 전에는 비어 있고, 받으면 구독한 곳에 알리고, 한 번만 받는다. */
beforeEach(() => vi.resetModules());

describe("overviews", () => {
  it("받기 전에는 소개글이 비어 있고 받았다고 하지 않는다", async () => {
    const o = await import("./overviews");
    expect(o.overviewsLoaded()).toBe(false);
    expect(o.getSpotOverview("경복궁")).toBe("");
    expect(o.overviewsVersion()).toBe(0);
  });

  it("받으면 소개글이 채워지고, 구독한 곳에 알리고, 버전이 오른다", async () => {
    const o = await import("./overviews");
    const heard = vi.fn();
    o.subscribeOverviews(heard);
    await o.loadOverviews();
    expect(o.overviewsLoaded()).toBe(true);
    expect(o.getSpotOverview("경복궁").length).toBeGreaterThan(100);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(o.overviewsVersion()).toBe(1);
  });

  it("여러 번 불러도 한 번만 받는다", async () => {
    const o = await import("./overviews");
    const heard = vi.fn();
    o.subscribeOverviews(heard);
    await Promise.all([o.loadOverviews(), o.loadOverviews()]);
    await o.loadOverviews();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("구독을 끊으면 더는 알리지 않는다", async () => {
    const o = await import("./overviews");
    const heard = vi.fn();
    const stop = o.subscribeOverviews(heard);
    stop();
    await o.loadOverviews();
    expect(heard).not.toHaveBeenCalled();
  });

  it("소개글을 받으면 소개글로 읽어낸 상황 계산이 새로 된다", async () => {
    const o = await import("./overviews");
    const situations = await import("./situations");
    const spots = (await import("./data/spots.json")).default as import("./types").Spot[];
    const before = spots.filter((spot) => situations.situationsOf(spot).size > 0).length;
    await o.loadOverviews();
    const after = spots.filter((spot) => situations.situationsOf(spot).size > 0).length;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
