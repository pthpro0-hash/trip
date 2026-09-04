import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("권역 필터를 선택하면 렌더링되는 SpotCard 수가 줄어든다", () => {
    render(<HomePage />);

    const beforeCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;

    fireEvent.click(screen.getByLabelText("제주권"));

    const afterCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;
    expect(afterCount).toBeLessThan(beforeCount);
  });

  it("렌더링되는 모든 카드는 /spots/로 시작하는 링크를 가진다", () => {
    render(<HomePage />);
    const links = screen.getAllByRole("link", { name: /자세히 보기/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/spots\//);
    }
  });
});
