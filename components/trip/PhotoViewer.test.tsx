import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PhotoViewer } from "./PhotoViewer";

/*
  사진 크게 보기 — 좌우 화살표(단추 · 키보드)와 옆으로 밀기로 넘긴다. 넘길 때 이전 · 지금 · 다음 석 장이 이미 그려져 있어서
  손가락을 따라가고, 새로 불러오는 것을 기다리지 않는다.
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

/** 한 번 밀기 — 누르고, 움직이고, 놓는다. dx 가 음수면 왼쪽으로 민다. */
function swipe(area: HTMLElement, dx: number, dy = 0) {
  fireEvent.pointerDown(area, { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 300 });
  fireEvent.pointerMove(area, { pointerId: 1, pointerType: "touch", clientX: 200 + dx / 2, clientY: 300 + dy / 2 });
  fireEvent.pointerMove(area, { pointerId: 1, pointerType: "touch", clientX: 200 + dx, clientY: 300 + dy });
  fireEvent.pointerUp(area, { pointerId: 1, pointerType: "touch", clientX: 200 + dx, clientY: 300 + dy });
}

const settle = () => act(() => void vi.advanceTimersByTime(250));

beforeEach(() => {
  vi.useFakeTimers();
  // 미리 받아 두는 그림은 시험에서 실제로 받지 않는다.
  vi.stubGlobal(
    "Image",
    class {
      src = "";
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PhotoViewer · 보이는 것", () => {
  it("몇 번째인지 알려 준다 — 1부터", () => {
    open({ current: 0 });
    expect(screen.getByRole("dialog", { name: "사진 1/4 크게 보기" })).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
  });

  it("지금 사진 곁에 이전 · 다음 사진이 이미 그려져 있다 — 넘길 때 새로 불러오지 않는다", () => {
    const { dialog } = open({ current: 1 });
    const slides = [...dialog.querySelectorAll("[data-slide]")];
    expect(slides.map((slide) => slide.getAttribute("data-slide"))).toEqual(["near", "current", "near"]);
    expect(slides.map((slide) => slide.querySelector("img")?.getAttribute("src"))).toEqual([urls[0], urls[1], urls[2]]);
  });

  it("끝에서는 처음과 이어진다 — 처음 사진의 이전은 마지막, 마지막의 다음은 처음", () => {
    const first = open({ current: 0 });
    expect([...first.dialog.querySelectorAll("[data-slide] img")].map((img) => img.getAttribute("src"))).toEqual([urls[3], urls[0], urls[1]]);
    first.unmount();
    const last = open({ current: 3 });
    expect([...last.dialog.querySelectorAll("[data-slide] img")].map((img) => img.getAttribute("src"))).toEqual([urls[2], urls[3], urls[0]]);
  });

  it("한 장뿐이면 옆 장도 화살표도 없다", () => {
    const { dialog } = open({ total: 1, current: 0 });
    expect(dialog.querySelectorAll("[data-slide]")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "다음 사진" })).toBeNull();
    expect(screen.queryByText(/ \/ /)).toBeNull();
  });

  it("잘라내지 않는다 — 세로 사진이 잘리면 찍은 것이 사라진다", () => {
    const { dialog } = open();
    expect(dialog.querySelector('[data-slide="current"] img')!.className).toContain("object-contain");
  });

  it("주소를 아직 못 받았으면 불러오는 중이라고 한다 — 작은 판이 있으면 그것을 먼저 보인다", () => {
    const view = open({ urlAt: () => null });
    expect(screen.getAllByText("불러오는 중…").length).toBeGreaterThan(0);
    view.unmount();

    const withPreview = open({ urlAt: () => null, previewAt: (index) => `https://예시/작은/${index}.jpg` });
    expect(screen.queryByText("불러오는 중…")).toBeNull();
    expect(withPreview.dialog.querySelector('[data-slide="current"] img[data-photo="preview"]')?.getAttribute("src")).toBe("https://예시/작은/1.jpg");
  });

  it("큰 판이 오면 작은 판 위로 겹쳐 보이고, 다 오면 작은 판은 거둔다", () => {
    const { dialog } = open({ previewAt: (index) => `https://예시/작은/${index}.jpg` });
    const current = dialog.querySelector('[data-slide="current"]')!;
    const big = current.querySelector('img[data-photo="big"]')!;
    // 아직 다 오기 전 — 작은 판이 보이고 큰 판은 투명하다.
    expect(current.querySelector('img[data-photo="preview"]')).toBeTruthy();
    expect(big.className).toContain("opacity-0");
    fireEvent.load(big);
    expect(current.querySelector('img[data-photo="preview"]')).toBeNull();
    expect(big.className).not.toContain("opacity-0");
  });
});

describe("PhotoViewer · 화살표", () => {
  it("다음 사진 단추 — 넘어가는 움직임 뒤에 다음 번호를 알린다", () => {
    const { props } = open({ current: 1 });
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(props.onChange).not.toHaveBeenCalled();
    settle();
    expect(props.onChange).toHaveBeenCalledWith(2);
  });

  it("이전 사진 단추", () => {
    const { props } = open({ current: 1 });
    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    settle();
    expect(props.onChange).toHaveBeenCalledWith(0);
  });

  it("끝에서 넘기면 돈다 — 막다른 길이 없다", () => {
    const last = open({ current: 3 });
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    settle();
    expect(last.props.onChange).toHaveBeenCalledWith(0);
    last.unmount();

    const first = open({ current: 0 });
    fireEvent.click(screen.getByRole("button", { name: "이전 사진" }));
    settle();
    expect(first.props.onChange).toHaveBeenCalledWith(3);
  });

  it("키보드 좌우 화살표도 같다", () => {
    const { props } = open({ current: 1 });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    settle();
    expect(props.onChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    settle();
    expect(props.onChange).toHaveBeenLastCalledWith(0);
  });

  it("넘어가는 중에 또 눌러도 한 번만 넘어간다 — 연타로 두 장씩 건너뛰지 않는다", () => {
    const { props } = open({ current: 1 });
    const next = screen.getByRole("button", { name: "다음 사진" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    settle();
    expect(props.onChange).toHaveBeenCalledTimes(1);
  });

  it("넘어가는 중에는 줄이 한 장만큼 밀려 간다", () => {
    const { dialog } = open({ current: 1 });
    const track = dialog.querySelector("[data-track]") as HTMLElement;
    expect(track.style.transform).toContain("-100%");
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(track.style.transform).toContain("-200%");
  });
});

describe("PhotoViewer · 옆으로 밀기", () => {
  it("왼쪽으로 밀면 다음 사진", () => {
    const { props, area } = open({ current: 1 });
    swipe(area, -120);
    settle();
    expect(props.onChange).toHaveBeenCalledWith(2);
  });

  it("오른쪽으로 밀면 이전 사진", () => {
    const { props, area } = open({ current: 1 });
    swipe(area, 120);
    settle();
    expect(props.onChange).toHaveBeenCalledWith(0);
  });

  it("밀고 있는 동안에는 줄이 손가락을 따라가고, 놓으면 넘어간다", () => {
    const { dialog, area } = open({ current: 1 });
    const track = dialog.querySelector("[data-track]") as HTMLElement;
    fireEvent.pointerDown(area, { pointerId: 1, pointerType: "touch", clientX: 200, clientY: 300 });
    fireEvent.pointerMove(area, { pointerId: 1, pointerType: "touch", clientX: 140, clientY: 300 });
    expect(track.style.transform).toContain("-60px");
    // 따라가는 동안에는 움직임을 따로 주지 않는다 — 손가락과 어긋나지 않게.
    expect(track.style.transition).toBe("none");
  });

  it("조금만 밀고 놓으면 제자리로 돌아온다 — 넘기지 않는다", () => {
    const { props, dialog, area } = open({ current: 1 });
    swipe(area, -10);
    settle();
    expect(props.onChange).not.toHaveBeenCalled();
    expect((dialog.querySelector("[data-track]") as HTMLElement).style.transform).toContain("-100%");
  });

  it("위아래로 밀면 넘기지 않는다 — 세로는 브라우저에 맡긴다", () => {
    const { props, area } = open({ current: 1 });
    swipe(area, -20, 200);
    settle();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("한 장뿐이면 밀어도 아무 일도 없다", () => {
    const { props, area } = open({ total: 1, current: 0 });
    swipe(area, -200);
    settle();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("손가락 움직임은 우리가 모두 받는다(touch-action: none) — 두 손가락 확대와 두 번 누르기 확대를 이 화면이 직접 한다", () => {
    const { area } = open();
    expect(area.style.touchAction).toBe("none");
  });

  it("밀고 난 뒤의 클릭은 닫지 않는다 — 넘기다 닫히면 안 된다", () => {
    const { props, dialog, area } = open({ current: 1 });
    swipe(area, -120);
    fireEvent.click(dialog);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});

describe("PhotoViewer · 닫기", () => {
  it("Escape · ✕ · 바깥을 누르면 닫힌다", () => {
    const a = open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(a.props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(a.props.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(a.dialog);
    expect(a.props.onClose).toHaveBeenCalledTimes(3);
  });

  it("사진 자체를 눌러도 닫히지 않는다", () => {
    const { props, dialog } = open();
    fireEvent.click(dialog.querySelector('[data-slide="current"] img')!);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("뒤 화면이 같이 굴러가지 않게 잠그고, 닫으면 풀어 준다", () => {
    const view = open();
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("PhotoViewer · 미리 받기", () => {
  it("앞뒤 몇 장의 그림을 미리 받아 둔다 — 넘기는 순간에는 이미 브라우저에 있다", () => {
    const loaded: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        set src(value: string) {
          loaded.push(value);
        }
      },
    );
    open({ total: 6, current: 2, urlAt: (index) => `https://예시/${index}.jpg` });
    // 지금(2) 곁의 3 · 1, 그 곁의 4 · 0 까지.
    expect(new Set(loaded)).toEqual(new Set(["https://예시/3.jpg", "https://예시/1.jpg", "https://예시/4.jpg", "https://예시/0.jpg"]));
  });

  it("아직 주소를 모르는 장은 건너뛴다", () => {
    const loaded: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        set src(value: string) {
          loaded.push(value);
        }
      },
    );
    open({ total: 4, current: 0, urlAt: (index) => (index === 1 ? "https://예시/1.jpg" : null) });
    expect(loaded).toEqual(["https://예시/1.jpg"]);
  });
});
