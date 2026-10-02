import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const accept = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/mailbox", () => ({ acceptMailboxInvite: accept }));

const { MailboxJoinCard } = await import("./MailboxJoinCard");
const TOKEN = "a".repeat(43);

describe("MailboxJoinCard", () => {
  it("열기만 해서는 수락되지 않는다 — 눌러야 보내는 사람이 된다", () => {
    render(<MailboxJoinCard token={TOKEN} />);
    expect(accept).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "초대 수락하기" })).toBeTruthy();
  });

  it("수락하면 알리고 내 우편함으로 안내한다", async () => {
    accept.mockResolvedValue({ ok: true, mailboxId: "m1" });
    render(<MailboxJoinCard token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "초대 수락하기" }));
    expect(await screen.findByText(/엽서를 보낼 수 있어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "내 우편함 보기" })).toHaveAttribute("href", "/mailboxes");
  });

  it.each([
    ["used", /이미 쓴 초대/],
    ["expired", /기간이 지난 초대/],
    ["closed", /닫힌 우편함/],
    ["full", /8명까지/],
  ])("%s 이면 이유를 알려 준다", async (reason, text) => {
    accept.mockResolvedValue({ ok: false, reason });
    render(<MailboxJoinCard token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "초대 수락하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("주소의 글자가 초대가 아니면 수락 단추 없이 알린다", () => {
    render(<MailboxJoinCard token={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("없는 초대");
    expect(screen.queryByRole("button", { name: "초대 수락하기" })).toBeNull();
  });
});
