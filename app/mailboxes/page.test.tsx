import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/mailbox/MailboxPanel", () => ({ MailboxPanel: () => <p>우편함 내용</p> }));

const { default: MailboxesPage } = await import("./page");

describe("MailboxesPage", () => {
  it("맨 위에서 내 정보로 돌아갈 수 있다 — 메뉴의 한 칸이라서", () => {
    render(<MailboxesPage />);
    expect(screen.getByRole("link", { name: /내 정보/ })).toHaveAttribute("href", "/me");
    expect(screen.getByRole("heading", { level: 1, name: "가족 우편함" })).toBeTruthy();
  });

  it("가족 공유로 가는 안내는 그대로 있다", () => {
    render(<MailboxesPage />);
    expect(screen.getByRole("link", { name: "가족 공유" })).toHaveAttribute("href", "/family");
  });
});
