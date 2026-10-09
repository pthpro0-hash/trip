import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const launch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/photo/launch", () => ({ launchPicker: launch }));
const { AddPhotosLink } = await import("./AddPhotosLink");

/* [사진 고르기]는 링크 모양 그대로이되, 그냥 누르면 사진첩이 곧바로 열린다. */
describe("AddPhotosLink", () => {
  const show = (onClick?: () => void) => {
    render(<AddPhotosLink href="/trips/new" onClick={onClick}>사진 고르기</AddPhotosLink>);
    return screen.getByRole("link", { name: "사진 고르기" });
  };
  const press = (link: HTMLElement, init: object = {}) => {
    // 이동은 jsdom 이 못 하니 마지막에 막는다.
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener("click", stop);
    fireEvent.click(link, init);
    document.removeEventListener("click", stop);
  };

  it("주소는 그대로 /trips/new 다", () => {
    expect(show()).toHaveAttribute("href", "/trips/new");
  });

  it("그냥 누르면 사진첩을 연다", () => {
    launch.mockClear();
    press(show());
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("새 창으로 열려는 클릭(키를 누른)은 평소 링크다", () => {
    launch.mockClear();
    press(show(), { ctrlKey: true });
    press(screen.getByRole("link"), { metaKey: true });
    expect(launch).not.toHaveBeenCalled();
  });

  it("부르는 쪽의 onClick 도 함께 돈다", () => {
    const own = vi.fn();
    press(show(own));
    expect(own).toHaveBeenCalled();
  });
});
