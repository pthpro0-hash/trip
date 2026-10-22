// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/*
  로그인 세션을 이어 주는 자리(proxy.ts). 세션 쿠키가 없으면 Supabase 에 묻지 않고 그대로 보낸다 — 둘러보는 사람과 검색엔진의
  모든 요청이 멀리 있는 Supabase 를 다녀오던 것을 아낀다.
*/

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/config", () => ({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", isSupabaseConfigured: true }));

const { proxy } = await import("./proxy");

const request = (cookie?: string) =>
  new NextRequest("https://example.com/trips", cookie ? { headers: { cookie } } : undefined);

describe("proxy", () => {
  beforeEach(() => getUser.mockClear());

  it("세션 쿠키가 없으면 Supabase 에 묻지 않는다", async () => {
    await proxy(request());
    await proxy(request("start=sketch"));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("로그인 도중의 code-verifier 쿠키만 있으면 묻지 않는다", async () => {
    await proxy(request("sb-abc-auth-token-code-verifier=x"));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("세션 쿠키가 있으면 세션을 이어 준다(토큰 갱신)", async () => {
    await proxy(request("sb-abc-auth-token=x"));
    await proxy(request("sb-abc-auth-token.0=x; sb-abc-auth-token.1=y"));
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});
