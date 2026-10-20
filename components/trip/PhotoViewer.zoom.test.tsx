import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PhotoViewer } from "./PhotoViewer";

/*
  사진 확대. 옆으로 미는 것을 받으려고 사진 영역의 터치 동작을 막았더니 두 손가락 확대와 두 번 누르기 확대가 함께 막혀 버렸다(실제 겪은 일).
  이제 이 화면이 직접 확대한다 — 두 손가락 · 두 번 누르기 · 확대 단추 · 휠 · 키.
*/
const urls = ["https://예시/0.jpg", "https://예시/1.jpg", "https://예시/2.jpg", "https://예시/3.jpg"];

function open(over: Partial<Parameters<typeof PhotoViewer>[0]> = {}) {
  const props = {
    total: urls.length,
    current: 1,
    urlAt: (index: number) => urls[index] ?? null,
    onChange: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  const view = render(<PhotoViewer {...props} />);
  const dialog = screen.getByRole("dialog");
  const area = dialog.firstElementChild as HTMLElement;
  return { ...view, props, dialog, area };
}

const settle = () => act(() => void vi.advanceTimersByTime(250));

// jsdom 에는 배치가 없다. 화면 400×800 안에 사진이 400×300 으로 놓인 것으로 한다(가운데가 좌표 0,0).
const size = (name: "clientWidth" | "clientHeight" | "offsetWidth" | "offsetHeight", value: number) =>
  vi.spyOn(HTMLElement.prototype, name, "get").mockReturnValue(value);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
  size("clientWidth", 400);
  size("clientHeight", 800);
  size("offsetWidth", 400);
  size("offsetHeight", 300);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const scaleOf = (dialog: HTMLElement) => Number(dialog.querySelector("[data-zoom]")!.getAttribute("data-zoom"));
const styleOf = (dialog: HTMLElement) => (dialog.querySelector("[data-zoom]") as HTMLElement).style.transform;
const touch = { pointerType: "touch" };
const tap = (area: HTMLElement, x: number, y: number, id = 1) => {
  fireEvent.pointerDown(area, { pointerId: id, ...touch, clientX: x, clientY: y });
  fireEvent.pointerUp(area, { pointerId: id, ...touch, clientX: x, clientY: y });
};
const doubleTap = (area: HTMLElement, x: number, y: number) => {
  tap(area, x, y);
  tap(area, x, y);
};
/** 두 손가락을 댄다(가운데 0,0 에서 좌우 gap 만큼). */
const pinchStart = (area: HTMLElement, gap = 50) => {
  fireEvent.pointerDown(area, { pointerId: 1, ...touch, clientX: -gap, clientY: 0 });
  fireEvent.pointerDown(area, { pointerId: 2, ...touch, clientX: gap, clientY: 0 });
};
const pinchTo = (area: HTMLElement, x: number) => fireEvent.pointerMove(area, { pointerId: 2, ...touch, clientX: x, clientY: 0 });
const pinchEnd = (area: HTMLElement, x2: number, x1 = -50) => {
  fireEvent.pointerUp(area, { pointerId: 2, ...touch, clientX: x2, clientY: 0 });
  fireEvent.pointerUp(area, { pointerId: 1, ...touch, clientX: x1, clientY: 0 });
};

describe("PhotoViewer · 확대", () => {
  it("처음에는 원래 크기다", () => {
    const { dialog } = open();
    expect(scaleOf(dialog)).toBe(1);
  });

  it("손가락 움직임을 모두 우리가 받는다(touch-action: none) — 브라우저에 맡기면 확대가 막힌다", () => {
    const { area } = open();
    expect(area.style.touchAction).toBe("none");
  });

  it("두 번 누르면 그 자리가 커지고, 눌렀던 곳이 제자리에 머문다", () => {
    const { dialog, area } = open();
    doubleTap(area, 50, 20);
    expect(scaleOf(dialog)).toBe(2.5);
    // 눌렀던 점이 손가락 아래에 그대로 있도록 사진이 눌린 곳의 반대로 (배율-1)만큼 밀린다. 세로는 확대한 사진(750)이 화면(800)보다 작아 가운데에 둔다.
    expect(styleOf(dialog)).toContain("translate3d(-75px, 0px, 0) scale(2.5)");
  });

  it("키워 있을 때 두 번 누르면 원래대로", () => {
    const { dialog, area } = open();
    doubleTap(area, 50, 20);
    doubleTap(area, 10, 10);
    expect(scaleOf(dialog)).toBe(1);
  });

  it("한 번만 누르면 확대하지 않는다 — 멀리 떨어진 자리를 이어 눌러도 두 번 누름이 아니다", () => {
    const { dialog, area } = open();
    tap(area, 50, 20);
    expect(scaleOf(dialog)).toBe(1);
    tap(area, 300, 300);
    expect(scaleOf(dialog)).toBe(1);
  });

  it("한 장뿐이어도 확대된다", () => {
    const { dialog, area } = open({ total: 1, current: 0 });
    doubleTap(area, 0, 0);
    expect(scaleOf(dialog)).toBe(2.5);
  });

  it("확대 단추로도 키우고 되돌린다 — 컴퓨터에서 마우스로", () => {
    const { dialog } = open();
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(scaleOf(dialog)).toBe(2.5);
    fireEvent.click(screen.getByRole("button", { name: "원래 크기로" }));
    expect(scaleOf(dialog)).toBe(1);
  });

  it("두 손가락을 벌리면 확대한다", () => {
    const { dialog, area } = open();
    pinchStart(area);
    pinchTo(area, 150);
    // 간격 100 → 200 이니 두 배.
    expect(scaleOf(dialog)).toBe(2);
    pinchTo(area, 250);
    expect(scaleOf(dialog)).toBeCloseTo(3, 5);
    pinchEnd(area, 250);
    expect(scaleOf(dialog)).toBeCloseTo(3, 5);
  });

  it("너무 크게는 못 키운다 — 5배까지", () => {
    const { dialog, area } = open();
    pinchStart(area, 10);
    pinchTo(area, 400);
    expect(scaleOf(dialog)).toBe(5);
  });

  it("오므려 원래보다 작아져도 놓으면 원래 크기로 붙는다", () => {
    const { dialog, area } = open();
    pinchStart(area);
    pinchTo(area, 20);
    pinchEnd(area, 20);
    settle();
    expect(scaleOf(dialog)).toBe(1);
    expect(styleOf(dialog)).toContain("translate3d(0px, 0px, 0) scale(1)");
  });

  it("확대한 동안 한 손가락은 사진을 끌어 옮기고, 옆 사진으로 넘기지 않는다", () => {
    const { props, dialog, area } = open();
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    fireEvent.pointerDown(area, { pointerId: 1, ...touch, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(area, { pointerId: 1, ...touch, clientX: 140, clientY: 270 });
    // 세로로는 사진(750)이 화면(800)보다 작아 옮길 수 없다.
    expect(styleOf(dialog)).toContain("translate3d(-60px, 0px, 0) scale(2.5)");
    fireEvent.pointerUp(area, { pointerId: 1, ...touch, clientX: 140, clientY: 270 });
    settle();
    expect(props.onChange).not.toHaveBeenCalled();
    expect(scaleOf(dialog)).toBe(2.5);
  });

  it("사진을 가장자리 밖으로는 끌지 못한다 — 사진이 화면에서 달아나지 않게", () => {
    const { dialog, area } = open();
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    fireEvent.pointerDown(area, { pointerId: 1, ...touch, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(area, { pointerId: 1, ...touch, clientX: 5000, clientY: 5000 });
    // 사진 400×300 을 2.5 배 → 1000×750. 화면 400×800 이라 가로는 300 까지, 세로는 사진이 화면보다 작아 0.
    expect(styleOf(dialog)).toContain("translate3d(300px, 0px, 0) scale(2.5)");
  });

  it("확대한 동안에는 이전·다음 화살표를 거둔다 — 끌다가 넘어가지 않게", () => {
    open();
    expect(screen.getByRole("button", { name: "다음 사진" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(screen.queryByRole("button", { name: "다음 사진" })).toBeNull();
  });

  it("다른 사진으로 넘어가면 확대가 풀린다", () => {
    const view = open({ current: 1 });
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    expect(scaleOf(view.dialog)).toBe(2.5);
    view.rerender(<PhotoViewer {...view.props} current={2} />);
    expect(scaleOf(view.dialog)).toBe(1);
  });

  it("확대한 뒤에도 키보드 화살표로 넘길 수 있다 — 컴퓨터에서", () => {
    const { props } = open({ current: 1 });
    fireEvent.click(screen.getByRole("button", { name: "확대" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    settle();
    expect(props.onChange).toHaveBeenCalledWith(2);
  });

  it("휠로 커서 아래를 중심으로 확대·축소한다", () => {
    const { dialog, area } = open();
    fireEvent.wheel(area, { deltaY: -200, clientX: 40, clientY: 0 });
    expect(scaleOf(dialog)).toBeGreaterThan(1);
    fireEvent.wheel(area, { deltaY: 5000, clientX: 40, clientY: 0 });
    expect(scaleOf(dialog)).toBe(1);
  });

  it("키보드 + − 0", () => {
    const { dialog } = open();
    fireEvent.keyDown(window, { key: "+" });
    expect(scaleOf(dialog)).toBeCloseTo(1.5, 5);
    fireEvent.keyDown(window, { key: "+" });
    expect(scaleOf(dialog)).toBeCloseTo(2.25, 5);
    fireEvent.keyDown(window, { key: "-" });
    expect(scaleOf(dialog)).toBeCloseTo(1.5, 5);
    fireEvent.keyDown(window, { key: "0" });
    expect(scaleOf(dialog)).toBe(1);
  });

  it("확대하다 놓은 뒤의 클릭이 사진 뷰어를 닫지 않는다", () => {
    const { props, dialog, area } = open();
    pinchStart(area);
    pinchTo(area, 150);
    pinchEnd(area, 150);
    fireEvent.click(dialog);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("두 손가락을 대면 하던 옆으로 밀기는 접는다 — 넘어가지 않는다", () => {
    const { props, area } = open({ current: 1 });
    fireEvent.pointerDown(area, { pointerId: 1, ...touch, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(area, { pointerId: 1, ...touch, clientX: 120, clientY: 300 });
    fireEvent.pointerDown(area, { pointerId: 2, ...touch, clientX: 260, clientY: 300 });
    fireEvent.pointerUp(area, { pointerId: 2, ...touch, clientX: 260, clientY: 300 });
    fireEvent.pointerUp(area, { pointerId: 1, ...touch, clientX: 120, clientY: 300 });
    settle();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
