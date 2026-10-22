import { describe, it, expect, beforeEach } from "vitest";
import {
  INTRO_BOOT_SCRIPT,
  closeIntro,
  introOpen,
  markIntroShown,
  readIntroShown,
  resetIntroForTest,
  resetIntroShownForTest,
  shouldShowIntro,
} from "./intro";

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

/*
  빨리 뜨게 하기 — 서버가 소개를 그려 보내고, 그 앞의 작은 글이 그려지기 전에 볼지 말지를 <html data-intro> 에 적는다.
*/
describe("첫 방문 소개 · 그려지기 전에 정하기", () => {
  const boot = () => new Function(INTRO_BOOT_SCRIPT)();
  const attr = () => document.documentElement.getAttribute("data-intro");

  beforeEach(() => {
    window.sessionStorage.clear();
    resetIntroForTest();
    document.cookie = "sb-test-auth-token=; path=/; max-age=0";
  });

  it("이번 방문에 처음이면 on 으로 적고, 봤다고 남긴다", () => {
    boot();
    expect(attr()).toBe("on");
    expect(window.sessionStorage.getItem("intro:shown")).toBe("1");
    expect(introOpen()).toBe(true);
  });

  it("이번 방문에 이미 봤으면(새로 고침) off — 감춰진 채 그려진다", () => {
    window.sessionStorage.setItem("intro:shown", "1");
    boot();
    expect(attr()).toBe("off");
    expect(introOpen()).toBe(false);
  });

  it("로그인 쿠키가 있으면 off", () => {
    document.cookie = "sb-test-auth-token=abc; path=/";
    boot();
    expect(attr()).toBe("off");
  });

  it("글이 돌지 않았으면(앱 안에서 넘어왔다) 같은 규칙으로 정해 적는다", () => {
    expect(introOpen()).toBe(true);
    expect(attr()).toBe("on");
    expect(readIntroShown()).toBe(true);
  });

  it("닫으면 off — 같은 방문 안에서 첫 화면으로 돌아와도 다시 열리지 않는다", () => {
    boot();
    closeIntro();
    expect(introOpen()).toBe(false);
  });
});
