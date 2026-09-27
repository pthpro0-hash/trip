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

  it("적어 둔 곳이 없으면 여행 100선으로 보낸다", () => {
    render(<BackToBrowse spotId="경복궁" />);
    const back = screen.getByRole("link");
    // 맨 "/" 는 지난번에 고른 갈래를 연다. 내 지도가 뜨지 않게 갈래를 적는다.
    expect(back).toHaveAttribute("href", "/?v=spots");
    expect(back.textContent).toContain("여행 100선");
  });

  it("권역별에서 왔으면 그 권역 이름을 달고 그리로 돌려보낸다", () => {
    spotFocus.rememberFrom(`/regions/${encodeURIComponent("강원권")}`);
    render(<BackToBrowse spotId="경복궁" />);

    const back = screen.getByRole("link");
    expect(back).toHaveAttribute("href", `/regions/${encodeURIComponent("강원권")}`);
    expect(back.textContent).toContain("강원권");
  });

  it("첫 화면에서 왔으면 여행 100선 쪽으로 돌려보낸다", () => {
    // 여행지 카드는 100선에만 있다. 맨 "/" 로 보내면 내 지도가 뜰 수 있다.
    spotFocus.rememberFrom("/");
    render(<BackToBrowse spotId="경복궁" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/?v=spots");
  });

  /*
    남이 건넨 주소로 딴 데로 보내지 않는다. 적힌 것이 우리 주소가
    아니면 둘러보기로 돌린다.
  */
  it("내 스케치 지도에서 100선을 겹쳐 보다 들어왔으면 지도로 돌려보낸다", () => {
    spotFocus.rememberFrom("/?v=sketch");
    render(<BackToBrowse spotId="경복궁" />);
    const back = screen.getByRole("link");
    expect(back).toHaveAttribute("href", "/?v=sketch");
    expect(back.textContent).toContain("내 스케치");
  });

  it("바깥 주소가 적혀 있으면 따라가지 않는다", () => {
    spotFocus.rememberFrom("https://남의곳/훔치기");
    render(<BackToBrowse spotId="경복궁" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/?v=spots");
  });

  it("누르면 이 여행지 앞에 세워 달라고 적어 둔다", () => {
    render(<BackToBrowse spotId="경복궁" />);
    expect(spotFocus.peek()).toBeNull();

    fireEvent.click(screen.getByRole("link"));

    expect(spotFocus.peek()).toBe("경복궁");
  });
});
