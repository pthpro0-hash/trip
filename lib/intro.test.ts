import { describe, it, expect, beforeEach } from "vitest";
import { markIntroSeen, readIntroSeen, shouldShowIntro } from "./intro";

describe("첫 방문 인트로 규칙", () => {
  beforeEach(() => window.localStorage.clear());

  it("처음에는 안 본 것이고, 적어 두면 본 것이다", () => {
    expect(readIntroSeen()).toBe(false);
    markIntroSeen();
    expect(readIntroSeen()).toBe(true);
  });

  it("저장소를 읽을 수 없으면 null — 내밀지 않는다", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      expect(readIntroSeen()).toBeNull();
      expect(shouldShowIntro({ seen: readIntroSeen(), fromSearch: false, hasSession: false })).toBe(false);
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });

  it("안 본 로그인 전 직접 방문자에게만 뜬다", () => {
    expect(shouldShowIntro({ seen: false, fromSearch: false, hasSession: false })).toBe(true);
    expect(shouldShowIntro({ seen: true, fromSearch: false, hasSession: false })).toBe(false);
    expect(shouldShowIntro({ seen: false, fromSearch: true, hasSession: false })).toBe(false);
    expect(shouldShowIntro({ seen: false, fromSearch: false, hasSession: true })).toBe(false);
  });
});
