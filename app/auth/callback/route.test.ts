// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/*
  로그인을 마치고 돌아올 곳(next)은 쿼리까지 그대로 가야 한다 — 사진을 맡겨 두고 로그인하러 간 사람은 '?resume=1' 이 붙은 주소로 돌아와야
  맡겨 둔 여행이 열린다(lib/photo/resume). 그리고 로그인을 취소했다가 다시 시도해도 돌아올 곳을 잃지 않아야 한다.
*/

const state = vi.hoisted(() => ({ exchangeError: null as null | { message: string }, configured: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () =>
    state.configured
      ? {
          auth: { exchangeCodeForSession: async () => ({ error: state.exchangeError }) },
          rpc: async () => ({}),
        }
      : null,
}));

const { GET } = await import("./route");

const callback = (query: string) => GET(new Request(`https://app.example.test/auth/callback?${query}`));
const where = (response: Response) => response.headers.get("location");

beforeEach(() => {
  state.exchangeError = null;
  state.configured = true;
});

describe("auth/callback · 돌아올 곳", () => {
  it("로그인을 마치면 우리가 보낸 돌아올 곳으로 간다 — 쿼리(?resume=1)도 그대로", async () => {
    const response = await callback(`code=abc&next=${encodeURIComponent("/trips/new?resume=1")}`);
    expect(where(response)).toBe("https://app.example.test/trips/new?resume=1");
  });

  it("돌아올 곳이 없으면 첫 화면으로 간다", async () => {
    expect(where(await callback("code=abc"))).toBe("https://app.example.test/");
  });

  it("우리 경로가 아닌 곳(다른 사이트)으로는 보내지 않는다", async () => {
    expect(where(await callback(`code=abc&next=${encodeURIComponent("//evil.example.test/x")}`))).toBe("https://app.example.test/");
    expect(where(await callback(`code=abc&next=${encodeURIComponent("https://evil.example.test/x")}`))).toBe("https://app.example.test/");
  });

  describe("로그인이 안 됐을 때도 돌아올 곳을 잃지 않는다 — 다시 시도해도 그 자리로 돌아오게", () => {
    const next = encodeURIComponent("/trips/new?resume=1");
    const back = (error: string) => `https://app.example.test/login?error=${error}&next=${next}`;

    it("동의 화면에서 취소하면", async () => {
      expect(where(await callback(`error=access_denied&next=${next}`))).toBe(back("cancelled"));
    });

    it("코드가 오지 않으면", async () => {
      expect(where(await callback(`next=${next}`))).toBe(back("missing_code"));
    });

    it("코드를 세션으로 바꾸지 못하면", async () => {
      state.exchangeError = { message: "bad" };
      expect(where(await callback(`code=abc&next=${next}`))).toBe(back("exchange_failed"));
    });

    it("로그인 설정이 없으면", async () => {
      state.configured = false;
      expect(where(await callback(`code=abc&next=${next}`))).toBe(back("not_configured"));
    });

    it("돌아올 곳이 첫 화면뿐이면 덧붙이지 않는다(주소를 어지럽히지 않는다)", async () => {
      expect(where(await callback("error=access_denied"))).toBe("https://app.example.test/login?error=cancelled");
    });
  });
});
