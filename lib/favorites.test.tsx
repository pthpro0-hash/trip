// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const STORAGE_KEY = "yeohaeng.saved.v1";

// 스토어는 모듈 수준에 값을 들고 있어, 테스트마다 새로 불러와야
// 앞 테스트의 상태가 넘어오지 않는다.
async function freshStore() {
  vi.resetModules();
  const { useSavedSpots } = await import("./favorites");
  return renderHook(() => useSavedSpots());
}

describe("useSavedSpots", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("처음에는 비어 있다", async () => {
    const { result } = await freshStore();
    expect(result.current.ids).toEqual([]);
  });

  it("담은 순서를 그대로 유지한다 — 이 순서가 곧 코스 순서다", async () => {
    const { result } = await freshStore();
    act(() => result.current.toggle("나"));
    act(() => result.current.toggle("가"));
    act(() => result.current.toggle("다"));
    expect(result.current.ids).toEqual(["나", "가", "다"]);
  });

  it("같은 곳을 다시 누르면 빠진다", async () => {
    const { result } = await freshStore();
    act(() => result.current.toggle("가"));
    act(() => result.current.toggle("가"));
    expect(result.current.ids).toEqual([]);
  });

  it("브라우저를 다시 열어도 남아 있다", async () => {
    const first = await freshStore();
    act(() => first.result.current.toggle("가"));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(["가"]);

    const second = await freshStore();
    expect(second.result.current.ids).toEqual(["가"]);
  });

  it("순서를 바꾼다", async () => {
    const { result } = await freshStore();
    act(() => result.current.toggle("가"));
    act(() => result.current.toggle("나"));
    act(() => result.current.move(1, 0));
    expect(result.current.ids).toEqual(["나", "가"]);
  });

  it("빼기와 비우기", async () => {
    const { result } = await freshStore();
    act(() => result.current.toggle("가"));
    act(() => result.current.toggle("나"));
    act(() => result.current.remove("가"));
    expect(result.current.ids).toEqual(["나"]);
    act(() => result.current.clear());
    expect(result.current.ids).toEqual([]);
  });

  it("저장된 값이 깨져 있어도 앱은 그대로 뜬다", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{ 이건 JSON이 아니다");
    const { result } = await freshStore();
    expect(result.current.ids).toEqual([]);
  });

  it("문자열이 아닌 값은 걸러낸다", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["가", 7, null, "나"]));
    const { result } = await freshStore();
    expect(result.current.ids).toEqual(["가", "나"]);
  });

  it("다른 탭에서 바꾼 것도 따라간다", async () => {
    const { result } = await freshStore();
    act(() => result.current.toggle("가"));

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["가", "나"]));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });
    expect(result.current.ids).toEqual(["가", "나"]);
  });
});
