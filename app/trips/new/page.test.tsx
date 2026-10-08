import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// 사진 읽기 화면은 따로 시험한다. 여기서는 페이지가 이름과 틀을 어떻게 내는지만 본다.
vi.mock("@/components/trip/PhotoImport", () => ({
  PhotoImport: () => <div data-testid="photo-import" />,
}));

const { default: NewTripPage, metadata } = await import("./page");

/*
  사진으로 여행을 추가하는 화면의 이름은 하나다. 하단 탭과 첫 화면 팝업의 단추는 "사진 고르기"이고, 도착한 화면은
  하는 일을 이름으로 말한다 — "사진으로 여행 추가". 예전 "사진에서 여행 찾기"는 아래 부제와 같은 말을 되풀이했다.
*/
describe("/trips/new", () => {
  it("화면 이름은 '사진으로 여행 추가'", () => {
    render(<NewTripPage />);
    expect(screen.getByRole("heading", { level: 1, name: "사진으로 여행 추가" })).toBeTruthy();
    expect(metadata.title).toBe("사진으로 여행 추가");
  });

  it("같은 말을 되풀이하는 부제가 없다", () => {
    const { container } = render(<NewTripPage />);
    expect(container.textContent).not.toContain("기억나지 않는 사진도");
    expect(container.textContent).not.toContain("사진에서 여행 찾기");
  });

  it("사진 읽기 화면을 담는다", () => {
    render(<NewTripPage />);
    expect(screen.getByTestId("photo-import")).toBeTruthy();
  });

  it("검색에 걸리지 않게 한다 — 로그인과 사진이 있는 사람의 작업 화면이다", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
