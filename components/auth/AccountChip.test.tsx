import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  configured: true,
  user: null as null | { user_metadata?: Record<string, unknown>; email?: string },
  path: "/",
}));

vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return state.configured;
  },
}));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  }),
}));

const { AccountChip } = await import("./AccountChip");

/*
  위 띠의 이름·사진은 이제 '내 정보'로 가는 문이다. 예전에는 가족 공유로만 가서, 책장 같은 것은 그 안에서
  한참 찾아야 했다. 로그아웃도 거기로 옮겼다 — 폰의 위 띠가 빠듯하다.
*/
describe("AccountChip", () => {
  beforeEach(() => {
    state.configured = true;
    state.path = "/";
    state.user = { user_metadata: { full_name: "김지민", avatar_url: "https://img.example/a.png" }, email: "jimin@example.com" };
  });

  it("로그인했으면 이름·사진이 '내 정보'로 가는 길이다", async () => {
    render(<AccountChip />);
    const link = await screen.findByRole("link", { name: "내 정보" });
    expect(link).toHaveAttribute("href", "/me");
    expect(link.textContent).toContain("김지민");
  });

  it("위 띠에는 로그아웃 단추가 없다 — 내 정보 화면에 있다", async () => {
    render(<AccountChip />);
    await screen.findByRole("link", { name: "내 정보" });
    expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
  });

  it("로그인하지 않았으면 로그인 길", async () => {
    state.user = null;
    render(<AccountChip />);
    expect(await screen.findByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  });

  it.each(["/me", "/family", "/mailboxes"])("%s 에 있으면 켜진 곳으로 표시한다", async (path) => {
    state.path = path;
    render(<AccountChip />);
    expect(await screen.findByRole("link", { name: "내 정보" })).toHaveAttribute("aria-current", "page");
  });

  it("다른 화면에서는 켜지 않는다", async () => {
    state.path = "/trips/abc";
    render(<AccountChip />);
    expect((await screen.findByRole("link", { name: "내 정보" })).getAttribute("aria-current")).toBeNull();
  });

  it("사진이 있으면 좁은 화면에서는 이름을 접는다 — 375px 에 칩이 밀려나지 않게", async () => {
    render(<AccountChip />);
    const link = await screen.findByRole("link", { name: "내 정보" });
    expect(link.querySelector("span")?.className).toContain("hidden");
  });
});
