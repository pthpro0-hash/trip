// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const LEGACY_KEY = "yeohaeng.saved.v1";
const WISHLIST_KEY = "yeohaeng.wishlist.v1";
const TRIP_KEY = "yeohaeng.trip.v1";

// 스토어는 모듈 수준에 값을 들고 있어, 테스트마다 새로 불러와야
// 앞 테스트의 상태가 넘어오지 않는다.
async function load() {
  vi.resetModules();
  return import("./collections");
}

const read = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");

describe("useWishlist", () => {
  beforeEach(() => window.localStorage.clear());

  it("처음에는 비어 있다", async () => {
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    expect(result.current.ids).toEqual([]);
  });

  it("담고 빼기", async () => {
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    act(() => result.current.toggle("경복궁"));
    act(() => result.current.toggle("창경궁"));
    expect(result.current.ids).toEqual(["경복궁", "창경궁"]);

    act(() => result.current.toggle("경복궁"));
    expect(result.current.ids).toEqual(["창경궁"]);
  });

  it("브라우저를 다시 열어도 남아 있다", async () => {
    const first = await load();
    const a = renderHook(() => first.useWishlist());
    act(() => a.result.current.toggle("경복궁"));

    const second = await load();
    const b = renderHook(() => second.useWishlist());
    expect(b.result.current.ids).toEqual(["경복궁"]);
  });

  it("저장된 값이 깨져 있어도 앱은 그대로 뜬다", async () => {
    window.localStorage.setItem(WISHLIST_KEY, "{ 이건 JSON이 아니다");
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    expect(result.current.ids).toEqual([]);
  });

  it("문자열이 아닌 값은 걸러낸다", async () => {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(["경복궁", 7, null, "창경궁"]));
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    expect(result.current.ids).toEqual(["경복궁", "창경궁"]);
  });

  it("다른 탭에서 바꾼 것도 따라간다", async () => {
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    act(() => result.current.toggle("경복궁"));

    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(["경복궁", "창경궁"]));
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: WISHLIST_KEY })));
    expect(result.current.ids).toEqual(["경복궁", "창경궁"]);
  });
});

describe("useTripPlan", () => {
  beforeEach(() => window.localStorage.clear());

  it("담은 순서를 지킨다 — 이 순서가 곧 다닐 순서다", async () => {
    const { useTripPlan } = await load();
    const { result } = renderHook(() => useTripPlan());
    act(() => result.current.add("창경궁"));
    act(() => result.current.add("경복궁"));
    expect(result.current.ids).toEqual(["창경궁", "경복궁"]);
  });

  it("같은 곳을 두 번 담아도 한 번만 들어간다", async () => {
    const { useTripPlan } = await load();
    const { result } = renderHook(() => useTripPlan());
    act(() => result.current.add("경복궁"));
    act(() => result.current.add("경복궁"));
    expect(result.current.ids).toEqual(["경복궁"]);
  });

  it("순서를 바꾼다", async () => {
    const { useTripPlan } = await load();
    const { result } = renderHook(() => useTripPlan());
    act(() => result.current.add("경복궁"));
    act(() => result.current.add("창경궁"));
    act(() => result.current.move(1, 0));
    expect(result.current.ids).toEqual(["창경궁", "경복궁"]);
  });
});

describe("두 서랍은 서로 독립이다", () => {
  beforeEach(() => window.localStorage.clear());

  it("이번 여행에서 빼도 가고 싶은 곳은 그대로 남는다", async () => {
    const { useWishlist, useTripPlan } = await load();
    const wish = renderHook(() => useWishlist());
    const trip = renderHook(() => useTripPlan());

    act(() => wish.result.current.toggle("경복궁"));
    act(() => trip.result.current.add("경복궁"));
    act(() => trip.result.current.remove("경복궁"));

    expect(trip.result.current.ids).toEqual([]);
    expect(wish.result.current.ids).toEqual(["경복궁"]);
  });

  it("이번 여행을 비워도 가고 싶은 곳은 그대로다", async () => {
    const { useWishlist, useTripPlan } = await load();
    const wish = renderHook(() => useWishlist());
    const trip = renderHook(() => useTripPlan());

    act(() => wish.result.current.toggle("경복궁"));
    act(() => trip.result.current.add("경복궁"));
    act(() => trip.result.current.clear());

    expect(wish.result.current.ids).toEqual(["경복궁"]);
  });
});

describe("예전 목록 옮기기", () => {
  beforeEach(() => window.localStorage.clear());

  it("한 건도 잃지 않고 두 서랍 모두에 들어간다", async () => {
    // 예전 목록은 찜이면서 동시에 코스 순서였다.
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(["교동도", "경복궁", "남이섬"]));

    const { useWishlist, useTripPlan } = await load();
    const wish = renderHook(() => useWishlist());
    const trip = renderHook(() => useTripPlan());

    expect(wish.result.current.ids).toEqual(["교동도", "경복궁", "남이섬"]);
    expect(trip.result.current.ids).toEqual(["교동도", "경복궁", "남이섬"]);
    // 순서까지 그대로여야 코스 화면이 예전과 똑같이 보인다.
    expect(read(WISHLIST_KEY)).toEqual(["교동도", "경복궁", "남이섬"]);
    expect(read(TRIP_KEY)).toEqual(["교동도", "경복궁", "남이섬"]);
  });

  it("예전 키를 지우지 않는다 — 되돌릴 때 필요하다", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(["경복궁"]));
    const { useWishlist } = await load();
    renderHook(() => useWishlist());
    expect(read(LEGACY_KEY)).toEqual(["경복궁"]);
  });

  it("이미 옮긴 뒤에는 덮어쓰지 않는다", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(["교동도", "경복궁"]));
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(["창경궁"]));

    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    expect(result.current.ids).toEqual(["창경궁"]);
  });

  it("옮긴 뒤 한쪽을 고쳐도 다른 쪽은 따라 변하지 않는다", async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(["교동도", "경복궁"]));
    const { useWishlist, useTripPlan } = await load();
    const wish = renderHook(() => useWishlist());
    const trip = renderHook(() => useTripPlan());

    act(() => trip.result.current.remove("교동도"));

    expect(trip.result.current.ids).toEqual(["경복궁"]);
    expect(wish.result.current.ids).toEqual(["교동도", "경복궁"]);
  });

  it("예전 목록이 없으면 아무 일도 하지 않는다", async () => {
    const { useWishlist } = await load();
    const { result } = renderHook(() => useWishlist());
    expect(result.current.ids).toEqual([]);
    expect(window.localStorage.getItem(WISHLIST_KEY)).toBeNull();
  });
});
