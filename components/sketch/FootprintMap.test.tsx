import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FootprintMap } from "./FootprintMap";
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

describe("FootprintMap", () => {
  it("곳이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<FootprintMap steps={[]} monthCounts={counts} totals={totals} />);
    expect(container.firstChild).toBeNull();
  });

  it("처음부터 모든 곳이 찍혀 있고, 띠는 한 해를 말한다 — 재생 단추는 없다", () => {
    const { container } = render(<FootprintMap steps={steps} monthCounts={counts} totals={totals} />);
    expect(container.querySelectorAll("[data-dot]").length).toBe(3);
    expect(screen.getByText("다녀온 곳 3곳")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /재생|끝으로|멈춤/ })).toBeNull();
  });

  it("달 막대를 누르면 그 달의 곳만 남고, 다시 누르면 전부로 돌아온다", () => {
    const { container } = render(<FootprintMap steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(screen.getByRole("button", { name: "8월 여행 1번" }));
    expect(screen.getByText("8월 · 여행 1번")).toBeTruthy();
    expect(container.querySelectorAll("[data-dot]").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "8월 여행 1번" }));
    expect(container.querySelectorAll("[data-dot]").length).toBe(3);
  });

  it("내 화면에서는 점을 누르면 상세 링크가 나오고, 링크로 받은 화면에는 나오지 않는다", () => {
    const own = render(<FootprintMap steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(own.container.querySelector("[data-dot='1']")!);
    expect(screen.getByRole("link", { name: "상세 보기" }).getAttribute("href")).toBe("/trips/b");
    own.unmount();

    const shared = render(<FootprintMap shared steps={steps} monthCounts={counts} totals={totals} />);
    fireEvent.click(shared.container.querySelector("[data-dot='1']")!);
    expect(screen.queryByRole("link", { name: "상세 보기" })).toBeNull();
    expect(screen.getAllByText("8월 13일 · 안목해변").length).toBeGreaterThan(0);
  });

  it("제목을 바꾸고 달 막대를 뺄 수 있다 — 엽서(여행 하나)에서 쓴다", () => {
    render(<FootprintMap steps={steps} monthCounts={counts} totals={totals} heading="다녀온 길" showMonths={false} />);
    expect(screen.getByRole("heading", { name: "다녀온 길" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "달별 여행 수" })).toBeNull();
  });
});
