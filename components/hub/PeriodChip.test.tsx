import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodChip } from "./PeriodChip";

/*
  달 막대는 힘 있는 도구지만 처음 보는 사람에게는 시트 머리를 가득 채우는 낯선 그림이었다. 막대를 "기간" 단추 뒤로
  접는다. 단추는 지금 어떤 기간으로 보고 있는지를 말한다 — 접혀 있어도 거른 기간이 있으면 알 수 있어야
  "왜 여행이 이것뿐이지?" 하지 않는다.
*/
describe("PeriodChip", () => {
  it("기간을 고르지 않았으면 '전체'", () => {
    render(<PeriodChip range={null} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: "기간 전체" })).toBeTruthy();
  });

  it("고른 기간을 말한다 — 접혀 있어도", () => {
    render(<PeriodChip range={["2026-01", "2026-06"]} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: "기간 2026.01 ~ 2026.06" })).toBeTruthy();
  });

  it("한 달이면 그 달 하나", () => {
    render(<PeriodChip range={["2026-03", "2026-03"]} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button", { name: "기간 2026.03" })).toBeTruthy();
  });

  it("거른 기간이 있으면 켜진 모습이다 — 전체일 때와 눈으로 가려진다", () => {
    const { rerender } = render(<PeriodChip range={null} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button").className).not.toContain("text-accent");
    rerender(<PeriodChip range={["2026-03", "2026-03"]} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button").className).toContain("text-accent");
  });

  it("펼쳐져 있는지를 알린다", () => {
    const { rerender } = render(<PeriodChip range={null} open={false} onToggle={() => undefined} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    rerender(<PeriodChip range={null} open onToggle={() => undefined} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("누르면 알린다", () => {
    const onToggle = vi.fn();
    render(<PeriodChip range={null} open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
