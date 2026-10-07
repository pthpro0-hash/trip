import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const state = vi.hoisted(() => ({ user: { id: "me" } as { id: string } | null, unread: 0, hearts: 0, wishes: 0 }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchUnreadReplyCount: async () => state.unread,
  fetchUnreadHeartCount: async () => state.hearts,
  fetchUnreadWishCount: async () => state.wishes,
}));

const { MailboxBell, REPLIES_SEEN } = await import("./MailboxBell");

describe("MailboxBell · 새 소식(답장·하트) 알림", () => {
  beforeEach(() => {
    state.user = { id: "me" };
    state.unread = 0;
    state.hearts = 0;
    state.wishes = 0;
  });

  it("새 소식이 없으면 아무것도 그리지 않는다 — 위 띠는 폰에서 이미 빠듯하다", async () => {
    const { container } = render(<MailboxBell />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.firstChild).toBeNull();
  });

  it("새 소식이 오면 숫자와 함께 나타나고, 누르면 책장 화면으로 간다", async () => {
    state.unread = 2;
    render(<MailboxBell />);
    const link = await screen.findByRole("link", { name: "가족 책장 새 소식 2개" });
    expect(link).toHaveAttribute("href", "/mailboxes");
    expect(link).toHaveTextContent("2");
  });

  it("열 개가 넘으면 9+", async () => {
    state.unread = 14;
    render(<MailboxBell />);
    expect(await screen.findByRole("link", { name: "가족 책장 새 소식 14개" })).toHaveTextContent("9+");
  });

  it("답장·하트·가고 싶은 곳을 더해 센다", async () => {
    state.unread = 1;
    state.hearts = 2;
    state.wishes = 4;
    render(<MailboxBell />);
    expect(await screen.findByRole("link", { name: "가족 책장 새 소식 7개" })).toHaveTextContent("7");
  });

  it("가고 싶은 곳만 와도 나타난다", async () => {
    state.wishes = 1;
    render(<MailboxBell />);
    expect(await screen.findByRole("link", { name: "가족 책장 새 소식 1개" })).toBeTruthy();
  });

  it("하트만 와도 나타난다", async () => {
    state.hearts = 1;
    render(<MailboxBell />);
    expect(await screen.findByRole("link", { name: "가족 책장 새 소식 1개" })).toBeTruthy();
  });

  it("로그인하지 않았으면 없다", async () => {
    state.user = null;
    state.unread = 3;
    const { container } = render(<MailboxBell />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.firstChild).toBeNull();
  });

  it("책장 화면이 답장을 봤다고 알리면 다시 세어 사라진다", async () => {
    state.unread = 1;
    const { container } = render(<MailboxBell />);
    await screen.findByRole("link", { name: /새 소식 1개/ });
    state.unread = 0;
    act(() => void window.dispatchEvent(new Event(REPLIES_SEEN)));
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
