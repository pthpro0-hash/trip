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

  it("검색어를 입력하면 렌더링되는 SpotCard 수가 줄어든다", () => {
    render(<HomePage />);

    const beforeCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "궁" } });

    const afterCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;
    expect(afterCount).toBeLessThan(beforeCount);
  });

  it("모바일 기본 뷰는 지도이다(검색/지도가 주요 기능이므로)", () => {
    render(<HomePage />);
    expect(screen.getByRole("button", { name: "지도" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("검색 결과가 0건이면 모바일 기본 뷰(지도)에서도 안내 메시지가 보인다", () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("검색"), {
      target: { value: "존재하지않는검색어글자조합xyz123" },
    });

    const message = screen.getByText("조건에 맞는 곳이 없어요.");
    // jsdom doesn't evaluate CSS, so a message merely present in the DOM
    // could still be invisible in a real browser if some ancestor carries
    // Tailwind's `hidden` class (e.g. the list panel, which is hidden while
    // the mobile view is "map" — the default). Walk up and confirm no
    // ancestor actually hides it, which is the real bug this guards against.
    let node: HTMLElement | null = message;
    while (node) {
      expect(node.className.split(" ")).not.toContain("hidden");
      node = node.parentElement;
    }
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
