import { describe, it, expect, beforeEach } from "vitest";
import { inviteState, markInvited, shouldInvite, snoozeInviteToday, todayKey } from "./invite";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const now = new Date(2026, 8, 28, 10);
const invite = (spot: "home" | "sketch", helpSeen = true, at = now) => shouldInvite(inviteState(spot, helpSeen, at));

describe("내 스케치 안내를 언제 내미나", () => {
  it("첫 화면에서 한 번, 내 스케치에 들어오면 한 번 더, 그다음은 없다", () => {
    expect(invite("home")).toBe(true);
    markInvited("home");
    expect(invite("home")).toBe(false);
    expect(invite("sketch")).toBe(true);
    markInvited("sketch");
    expect(invite("sketch")).toBe(false);
  });

  it("내 스케치로 바로 들어와도 그것이 첫 화면 — 나중에 내 스케치를 누르면 한 번 더", () => {
    expect(invite("sketch")).toBe(true);
    markInvited("sketch");
    expect(invite("home")).toBe(false);
    expect(invite("sketch")).toBe(true);
    markInvited("sketch");
    expect(invite("sketch")).toBe(false);
  });

  it("오늘 그만 보기 — 오늘은 없고, 내일은 다시", () => {
    snoozeInviteToday(now);
    expect(invite("home")).toBe(false);
    expect(invite("sketch")).toBe(false);
    expect(invite("home", true, new Date(2026, 8, 29, 9))).toBe(true);
  });

  it("사용법 창을 닫기 전에는 내밀지 않는다 — 창이 겹치지 않게", () => {
    expect(invite("home", false)).toBe(false);
  });

  it("오늘은 이 기기 시각으로 센다", () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
