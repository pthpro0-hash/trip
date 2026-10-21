import { describe, it, expect, beforeEach } from "vitest";
import { markIntroShown, readIntroShown, resetIntroShownForTest, shouldShowIntro } from "./intro";

describe("첫 방문 소개 규칙", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetIntroShownForTest();
  });

  it("처음에는 안 보인 것이고, 적어 두면 보인 것이다", () => {
    expect(readIntroShown()).toBe(false);
    markIntroShown();
    expect(readIntroShown()).toBe(true);
  });

  it("방문(세션)이 새로 시작되면 다시 뜬다 — 저장소가 비면 안 본 것", () => {
    markIntroShown();
    resetIntroShownForTest();
    window.sessionStorage.clear();
    expect(readIntroShown()).toBe(false);
  });

  it("저장소를 쓸 수 없어도 이 탭 안에서는 기억한다", () => {
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(readIntroShown()).toBe(false);
      markIntroShown();
      expect(readIntroShown()).toBe(true);
    } finally {
      Object.defineProperty(window, "sessionStorage", original);
    }
  });

  it("로그인 전이면 이번 방문에 안 보였을 때 뜨고, 로그인했으면 안 뜬다 — 검색에서 왔는지는 따지지 않는다", () => {
    expect(shouldShowIntro({ shown: false, hasSession: false })).toBe(true);
    expect(shouldShowIntro({ shown: true, hasSession: false })).toBe(false);
    expect(shouldShowIntro({ shown: false, hasSession: true })).toBe(false);
  });
});
