import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthBars, monthShown } from "./MonthBars";

/*
  막대 위를 쓸면 기간이 골라진다. 손가락 처리는 눈으로 읽어서는 맞는지
  모른다 — 여기서 못 박는다.
*/
const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
const totals = new Map([
  ["2025-11", 4],
  ["2026-01", 20],
  ["2026-03", 8],
]);

/** 막대 줄을 폭 500px 로 친다. 한 막대에 100px. */
function 막대줄() {
  const row = screen.getByRole("group");
  row.getBoundingClientRect = () => ({ left: 0, width: 500, top: 0, height: 36 }) as DOMRect;
  row.setPointerCapture = () => undefined;
  return row;
}

describe("MonthBars", () => {
  it("쓸어서 기간을 고른다 — 손을 떼야 알린다", () => {
    const onRange = vi.fn();
    render(<MonthBars months={months} totals={totals} range={null} onRange={onRange} />);
    const row = 막대줄();

    fireEvent.pointerDown(row, { clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(row, { clientX: 350, pointerId: 1 });
    // 끄는 동안에는 지도를 흔들지 않는다.
    expect(onRange).not.toHaveBeenCalled();
    fireEvent.pointerUp(row, { clientX: 350, pointerId: 1 });

    expect(onRange).toHaveBeenCalledWith(["2025-12", "2026-02"]);
  });

  it("거꾸로 쓸어도 앞뒤가 맞다", () => {
    const onRange = vi.fn();
    render(<MonthBars months={months} totals={totals} range={null} onRange={onRange} />);
    const row = 막대줄();

    fireEvent.pointerDown(row, { clientX: 450, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 50, pointerId: 1 });

    expect(onRange).toHaveBeenCalledWith(["2025-11", "2026-03"]);
  });

  it("톡 치면 그 달 하나, 다시 치면 푼다", () => {
    const onRange = vi.fn();
    const { rerender } = render(
      <MonthBars months={months} totals={totals} range={null} onRange={onRange} />,
    );
    let row = 막대줄();
    fireEvent.pointerDown(row, { clientX: 250, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 250, pointerId: 1 });
    expect(onRange).toHaveBeenLastCalledWith(["2026-01", "2026-01"]);

    rerender(<MonthBars months={months} totals={totals} range={["2026-01", "2026-01"]} onRange={onRange} />);
    row = 막대줄();
    fireEvent.pointerDown(row, { clientX: 250, pointerId: 1 });
    fireEvent.pointerUp(row, { clientX: 250, pointerId: 1 });
    expect(onRange).toHaveBeenLastCalledWith(null);
  });

  it("해 이름을 누르면 그해 전체", () => {
    const onRange = vi.fn();
    render(<MonthBars months={months} totals={totals} range={null} onRange={onRange} />);

    fireEvent.click(screen.getByRole("button", { name: "2026" }));
    expect(onRange).toHaveBeenCalledWith(["2026-01", "2026-03"]);
  });

  it("고른 기간이 있으면 무엇을 골랐는지 적고 푸는 길을 둔다", () => {
    const onRange = vi.fn();
    render(<MonthBars months={months} totals={totals} range={["2025-12", "2026-02"]} onRange={onRange} />);

    fireEvent.click(screen.getByRole("button", { name: /2025.12 ~ 2026.02 · 풀기/ }));
    expect(onRange).toHaveBeenCalledWith(null);
  });

  /*
    시트의 머리는 끌면 시트가 오르내린다. 막대를 쓸다가 시트가 따라
    움직이면 안 된다.
  */
  it("시트 끌기에 걸리지 않게 표시해 둔다", () => {
    const { container } = render(
      <MonthBars months={months} totals={totals} range={null} onRange={() => {}} />,
    );
    expect(container.querySelector("[data-no-drag]")).toBeTruthy();
  });
});

describe("monthShown", () => {
  it("막대가 스무 개 남짓까지는 달마다 다 적는다", () => {
    for (let month = 1; month <= 12; month += 1) expect(monthShown(month, 18)).toBe(true);
  });

  it("더 많으면 1·4·7·10월만", () => {
    expect([1, 2, 3, 4, 7, 10, 12].map((m) => monthShown(m, 30))).toEqual([true, false, false, true, true, true, false]);
  });

  it("아주 많으면 1월만", () => {
    expect(monthShown(1, 60)).toBe(true);
    expect(monthShown(4, 60)).toBe(false);
  });
});

describe("MonthBars · 달 숫자", () => {
  it("막대 아래에 달 숫자가 붙고, 고른 달은 강조된다", () => {
    const { container } = render(
      <MonthBars months={months} totals={totals} range={["2026-01", "2026-02"]} onRange={() => {}} />,
    );
    const labels = [...container.querySelectorAll('[aria-hidden="true"] > span')];
    expect(labels.map((label) => label.textContent)).toEqual(["11", "12", "1", "2", "3"]);
    expect(labels[2].className).toContain("text-accent");
    expect(labels[0].className).not.toContain("text-accent");
  });
});
