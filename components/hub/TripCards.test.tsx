import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";
import { TripCards } from "./TripCards";

/*
  시트를 살짝만 올린 처음 모습에서 내 여행이 보여야 한다. 예전에는 요약 · 달 막대 · 단추가 자리를 다 차지해
  여행 목록은 시트를 끌어올려야 보였다. 여행 카드가 가로로 늘어서면 처음 열었을 때부터 "이게 내 여행들이구나" 한다.

  카드를 누르면 지도가 그 여행으로 날아가 길이 이어지고(지금까지처럼), 눌린 카드에 "열기"가 나타난다 — 눌러서
  지도로 고르는 맛은 두고, 여는 길은 눈에 보이게 한다.
*/

const place = (visitId: string, tripId: string, coverPath: string | null = null) => ({
  visitId,
  tripId,
  tripLabel: "",
  placeName: "안목해변",
  lat: 37.77,
  lng: 128.95,
  startedAt: "2026-08-13 09:00:00",
  photoCount: 3,
  coverPath,
});

const trip = (tripId: string, label: string, startedOn: string, coverPath: string | null = null): TripInView => ({
  tripId,
  label,
  startedOn,
  places: [place(`${tripId}-v1`, tripId, coverPath)],
  photoCount: 3,
});

const 제주 = trip("t2", "제주 가족여행", "2026-09-02", "나/t2/a.webp");
const 강릉 = trip("t1", "강릉 1박 2일", "2026-08-13");
const 부산 = trip("t3", "부산 겨울", "2025-12-24");

function cards(props: Partial<ComponentProps<typeof TripCards>> = {}) {
  const onFocus = vi.fn();
  const onShowAll = vi.fn();
  const view = render(
    <TripCards
      trips={[제주, 강릉, 부산]}
      focused={null}
      photoUrls={new Map([["나/t2/a.webp", "https://예시/a.webp"]])}
      onFocus={onFocus}
      onShowAll={onShowAll}
      {...props}
    />,
  );
  return { ...view, onFocus, onShowAll };
}

describe("TripCards", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("여행마다 카드 하나 — 이름과 첫날이 보인다", () => {
    cards();
    const list = screen.getByRole("list", { name: "이 화면의 여행" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("제주 가족여행");
    expect(items[0]).toHaveTextContent("2026.09.02");
    expect(items[2]).toHaveTextContent("부산 겨울");
  });

  it("누르면 그 여행을 고른다(지도로 날아간다)", () => {
    const { onFocus } = cards();
    fireEvent.click(screen.getByRole("button", { name: /강릉 1박 2일/ }));
    expect(onFocus).toHaveBeenCalledWith(강릉);
  });

  it("고르기 전에는 '열기'가 없다 — 눌러서 여는 길이 둘이던 혼란을 줄인다", () => {
    cards();
    expect(screen.queryByRole("link", { name: /열기/ })).toBeNull();
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("고른 카드에만 '열기'가 나타나고, 그 여행의 상세로 간다", () => {
    cards({ focused: "t1" });
    const open = screen.getByRole("link", { name: /열기/ });
    expect(open).toHaveAttribute("href", "/trips/t1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /강릉 1박 2일/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /제주 가족여행/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("열고 나갈 때 이 지도로 돌아오게 적어 둔다", () => {
    cards({ focused: "t1" });
    fireEvent.click(screen.getByRole("link", { name: /열기/ }));
    expect(tripFocus.from()).toBe("/?v=sketch");
  });

  it("고른 카드도 고르기 전과 같은 높이다 — 고르는 순간 아래 단추가 밀리지 않게", () => {
    const before = cards();
    const heightClass = (root: HTMLElement) => root.querySelector("li")!.innerHTML.match(/\bh-7\b/g)?.length ?? 0;
    const unselected = heightClass(before.container);
    before.unmount();
    const after = cards({ focused: "t2" });
    expect(heightClass(after.container)).toBe(unselected);
  });

  it("대표 사진이 있으면 얹고, 없으면 빈 자리로 둔다", () => {
    const { container } = cards();
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", "https://예시/a.webp");
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("고른 카드에서도 날짜를 화면 읽기 도구는 읽는다", () => {
    cards({ focused: "t1" });
    expect(screen.getByRole("button", { name: /강릉 1박 2일/ })).toHaveTextContent("2026.08.13");
  });

  it("옆으로 미는 줄이라 시트 끌기와 다투지 않게 표시한다", () => {
    cards();
    expect(screen.getByRole("list", { name: "이 화면의 여행" })).toHaveAttribute("data-no-drag");
  });

  describe("이 화면에 든 여행이 없을 때", () => {
    it("지도를 옮기라고 알리고 전체 보기를 건넨다", () => {
      const { onShowAll } = cards({ trips: [] });
      expect(screen.getByText("이 화면에는 다녀온 곳이 없어요. 지도를 옮기거나 줄여 보세요.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
      expect(onShowAll).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  describe("고른 카드가 보이는 자리로", () => {
    it("카드 줄을 밀어 고른 카드를 가운데로 가져온다", () => {
      const scrollTo = vi.fn();
      Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
      cards({ focused: "t3" });
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    });

    it("고른 것이 없으면 건드리지 않는다", () => {
      const scrollTo = vi.fn();
      Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
      cards({ focused: null });
      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
