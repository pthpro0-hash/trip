import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";
import { TripsPanel } from "./TripsPanel";

/*
  시트를 끌어올렸을 때의 세로 목록. 살짝 올린 모습의 여행 카드 줄(TripCards)과 같은 규칙이다 — 줄을 누르면 지도가
  그 여행으로 날아가고, 눌린 줄에만 "열기"가 나타난다. 모든 줄에 "열기"가 있으면 줄을 누르면 열리는 줄 알고 눌렀다가
  지도만 움직이는 데 놀란다.
*/

const trip = (tripId: string, label: string, startedOn: string): TripInView => ({
  tripId,
  label,
  startedOn,
  places: [
    {
      visitId: `${tripId}-v1`,
      tripId,
      tripLabel: label,
      placeName: "안목해변",
      lat: 37.77,
      lng: 128.95,
      startedAt: `${startedOn} 09:00:00`,
      photoCount: 12,
      coverPath: null,
    },
  ],
  photoCount: 12,
});

const 제주 = trip("t2", "제주 가족여행", "2026-09-02");
const 강릉 = trip("t1", "강릉 1박 2일", "2026-08-13");

function panel(props: Partial<ComponentProps<typeof TripsPanel>> = {}) {
  const onFocus = vi.fn();
  const onShowAll = vi.fn();
  render(
    <TripsPanel
      trips={[제주, 강릉]}
      focused={null}
      photoUrls={new Map()}
      onFocus={onFocus}
      onShowAll={onShowAll}
      {...props}
    />,
  );
  return { onFocus, onShowAll };
}

describe("TripsPanel", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("여행마다 한 줄 — 이름, 첫날, 곳 수, 사진 수", () => {
    panel();
    expect(screen.getByText("제주 가족여행")).toBeTruthy();
    expect(screen.getAllByText("2026.09.02 · 1곳 · 사진 12장")).toHaveLength(1);
    expect(screen.getByText("강릉 1박 2일")).toBeTruthy();
  });

  it("줄을 누르면 그 여행을 고른다", () => {
    const { onFocus } = panel();
    fireEvent.click(screen.getByRole("button", { name: /강릉 1박 2일/ }));
    expect(onFocus).toHaveBeenCalledWith(강릉);
  });

  it("고르기 전에는 '열기'가 없다", () => {
    panel();
    expect(screen.queryByRole("link", { name: "열기" })).toBeNull();
  });

  it("고른 줄에만 '열기'가 있고, 그 여행의 상세로 간다", () => {
    panel({ focused: "t1" });
    const open = screen.getByRole("link", { name: "열기" });
    expect(open).toHaveAttribute("href", "/trips/t1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /강릉 1박 2일/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /제주 가족여행/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("열고 나갈 때 이 지도로 돌아오게 적어 둔다", () => {
    panel({ focused: "t2" });
    fireEvent.click(screen.getByRole("link", { name: "열기" }));
    expect(tripFocus.from()).toBe("/?v=sketch");
  });

  it("이 화면에 든 여행이 없으면 전체 보기를 건넨다", () => {
    const { onShowAll } = panel({ trips: [] });
    expect(screen.getByText("이 화면에는 다녀온 곳이 없어요. 지도를 옮기거나 줄여 보세요.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });
});
