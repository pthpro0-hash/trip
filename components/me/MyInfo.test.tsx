import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const TOKEN_A = "A".repeat(43);
const TOKEN_B = "B".repeat(43);
const shelf = (id: string, name: string, token: string, over: { closed?: boolean } = {}) => ({ id, name, token, closed: false, ...over });

const state = vi.hoisted(() => ({
  client: true,
  user: null as null | { id?: string; user_metadata?: Record<string, unknown>; email?: string },
  boxes: { owned: [], joined: [] } as { owned: unknown[]; joined: unknown[] } | "failed" | "throw",
  replies: 0,
  hearts: 0,
  wishes: 0,
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => (state.client ? { auth: { getUser: async () => ({ data: { user: state.user } }) } } : null),
}));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchUnreadReplyCount: async () => state.replies,
  fetchUnreadHeartCount: async () => state.hearts,
  fetchUnreadWishCount: async () => state.wishes,
}));
vi.mock("@/lib/supabase/mailbox", () => ({
  fetchMailboxes: async () => {
    if (state.boxes === "throw") throw new Error("network");
    return state.boxes;
  },
}));
vi.mock("@/lib/signOut", () => ({ signOutAndReload: state.signOut }));

const { MyInfo } = await import("./MyInfo");

const hrefOf = (name: string | RegExp) => screen.getByRole("link", { name }).getAttribute("href");

describe("MyInfo · 내 정보 메뉴", () => {
  beforeEach(() => {
    state.client = true;
    state.user = { id: "u1", user_metadata: { full_name: "김지민", avatar_url: "https://img.example/a.png" }, email: "jimin@example.com" };
    state.boxes = { owned: [], joined: [] };
    state.replies = 0;
    state.hearts = 0;
    state.wishes = 0;
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

    it("새 답장·하트·가고 싶은 곳을 더해 책장 줄에 알린다", async () => {
      state.replies = 1;
      state.hearts = 2;
      state.wishes = 1;
      render(<MyInfo />);
      const row = await screen.findByRole("link", { name: /^가족 책장/ });
      await waitFor(() => expect(within(row).getByText("새 소식 4")).toBeTruthy());
    });

    /*
      책꽂이는 가족 책장(관리 화면)과 미리보기를 거쳐야 겨우 닿았다. 내 정보에서 책장마다 줄을 내어,
      누르면 그 책장 안(책꽂이)으로 바로 들어간다.
    */
    describe("내 책장 속으로", () => {
      it("내가 만든 책장마다 줄이 하나씩 있고, 누르면 그 책장 안(책꽂이)으로 들어간다", async () => {
        state.boxes = {
          owned: [shelf("1", "우리 엄마 아빠", TOKEN_A), shelf("2", "시댁", TOKEN_B)],
          joined: [],
        };
        render(<MyInfo />);
        const first = await screen.findByRole("link", { name: /^우리 엄마 아빠/ });
        // 미리보기 방식 — 열어 본 표시·답장·하트는 부모님께 가지 않고, 안 열어 본 책도 책꽂이에 보인다.
        expect(first).toHaveAttribute("href", `/m/${TOKEN_A}?preview=all`);
        expect(screen.getByRole("link", { name: /^시댁/ })).toHaveAttribute("href", `/m/${TOKEN_B}?preview=all`);
      });

      it("줄에 무엇이 열리는지 한 줄로 알려 준다", async () => {
        state.boxes = { owned: [shelf("1", "우리 엄마 아빠", TOKEN_A)], joined: [] };
        render(<MyInfo />);
        const row = await screen.findByRole("link", { name: /^우리 엄마 아빠/ });
        expect(within(row).getByText(/책꽂이/)).toBeTruthy();
      });

      it("관리 화면으로 가는 '가족 책장' 줄은 그대로 있다 — 설정·보낸 엽서는 거기서", async () => {
        state.boxes = { owned: [shelf("1", "우리 엄마 아빠", TOKEN_A)], joined: [] };
        render(<MyInfo />);
        await screen.findByRole("link", { name: /^우리 엄마 아빠/ });
        expect(hrefOf(/^가족 책장/)).toBe("/mailboxes");
      });

      it("책장 줄은 '가족' 묶음 안에, 가족 책장 줄 바로 아래에 있다", async () => {
        state.boxes = { owned: [shelf("1", "우리 엄마 아빠", TOKEN_A)], joined: [] };
        render(<MyInfo />);
        const mine = await screen.findByRole("link", { name: /^우리 엄마 아빠/ });
        const manage = screen.getByRole("link", { name: /^가족 책장/ });
        expect(manage.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        const group = mine.closest("section");
        expect(group?.querySelector("h2")?.textContent).toBe("가족");
        expect(group?.contains(manage)).toBe(true);
      });

      it("닫아 둔 책장은 줄을 내지 않는다 — 부모님께도 아무것도 안 보이니 들어갈 것이 없다", async () => {
        state.boxes = {
          owned: [shelf("1", "우리 엄마 아빠", TOKEN_A), shelf("2", "닫은 책장", TOKEN_B, { closed: true })],
          joined: [],
        };
        render(<MyInfo />);
        await screen.findByRole("link", { name: /^우리 엄마 아빠/ });
        expect(screen.queryByRole("link", { name: /^닫은 책장/ })).toBeNull();
      });

      it("보내는 사람으로만 들어간 남의 책장은 줄을 내지 않는다", async () => {
        state.boxes = { owned: [], joined: [shelf("9", "남의 책장", TOKEN_B)] };
        render(<MyInfo />);
        await screen.findByText("김지민");
        await waitFor(() => expect(screen.queryByRole("link", { name: /^남의 책장/ })).toBeNull());
      });

      it("책장이 하나도 없으면 책장 줄 없이 '가족 책장' 줄만 있다", async () => {
        render(<MyInfo />);
        await screen.findByText("김지민");
        expect(hrefOf(/^가족 책장/)).toBe("/mailboxes");
        expect(screen.queryByRole("link", { name: /책꽂이 안으로/ })).toBeNull();
      });

      it("책장을 못 읽어도 나머지는 그대로다 — 관리 줄과 새 소식은 남는다", async () => {
        state.replies = 1;
        state.boxes = "failed";
        render(<MyInfo />);
        const row = await screen.findByRole("link", { name: /^가족 책장/ });
        await waitFor(() => expect(within(row).getByText("새 소식 1")).toBeTruthy());
        expect(screen.queryByRole("link", { name: /책꽂이 안으로/ })).toBeNull();
      });

      it("책장을 읽다가 오류가 나도 화면이 무너지지 않는다", async () => {
        state.replies = 2;
        state.boxes = "throw";
        render(<MyInfo />);
        const row = await screen.findByRole("link", { name: /^가족 책장/ });
        await waitFor(() => expect(within(row).getByText("새 소식 2")).toBeTruthy());
        expect(screen.getByRole("link", { name: /^가족 공유/ })).toBeTruthy();
      });

      it("로그인하지 않았으면 책장 줄도 없다", async () => {
        state.user = null;
        state.boxes = { owned: [shelf("1", "우리 엄마 아빠", TOKEN_A)], joined: [] };
        render(<MyInfo />);
        await screen.findByRole("link", { name: "로그인하기" });
        expect(screen.queryByRole("link", { name: /^우리 엄마 아빠/ })).toBeNull();
      });
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
