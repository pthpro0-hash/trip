import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const accept = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/family", () => ({ acceptInvite: accept }));

const { JoinCard } = await import("./JoinCard");
const TOKEN = "a".repeat(43);

describe("JoinCard", () => {
  it("열기만 해서는 수락되지 않는다 — 눌러야 가족이 된다", () => {
    render(<JoinCard token={TOKEN} />);
    expect(accept).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "초대 수락하기" })).toBeTruthy();
  });

  it("수락하면 가족이 되었다고 알리고 가족 공유로 안내한다", async () => {
    accept.mockResolvedValue({ ok: true, ownerId: "o1" });
    render(<JoinCard token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "초대 수락하기" }));
    expect(await screen.findByText(/가족이 되었어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "가족 공유 보기" })).toHaveAttribute("href", "/family");
  });

  it.each([
    ["used", /이미 쓴 초대/],
    ["expired", /기간이 지난 초대/],
    ["own", /내가 만든 초대/],
    ["full", /8명까지/],
  ])("%s 이면 이유를 알려 준다", async (reason, text) => {
    accept.mockResolvedValue({ ok: false, reason });
    render(<JoinCard token={TOKEN} />);
    fireEvent.click(screen.getByRole("button", { name: "초대 수락하기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("주소의 글자가 초대가 아니면 수락 단추 없이 알린다", () => {
    render(<JoinCard token={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("없는 초대");
    expect(screen.queryByRole("button", { name: "초대 수락하기" })).toBeNull();
  });
});
