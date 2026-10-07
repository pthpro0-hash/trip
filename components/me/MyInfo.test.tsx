import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const state = vi.hoisted(() => ({
  client: true,
  user: null as null | { user_metadata?: Record<string, unknown>; email?: string },
  replies: 0,
  hearts: 0,
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => (state.client ? { auth: { getUser: async () => ({ data: { user: state.user } }) } } : null),
}));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchUnreadReplyCount: async () => state.replies,
  fetchUnreadHeartCount: async () => state.hearts,
}));
vi.mock("@/lib/signOut", () => ({ signOutAndReload: state.signOut }));

const { MyInfo } = await import("./MyInfo");

const hrefOf = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("MyInfo · 내 정보 메뉴", () => {
  beforeEach(() => {
    state.client = true;
    state.user = { user_metadata: { full_name: "김지민", avatar_url: "https://img.example/a.png" }, email: "jimin@example.com" };
    state.replies = 0;
    state.hearts = 0;
    state.signOut.mockReset();
  });

  describe("로그인했을 때", () => {
    it("누구로 들어와 있는지 이름과 사진을 보여 준다", async () => {
      const { container } = render(<MyInfo />);
      expect(await screen.findByText("김지민")).toBeTruthy();
      expect(container.querySelector("img")?.getAttribute("src")).toBe("https://img.example/a.png");
    });

    it("가족 · 내 자료 · 안내의 길이 한 곳에 모여 있다", async () => {
      render(<MyInfo />);
      await screen.findByText("김지민");
      expect(hrefOf(/^가족 공유/)).toBe("/family");
      expect(hrefOf(/^가족 책장/)).toBe("/mailboxes");
      expect(hrefOf(/^보관함 정리/)).toBe("/help#data");
      expect(hrefOf(/^도움말/)).toBe("/help");
      expect(hrefOf(/^개인정보처리방침/)).toBe("/privacy");
      expect(hrefOf(/^이용약관/)).toBe("/terms");
    });

    it("묶음마다 이름이 있다 — 가족 / 내 자료 / 안내", async () => {
      render(<MyInfo />);
      await screen.findByText("김지민");
      for (const title of ["가족", "내 자료", "안내"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    });

    it("길마다 한 줄 설명이 있어 무엇인지 알 수 있다", async () => {
      render(<MyInfo />);
      await screen.findByText("김지민");
      expect(within(screen.getByRole("link", { name: /^가족 공유/ })).getByText(/가족을 초대해/)).toBeTruthy();
      expect(within(screen.getByRole("link", { name: /^가족 책장/ })).getByText(/부모님께 엽서/)).toBeTruthy();
    });

    it("새 소식이 없으면 책장 줄에 숫자가 없다", async () => {
      render(<MyInfo />);
      await screen.findByText("김지민");
      expect(screen.queryByText(/새 소식/)).toBeNull();
    });

    it("새 답장과 새 하트를 더해 책장 줄에 알린다", async () => {
      state.replies = 1;
      state.hearts = 2;
      render(<MyInfo />);
      const row = await screen.findByRole("link", { name: /^가족 책장/ });
      await waitFor(() => expect(within(row).getByText("새 소식 3")).toBeTruthy());
    });

    it("로그아웃을 누르면 로그아웃한다", async () => {
      render(<MyInfo />);
      fireEvent.click(await screen.findByRole("button", { name: "로그아웃" }));
      await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
    });

    it("로그아웃하는 동안에는 다시 누를 수 없다", async () => {
      state.signOut.mockReturnValue(new Promise(() => undefined));
      render(<MyInfo />);
      const button = await screen.findByRole("button", { name: "로그아웃" });
      fireEvent.click(button);
      await waitFor(() => expect(button).toBeDisabled());
      fireEvent.click(button);
      expect(state.signOut).toHaveBeenCalledTimes(1);
    });
  });

  describe("로그인하지 않았을 때", () => {
    beforeEach(() => {
      state.user = null;
    });

    it("로그인하면 무엇을 쓸 수 있는지 알리고 로그인으로 보낸다 — 돌아올 곳은 내 정보", async () => {
      render(<MyInfo />);
      expect(await screen.findByText(/로그인하면 가족 공유·가족 책장·보관함 정리를 쓸 수 있어요/)).toBeTruthy();
      expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=/me");
    });

    it("로그인해야 하는 길과 로그아웃은 내지 않는다 — 안내만 남는다", async () => {
      render(<MyInfo />);
      await screen.findByRole("link", { name: "로그인하기" });
      expect(screen.queryByRole("link", { name: /^가족 공유/ })).toBeNull();
      expect(screen.queryByRole("link", { name: /^가족 책장/ })).toBeNull();
      expect(screen.queryByRole("link", { name: /^보관함 정리/ })).toBeNull();
      expect(screen.queryByRole("button", { name: "로그아웃" })).toBeNull();
      expect(hrefOf(/^도움말/)).toBe("/help");
      expect(hrefOf(/^개인정보처리방침/)).toBe("/privacy");
      expect(hrefOf(/^이용약관/)).toBe("/terms");
    });

    it("로그인 설정이 아예 없는 환경에서도 같다", async () => {
      state.client = false;
      render(<MyInfo />);
      expect(await screen.findByRole("link", { name: "로그인하기" })).toBeTruthy();
    });
  });

  it("알아보는 동안에는 로그인 단추를 내지 않는다 — 스쳤다 바뀌면 잘못 누르게 된다", () => {
    render(<MyInfo />);
    expect(screen.queryByRole("link", { name: "로그인하기" })).toBeNull();
    expect(screen.getByText("불러오는 중…")).toBeTruthy();
  });
});
