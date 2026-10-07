import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { keepWho, readWho, useWho } from "./mailboxWho";

describe("받는 쪽 · 누가 보시나요", () => {
  beforeEach(() => window.localStorage.clear());

  it("처음에는 모른다", () => {
    expect(readWho("T".repeat(43))).toBeNull();
  });

  it("한 번 고르면 이 폰이 기억하고, 보고 있던 화면도 따라 바뀐다", () => {
    const token = "T".repeat(43);
    const { result } = renderHook(() => useWho(token));
    expect(result.current).toBeNull();
    act(() => keepWho(token, "엄마"));
    expect(result.current).toBe("엄마");
    expect(readWho(token)).toBe("엄마");
  });

  it("책장마다 따로 기억한다", () => {
    keepWho("A".repeat(43), "엄마");
    expect(readWho("B".repeat(43))).toBeNull();
  });

  it("바꾸기(빈 글)는 다시 모르는 것으로", () => {
    const token = "T".repeat(43);
    keepWho(token, "아빠");
    keepWho(token, "");
    expect(readWho(token) || null).toBeNull();
  });
});
