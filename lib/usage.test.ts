// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/*
  어떤 화면을 열고 어떤 기능을 썼는지 센다 — 무엇을 숨기고 뺄지의 근거.
  이름 하나만 남기고, 로그인한 사람만 센다.
*/
const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
let session: unknown = { user: { id: "u" } };
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session } }) }, rpc }),
}));
const { ACTIONS, SCREENS, USAGE_STARTS, logUse, screenOf, usageOn } = await import("./usage");
const ON = "2026-01-01";
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  rpc.mockClear();
  session = { user: { id: "u" } };
});

describe("screenOf · 주소로 어느 화면인지", () => {
  const none = { v: null, view: null };
  it.each([
    ["/trips/new", "add_photos"],
    ["/trips/abc", "trip_detail"],
    ["/trips", "my_list"],
    ["/sketch", "sketch"],
    ["/spots/경복궁", "spot_detail"],
    ["/regions/강원권", "region"],
    ["/regions", "region"],
    ["/me", "me"],
    ["/family", "family"],
    ["/mailboxes", "mailboxes"],
    ["/help", "help"],
  ])("%s → %s", (path, screen) => {
    expect(screenOf(path, none, null)).toBe(screen);
  });

  it("첫 화면은 ?v= 가 먼저, 없으면 지난번에 고른 것, 그것도 없으면 여행 100선", () => {
    expect(screenOf("/", { v: "sketch", view: null }, "spots")).toBe("my_map");
    expect(screenOf("/", { v: "sketch", view: "list" }, null)).toBe("my_list");
    expect(screenOf("/", { v: "spots", view: null }, "sketch")).toBe("spots_home");
    expect(screenOf("/", none, "sketch")).toBe("my_map");
    expect(screenOf("/", none, null)).toBe("spots_home");
  });

  it("링크로 받은 화면·부모님 화면·로그인 길·관리 화면은 세지 않는다", () => {
    for (const path of ["/s/abc", "/t/abc", "/m/abc", "/m/abc/wish", "/login", "/auth/callback", "/admin/suggestions", "/privacy"]) {
      expect(screenOf(path, none, null)).toBeNull();
    }
  });

  it("앞부분만 닮은 주소는 다른 화면이다", () => {
    expect(screenOf("/sketchbook", none, null)).toBeNull();
    expect(screenOf("/merch", none, null)).toBeNull();
  });
});

describe("logUse", () => {
  it("이름 하나만 'use.<이름>' 으로 남긴다 — 내용은 싣지 않는다", async () => {
    logUse("sketch_save", ON);
    await settle();
    expect(rpc).toHaveBeenCalledWith("log_event", { p_event: "use.sketch_save", p_detail: {} });
  });

  it("로그인하지 않았으면 남기지 않는다", async () => {
    session = null;
    logUse("my_map", ON);
    await settle();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("방침에 적은 날(2026-10-14)부터 센다 — 그 전에는 세지 않는다", async () => {
    expect(USAGE_STARTS).toBe("2026-10-14");
    logUse("sketch_save", USAGE_STARTS, new Date("2026-10-13T12:00:00Z"));
    await settle();
    expect(rpc).not.toHaveBeenCalled();
    logUse("sketch_save", USAGE_STARTS, new Date("2026-10-14T03:00:00Z"));
    await settle();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("시행일 전에는 세지 않고, 그날(한국 날짜)부터 센다", () => {
    expect(usageOn("2026-10-21", new Date("2026-10-20T14:59:00Z"))).toBe(false); // 한국 20일 23:59
    expect(usageOn("2026-10-21", new Date("2026-10-20T15:00:00Z"))).toBe(true); // 한국 21일 0:00
    expect(usageOn(null, new Date())).toBe(false);
  });

  it("이름은 기록 표의 한도(40자) 안이고 겹치지 않는다", () => {
    const names = [...SCREENS, ...ACTIONS];
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(`use.${name}`.length).toBeLessThanOrEqual(40);
  });
});
