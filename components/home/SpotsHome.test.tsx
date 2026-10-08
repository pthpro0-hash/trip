import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpotsHome as HomePage } from "./SpotsHome";

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

/*
  폰에는 아래에 하단 탭(내 여행 · 한장 · 사진 고르기 · 여행 100선)이 있다. 첫 화면 한가운데의
  큰 갈래 스위치와 아래 구석에 떠 있던 "사진 고르기" 단추는 폰에서 그것과 같은 일을 하므로
  접는다. 넓은 화면에는 하단 탭이 없어 그대로다.
*/
describe("HomePage · 폰의 하단 탭과 겹치는 것", { timeout: 20000 }, () => {
  it("큰 갈래 스위치는 폰에서 접는다", () => {
    render(<HomePage switcher={<span>갈래 스위치</span>} />);
    expect(screen.getByText("갈래 스위치").parentElement!.className).toContain("max-sm:hidden");
  });

  it("떠 있는 '사진 고르기' 단추는 폰에서 접고, 이름은 어디서나 같다", () => {
    render(<HomePage />);
    const floating = screen
      .getAllByRole("link", { name: /사진 고르기/ })
      .find((link) => link.className.includes("fixed"))!;
    expect(floating).toHaveAttribute("href", "/trips/new");
    expect(floating.className).toContain("max-sm:hidden");
    expect(screen.queryByText(/여행 스케치 그리기/)).toBeNull();
  });
});

/*
  여행 100선 첫 화면은 큰 제목(한국관광 100선)에서 시작한다. 한때 맨 위에 환영 영역(약속 한 줄·예시 그림)을 넣었더니
  아래 100선이 밀려 내려가고 영역이 구분되지 않아 혼잡해 보였다. 이 서비스가 무엇을 해 주는지는 로그인 전 방문자에게
  뜨는 환영 팝업(WelcomeDialog, app/page 가 둔다)이 말한다.
*/
describe("HomePage · 첫 화면의 순서", { timeout: 20000 }, () => {
  it("큰 제목(한국관광 100선)이 맨 위에서 시작한다 — 환영 영역이 밀어 내리지 않는다", () => {
    const { container } = render(<HomePage />);
    const first = container.querySelector("main")!.firstElementChild!;
    expect(first.tagName).toBe("HEADER");
    expect(first).toContainElement(screen.getByRole("heading", { level: 1, name: "한국관광 100선" }));
  });

  it("큰 제목(h1)은 한국관광 100선 하나다 — 검색에 걸리는 말", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("한국관광 100선");
  });

  it("환영 영역이나 예시 그림이 본문에 없다", () => {
    const { container } = render(<HomePage />);
    expect(screen.queryByRole("heading", { level: 2, name: /사진만 고르면/ })).toBeNull();
    expect(container.querySelector("img[alt*='예시']")).toBeNull();
    expect(screen.queryByRole("link", { name: /여행 100선 둘러보기/ })).toBeNull();
  });

  it("떠 있는 '사진 고르기' 단추만 사진 고르는 화면으로 간다", () => {
    render(<HomePage />);
    const picks = screen.getAllByRole("link", { name: /사진 고르기/ });
    expect(picks).toHaveLength(1);
    expect(picks[0]).toHaveAttribute("href", "/trips/new");
  });
});
