import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("./TripList", () => ({ TripList: () => <p>여행 카드들</p> }));
const { TripArchive } = await import("./TripArchive");

/*
  내 여행의 목록 모습. 모든 여행을 검색하고 거르고 지운다(TripList). 지도 화면과는
  스위치 하나로 오간다 — 더는 따로 선 화면이 아니다.
*/
describe("TripArchive", () => {
  it("이름은 '내 여행' — 위 띠의 갈래와 같다", () => {
    render(<TripArchive onView={() => undefined} />);
    expect(screen.getByRole("heading", { level: 1, name: "내 여행" })).toBeTruthy();
  });

  it("목록이 켜진 스위치가 있고, 지도를 누르면 지도로 돌아간다", () => {
    const onView = vi.fn();
    render(<TripArchive onView={onView} />);
    expect(screen.getByRole("radio", { name: "목록" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "지도" }));
    expect(onView).toHaveBeenCalledWith("map");
  });

  it("여행 카드들을 보인다", () => {
    render(<TripArchive onView={() => undefined} />);
    expect(screen.getByText("여행 카드들")).toBeTruthy();
  });
});
