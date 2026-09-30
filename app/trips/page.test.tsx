import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/trip/TripList", () => ({ TripList: () => null }));
vi.mock("@/components/trip/StorageTidy", () => ({ StorageTidy: () => null }));
const { default: TripsPage, metadata } = await import("./page");

/*
  같은 이름을 서로 다른 화면에 붙이면 사람은 자기가 어디 있는지 모른다. 위 띠의
  "내 여행"은 지도로 가는 갈래이고, 이 화면은 그 안의 목록이다 — 이름을 나눈다.
*/
describe("/trips · 여행 목록", () => {
  it("이 화면의 이름은 '여행 목록' — 위 띠의 '내 여행'(지도)과 겹치지 않는다", () => {
    render(<TripsPage />);
    expect(screen.getByRole("heading", { level: 1, name: "여행 목록" })).toBeTruthy();
    expect(metadata.title).toBe("여행 목록");
  });

  it("사진을 넣는 길은 어디서나 같은 말이다 — '+ 사진 고르기'", () => {
    render(<TripsPage />);
    expect(screen.getByRole("link", { name: "+ 사진 고르기" })).toHaveAttribute("href", "/trips/new");
    expect(screen.queryByText(/사진등록/)).toBeNull();
  });

  it("한장 요약으로 가는 길이 있다", () => {
    render(<TripsPage />);
    expect(screen.getByRole("link", { name: "한장 요약" })).toHaveAttribute("href", "/sketch");
  });
});
