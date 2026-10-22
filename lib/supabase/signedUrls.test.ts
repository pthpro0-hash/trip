// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
  받아 둔 사진 주소는 기기에 하루 동안 남겨, 다시 열어도 같은 주소로 브라우저가 가진 사진을 쓴다. 로그아웃하면 지운다.
*/

function fakeSupabase() {
  let issued = 0;
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://x/${path}?token=${++issued}` })),
    error: null,
  }));
  const supabase = { storage: { from: () => ({ createSignedUrls }) } } as unknown as SupabaseClient;
  return { supabase, createSignedUrls };
}

/** 앱을 새로 연 것처럼 — 모듈의 기억은 비고 기기 저장소만 남는다. */
async function freshModule() {
  vi.resetModules();
  return import("./photos");
}

describe("signedUrls · 받아 둔 주소를 기기에 남긴다", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("다시 열어도(새 방문) 같은 주소를 쓴다 — 다시 묻지 않는다", async () => {
    const first = await freshModule();
    const one = fakeSupabase();
    const a = await first.signedUrls(one.supabase, ["u/v/1.webp"]);

    const second = await freshModule();
    const two = fakeSupabase();
    const b = await second.signedUrls(two.supabase, ["u/v/1.webp"]);

    expect(b.get("u/v/1.webp")).toBe(a.get("u/v/1.webp"));
    expect(two.createSignedUrls).not.toHaveBeenCalled();
  });

  it("로그아웃하면(forgetSignedUrls) 기기에서도 지운다", async () => {
    const mod = await freshModule();
    await mod.signedUrls(fakeSupabase().supabase, ["u/v/1.webp"]);
    expect(window.localStorage.getItem("signed-urls:v2")).toContain("u/v/1.webp");
    mod.forgetSignedUrls();
    expect(window.localStorage.getItem("signed-urls:v2")).toBeNull();
  });

  it("탭 저장소에 남아 있던 옛 기억은 치운다", async () => {
    window.sessionStorage.setItem("signed-urls:v1", "{}");
    const mod = await freshModule();
    await mod.signedUrls(fakeSupabase().supabase, ["u/v/1.webp"]);
    expect(window.sessionStorage.getItem("signed-urls:v1")).toBeNull();
  });
});
