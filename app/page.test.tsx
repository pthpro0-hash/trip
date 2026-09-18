import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomePage from "./page";

// The search field debounces before it tells the page, so these go through
// waitFor rather than reading the DOM straight after the keystroke.
function typeSearch(value: string) {
  fireEvent.change(screen.getByLabelText("검색"), { target: { value } });
}

// Each case renders the real page with all 121 spots (and their photo cards),
// which takes a couple of seconds on its own and longer when the rest of the
// suite is competing for the machine — well past the 5s default.
describe("HomePage", { timeout: 20000 }, () => {
  it("권역 필터를 선택하면 렌더링되는 SpotCard 수가 줄어든다", () => {
    render(<HomePage />);

    const beforeCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;

    fireEvent.click(screen.getByLabelText("제주권"));

    const afterCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;
    expect(afterCount).toBeLessThan(beforeCount);
  });

  it("검색어를 입력하면 렌더링되는 SpotCard 수가 줄어든다", async () => {
    render(<HomePage />);

    const beforeCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;

    typeSearch("궁");

    await waitFor(
      () => {
        const afterCount = screen.getAllByRole("link", { name: /자세히 보기/ }).length;
        expect(afterCount).toBeLessThan(beforeCount);
      },
      { timeout: 10000 },
    );
  });

  it("검색하면 모바일 뷰가 리스트로 바뀐다", async () => {
    render(<HomePage />);
    expect(screen.getByRole("button", { name: "지도" }).getAttribute("aria-pressed")).toBe("true");

    typeSearch("경복궁");

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "리스트" }).getAttribute("aria-pressed")).toBe(
          "true",
        );
      },
      { timeout: 10000 },
    );
  });

  it("사용자가 직접 지도를 고르면 이후 검색해도 리스트로 바꾸지 않는다", async () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "지도" }));
    typeSearch("경복궁");

    await waitFor(() => expect(screen.getByText(/검색 결과/)).toBeTruthy(), { timeout: 10000 });
    expect(screen.getByRole("button", { name: "지도" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("모바일 기본 뷰는 지도이다(검색/지도가 주요 기능이므로)", () => {
    render(<HomePage />);
    expect(screen.getByRole("button", { name: "지도" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("검색 결과가 0건이면 리스트가 숨겨진 뷰에서도 안내 메시지가 보인다", async () => {
    render(<HomePage />);

    // 지도 뷰를 직접 골라 두면 검색해도 리스트로 전환되지 않는다.
    fireEvent.click(screen.getByRole("button", { name: "지도" }));
    typeSearch("존재하지않는검색어글자조합xyz123");

    const message = await screen.findByText("조건에 맞는 곳이 없어요.", {}, { timeout: 10000 });
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
