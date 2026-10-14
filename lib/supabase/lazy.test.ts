// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const created = vi.hoisted(() => ({ calls: 0 }));
vi.mock("./client", () => ({
  getBrowserClient: () => {
    created.calls += 1;
    return { id: "client" };
  },
}));
const { clientIfSignedIn, currentUser, loadClient } = await import("./lazy");

const clearCookies = () => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

beforeEach(() => {
  created.calls = 0;
  clearCookies();
});

describe("clientIfSignedIn · 둘러보는 사람은 클라이언트를 불러오지 않는다", () => {
  it("로그인 세션 쿠키가 없으면 null 이고, 클라이언트를 만들지도 않는다", async () => {
    expect(await clientIfSignedIn()).toBeNull();
    expect(created.calls).toBe(0);
  });

  it("세션 쿠키가 있으면 클라이언트를 불러온다", async () => {
    document.cookie = "sb-abc-auth-token=x; path=/";
    expect(await clientIfSignedIn()).toEqual({ id: "client" });
    expect(created.calls).toBe(1);
  });

  it("로그인 도중에 잠깐 생기는 code-verifier 쿠키는 세션이 아니다", async () => {
    document.cookie = "sb-abc-auth-token-code-verifier=x; path=/";
    expect(await clientIfSignedIn()).toBeNull();
  });

  it("loadClient 는 쿠키와 상관없이 불러온다 — 로그인 단추처럼 쿠키가 아직 없을 때 쓴다", async () => {
    expect(await loadClient()).toEqual({ id: "client" });
  });
});

describe("currentUser · 같은 순간의 로그인 확인은 한 번만 묻는다", () => {
  const client = (answer: () => Promise<unknown>) => {
    const getUser = vi.fn(answer);
    return { supabase: { auth: { getUser } } as unknown as SupabaseClient, getUser };
  };

  it("동시에 여럿이 물으면 서버에는 한 번만 가고, 모두 같은 답을 받는다", async () => {
    const { supabase, getUser } = client(async () => ({ data: { user: { id: "u" } } }));
    const [a, b, c] = await Promise.all([currentUser(supabase), currentUser(supabase), currentUser(supabase)]);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("답이 온 뒤에는 잊는다 — 다음에 물으면 다시 서버에 묻는다(로그아웃·계정 바뀜을 놓치지 않게)", async () => {
    let user: { id: string } | null = { id: "u" };
    const { supabase, getUser } = client(async () => ({ data: { user } }));
    expect((await currentUser(supabase)).data.user).toEqual({ id: "u" });
    user = null;
    expect((await currentUser(supabase)).data.user).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("실패해도 잊는다 — 실패한 답이 남아 다음 확인까지 망치지 않게", async () => {
    let fail = true;
    const { supabase, getUser } = client(async () => {
      if (fail) throw new Error("network");
      return { data: { user: { id: "u" } } };
    });
    await expect(currentUser(supabase)).rejects.toThrow("network");
    fail = false;
    expect((await currentUser(supabase)).data.user).toEqual({ id: "u" });
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("다른 클라이언트의 확인은 섞이지 않는다", async () => {
    const one = client(async () => ({ data: { user: { id: "1" } } }));
    const two = client(async () => ({ data: { user: { id: "2" } } }));
    const [a, b] = await Promise.all([currentUser(one.supabase), currentUser(two.supabase)]);
    expect(a.data.user?.id).toBe("1");
    expect(b.data.user?.id).toBe("2");
  });
});
