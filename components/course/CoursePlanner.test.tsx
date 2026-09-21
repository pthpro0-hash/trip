import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const TRIP_KEY = "yeohaeng.trip.v1";
const WISHLIST_KEY = "yeohaeng.wishlist.v1";

// 찜 스토어가 모듈 수준에 값을 들고 있어, 저장소를 채운 뒤 새로 불러와야 한다.
async function renderWith(ids: string[], wishlist: string[] = []) {
  window.localStorage.setItem(TRIP_KEY, JSON.stringify(ids));
  window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  vi.resetModules();
  const { CoursePlanner } = await import("./CoursePlanner");
  return render(<CoursePlanner />);
}

describe("CoursePlanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("담은 곳이 없으면 무엇을 해야 하는지 알려준다", async () => {
    await renderWith([]);
    expect(screen.getByText("이번 여행에 담은 곳이 없어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /여행지 둘러보기/ })).toHaveAttribute("href", "/");
  });

  it("담은 순서대로 번호를 매겨 보여준다", async () => {
    await renderWith(["창경궁", "경복궁"]);
    const names = screen
      .getAllByRole("link", { name: /경복궁|창경궁/ })
      .map((link) => link.textContent);
    expect(names).toEqual(["창경궁", "경복궁"]);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("총 거리를 직선거리라고 밝힌다", async () => {
    await renderWith(["경복궁", "한라산-국립공원"]);
    expect(screen.getByText(/직선거리 기준/)).toBeTruthy();
  });

  it("위로 버튼을 누르면 순서가 바뀐다", async () => {
    await renderWith(["창경궁", "경복궁"]);
    fireEvent.click(screen.getByRole("button", { name: "경복궁 위로" }));

    const names = screen
      .getAllByRole("link", { name: /경복궁|창경궁/ })
      .map((link) => link.textContent);
    expect(names).toEqual(["경복궁", "창경궁"]);
    expect(JSON.parse(window.localStorage.getItem(TRIP_KEY)!)).toEqual(["경복궁", "창경궁"]);
  });

  it("첫 곳은 더 위로 못 올린다", async () => {
    await renderWith(["창경궁", "경복궁"]);
    expect(screen.getByRole("button", { name: "창경궁 위로" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "경복궁 아래로" })).toBeDisabled();
  });

  it("빼기를 누르면 이번 여행에서 사라진다", async () => {
    await renderWith(["창경궁", "경복궁"]);
    fireEvent.click(screen.getByRole("button", { name: "창경궁 코스에서 빼기" }));
    expect(screen.queryByRole("link", { name: "창경궁" })).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(TRIP_KEY)!)).toEqual(["경복궁"]);
  });

  it("비우기는 한 번 더 눌러야 지워진다", async () => {
    await renderWith(["경복궁"]);
    fireEvent.click(screen.getByRole("button", { name: "이번 여행 비우기" }));
    expect(screen.queryByRole("link", { name: "경복궁" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "정말 비울까요?" }));
    expect(screen.getByText("이번 여행에 담은 곳이 없어요")).toBeTruthy();
  });

  it("구글지도 경로에 중간 지점이 경유지로 들어간다", async () => {
    await renderWith(["경복궁", "창경궁", "한라산-국립공원"]);
    const href = screen
      .getByRole("link", { name: /구글지도로 전체 경로 열기/ })
      .getAttribute("href")!;
    const params = new URL(href).searchParams;

    expect(params.get("origin")).toBe("37.5796,126.977");
    expect(params.get("destination")).toBe("33.3617,126.5292");
    expect(params.get("waypoints")).toBe("37.5788,126.9953");
  });

  it("한 곳뿐이면 전체 경로 버튼을 내보내지 않는다", async () => {
    await renderWith(["경복궁"]);
    expect(screen.queryByRole("link", { name: /전체 경로/ })).toBeNull();
  });

  it("저장된 곳이 데이터에서 사라져도 나머지는 그대로 보여준다", async () => {
    await renderWith(["없어진-여행지", "경복궁"]);
    expect(screen.getByRole("link", { name: "경복궁" })).toBeTruthy();
  });

  it("가고 싶은 곳에서 담으면 이번 여행에 들어간다", async () => {
    await renderWith([], ["경복궁"]);
    fireEvent.click(screen.getByRole("button", { name: "경복궁 이번 여행에 담기" }));

    expect(JSON.parse(window.localStorage.getItem(TRIP_KEY)!)).toEqual(["경복궁"]);
    // 담아도 가고 싶은 곳에는 그대로 남는다.
    expect(JSON.parse(window.localStorage.getItem(WISHLIST_KEY)!)).toEqual(["경복궁"]);
  });

  it("이미 담은 곳은 담기 목록에 다시 나오지 않는다", async () => {
    await renderWith(["경복궁"], ["경복궁", "창경궁"]);
    expect(screen.queryByRole("button", { name: "경복궁 이번 여행에 담기" })).toBeNull();
    expect(screen.getByRole("button", { name: "창경궁 이번 여행에 담기" })).toBeTruthy();
  });

  it("이번 여행에서 빼도 가고 싶은 곳은 풀리지 않는다", async () => {
    await renderWith(["경복궁"], ["경복궁"]);
    fireEvent.click(screen.getByRole("button", { name: "경복궁 코스에서 빼기" }));

    expect(JSON.parse(window.localStorage.getItem(TRIP_KEY)!)).toEqual([]);
    expect(JSON.parse(window.localStorage.getItem(WISHLIST_KEY)!)).toEqual(["경복궁"]);
  });
});
