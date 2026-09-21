import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RegionExplorer } from "./RegionExplorer";
import type { Spot } from "@/lib/types";

// RegionMap이 지도 크기를 지켜보는 데 쓴다. jsdom에는 없다.
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

function spot(partial: Partial<Spot> & { id: string }): Spot {
  return {
    name: partial.id,
    region: "강원권",
    lat: 37.8,
    lng: 128.9,
    summary: `${partial.id} 요약`,
    highlights: [],
    seasons: [],
    specialty: [],
    foods: [],
    themes: [],
    ...partial,
  };
}

const SPOTS = [
  spot({ id: "경포해변", themes: ["해변"], seasons: ["여름"], foods: ["초당순두부"], lat: 37.8, lng: 128.9 }),
  spot({ id: "오죽헌", themes: ["역사유적"], seasons: ["봄"], foods: ["초당순두부"], lat: 37.78, lng: 128.87 }),
  spot({ id: "설악산", themes: ["자연경관"], seasons: ["가을", "사계절"], foods: ["막국수"], lat: 38.1, lng: 128.46 }),
];

function cardNames() {
  const list = screen.getByRole("heading", { name: /여행지$/ }).parentElement!;
  return within(list)
    .getAllByRole("link", { name: /자세히 보기/ })
    .map((link) => link.getAttribute("href"));
}

describe("RegionExplorer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("권역에 무엇이 많은지 먼저 알려준다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    expect(screen.getByText("이 권역은")).toBeTruthy();
    expect(screen.getByText("초당순두부, 막국수")).toBeTruthy();
  });

  it("권역에 있는 테마만 칩으로 내놓는다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    expect(screen.getByRole("button", { name: "해변" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "역사유적" })).toBeTruthy();
    // 이 권역에 없는 테마는 눌러도 0건이므로 두지 않는다.
    expect(screen.queryByRole("button", { name: "테마파크" })).toBeNull();
  });

  it("테마를 고르면 목록이 좁혀진다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    expect(cardNames()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "해변" }));

    expect(cardNames()).toEqual(["/spots/경포해변"]);
    expect(screen.getByText("조건에 맞는 1곳")).toBeTruthy();
  });

  it("조건 지우기를 누르면 전부 돌아온다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "해변" }));
    fireEvent.click(screen.getByRole("button", { name: "조건 지우기" }));

    expect(cardNames()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "조건 지우기" })).toBeNull();
  });

  it("맞는 곳이 없으면 무엇을 하라고 알려준다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "해변" }));
    fireEvent.click(screen.getByRole("button", { name: "봄" }));

    expect(screen.getByText(/조건에 맞는 곳이 없어요/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /자세히 보기/ })).toBeNull();
  });

  it("목록의 카드에서 바로 가고 싶은 곳에 담을 수 있다", () => {
    render(<RegionExplorer region="강원권" spots={SPOTS} />);
    fireEvent.click(screen.getByRole("button", { name: "설악산 가고 싶은 곳에 담기" }));
    expect(screen.getByRole("button", { name: "설악산 가고 싶은 곳에서 빼기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
