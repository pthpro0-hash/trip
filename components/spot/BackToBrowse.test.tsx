import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackToBrowse } from "./BackToBrowse";
import { spotFocus } from "@/lib/scrollMemory";

/*
  여행지 상세는 둘러보기에서도, 권역별에서도, 주소를 바로 열어서도
  들어온다. 돌아갈 곳은 떠나올 때 카드가 적어 둔 것으로 안다.
*/
describe("BackToBrowse", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("적어 둔 곳이 없으면 둘러보기로 보낸다", () => {
    render(<BackToBrowse spotId="경복궁" />);
    const back = screen.getByRole("link");
    expect(back).toHaveAttribute("href", "/");
    expect(back.textContent).toContain("둘러보기");
  });

  it("권역별에서 왔으면 그 권역 이름을 달고 그리로 돌려보낸다", () => {
    spotFocus.rememberFrom(`/regions/${encodeURIComponent("강원권")}`);
    render(<BackToBrowse spotId="경복궁" />);

    const back = screen.getByRole("link");
    expect(back).toHaveAttribute("href", `/regions/${encodeURIComponent("강원권")}`);
    expect(back.textContent).toContain("강원권");
  });

  it("둘러보기에서 왔으면 거르던 조건까지 그대로 돌려보낸다", () => {
    spotFocus.rememberFrom("/?q=바다");
    render(<BackToBrowse spotId="경복궁" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/?q=바다");
  });

  /*
    남이 건넨 주소로 딴 데로 보내지 않는다. 적힌 것이 우리 주소가
    아니면 둘러보기로 돌린다.
  */
  it("바깥 주소가 적혀 있으면 따라가지 않는다", () => {
    spotFocus.rememberFrom("https://남의곳/훔치기");
    render(<BackToBrowse spotId="경복궁" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });

  it("누르면 이 여행지 앞에 세워 달라고 적어 둔다", () => {
    render(<BackToBrowse spotId="경복궁" />);
    expect(spotFocus.peek()).toBeNull();

    fireEvent.click(screen.getByRole("link"));

    expect(spotFocus.peek()).toBe("경복궁");
  });
});
