import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/family/FamilyPanel", () => ({ FamilyPanel: () => <p>가족 공유 내용</p> }));

const { default: FamilyPage } = await import("./page");

describe("FamilyPage", () => {
  it("맨 위에서 내 정보로 돌아갈 수 있다 — 메뉴의 한 칸이라서", () => {
    render(<FamilyPage />);
    expect(screen.getByRole("link", { name: /내 정보/ })).toHaveAttribute("href", "/me");
    expect(screen.getByRole("heading", { level: 1, name: "가족 공유" })).toBeTruthy();
  });

  it("가족 우편함으로 가는 안내는 그대로 있다", () => {
    render(<FamilyPage />);
    expect(screen.getByRole("link", { name: "가족 우편함" })).toHaveAttribute("href", "/mailboxes");
  });
});
