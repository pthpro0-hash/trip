import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FootprintPlayer } from "./FootprintPlayer";
import type { FootprintStep } from "@/lib/footprint";

const step = (over: Partial<FootprintStep>): FootprintStep => ({
  placeName: "안목해변",
  lat: 37.77,
  lng: 128.95,
  month: 8,
  day: 13,
  tripId: "t1",
  photoCount: 12,
  photoPath: null,
  ...over,
});
const steps = [
  step({ placeName: "경복궁", lat: 37.57, lng: 126.98, month: 3, day: 2, tripId: "a" }),
  step({ placeName: "안목해변", month: 8, day: 13, tripId: "b" }),
  step({ placeName: "속초해변", lat: 38.2, lng: 128.59, month: 8, day: 14, tripId: "b" }),
];
const counts = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0];
const totals = { trips: 2, places: 3, photos: 30 };

describe("FootprintPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("곳이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<FootprintPlayer steps={[]} monthCounts={counts} totals={totals} />);
    expect(container.firstChild).toBeNull();
  });

  it("재생하면 날짜와 곳 이름이 차례로 나오고 끝나면 요약이 된다", () => {
    render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
    expect(screen.getByText("재생을 눌러 보세요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "재생" }));
    // 띠와 지도 위 이름표, 두 곳에 나온다.
    expect(screen.getAllByText("3월 2일 · 경복궁").length).toBe(2);
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getAllByText("8월 13일 · 안목해변").length).toBeGreaterThan(0);
    act(() => void vi.advanceTimersByTime(1000));
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText("다녀온 곳 3곳")).toBeTruthy();
  });

  it("달 막대를 누르면 그 달의 곳만 남는다", () => {
    const { container } = render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "8월 여행 1번" }));
    expect(screen.getByText("8월 · 여행 1번")).toBeTruthy();
    expect(container.querySelectorAll("[data-dot]").length).toBe(2);
  });

  it("내 화면에서는 점을 누르면 상세 링크가 나오고, 링크로 받은 화면에는 나오지 않는다", () => {
    const own = render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "끝으로" }));
    fireEvent.click(own.container.querySelector("[data-dot='1']")!);
    expect(screen.getByRole("link", { name: "상세 보기" }).getAttribute("href")).toBe("/trips/b");
    own.unmount();

    const shared = render(<FootprintPlayer shared steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "끝으로" }));
    fireEvent.click(shared.container.querySelector("[data-dot='1']")!);
    expect(screen.queryByRole("link", { name: "상세 보기" })).toBeNull();
    expect(screen.getAllByText("8월 13일 · 안목해변").length).toBeGreaterThan(0);
  });

  it("제목을 바꾸고 달 막대를 뺄 수 있다 — 엽서(여행 하나)에서 쓴다", () => {
    render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} heading="다녀온 길" showMonths={false} />);
    expect(screen.getByRole("heading", { name: "다녀온 길" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "달별 여행 수" })).toBeNull();
  });

  /*
    제목 옆 힌트("날짜순으로 찍어 봐요")와 지도 아래 띠의 부연("다녀온 곳이 날짜순으로 찍혀요")이
    같은 말을 되풀이했다. 처음 띠에는 "재생을 눌러 보세요" 한 줄만 남긴다.
  */
  it("처음에는 '재생을 눌러 보세요' 한 줄만 있다 — 같은 말을 되풀이하지 않는다", () => {
    render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
    expect(screen.getByText("재생을 눌러 보세요")).toBeTruthy();
    expect(screen.queryByText(/날짜순으로 찍/)).toBeNull();
  });

  /*
    '재생'을 눌러 봐야 이 지도가 움직인다는 것을 알 수 있다. 처음에는 단추가 깜빡여 눈길을 끈다.
    누른 뒤에는 멈춘다 — 계속 깜빡이면 보는 데 방해다.
  */
  describe("재생 단추 깜빡임", () => {
    const play = () => screen.getByRole("button", { name: /재생|멈춤|이어서/ });

    it("아직 한 번도 안 눌렀으면 깜빡인다", () => {
      render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
      expect(play()).toHaveAttribute("data-nudge", "true");
    });

    it("누르면 멈춘다", () => {
      render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
      fireEvent.click(play());
      expect(play()).not.toHaveAttribute("data-nudge");
    });

    it("끝까지 본 뒤 '다시 재생'에서는 깜빡이지 않는다 — 이미 아는 단추다", () => {
      render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
      fireEvent.click(screen.getByRole("button", { name: "끝으로" }));
      expect(screen.getByRole("button", { name: "다시 재생" })).not.toHaveAttribute("data-nudge");
    });

    it("달 막대를 눌러 본 뒤에도 깜빡이지 않는다", () => {
      render(<FootprintPlayer steps={steps} monthCounts={counts} totals={totals} />);
      fireEvent.click(screen.getByRole("button", { name: "8월 여행 1번" }));
      expect(screen.getByRole("button", { name: "다시 재생" })).not.toHaveAttribute("data-nudge");
    });
  });
});
