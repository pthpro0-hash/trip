import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YearMoments } from "./YearMoments";

const moments = [
  { key: "first" as const, label: "해의 첫 길", value: "6월 12일", note: "정동진" },
  { key: "busiest" as const, label: "하루 최다", value: "50장", note: "9월 14일 · 안목" },
];

describe("YearMoments", () => {
  it("순간마다 이름·값·설명을 보인다", () => {
    render(<YearMoments moments={moments} />);
    expect(screen.getByRole("region", { name: "올해의 순간" })).toBeTruthy();
    expect(screen.getByText("해의 첫 길")).toBeTruthy();
    expect(screen.getByText("50장")).toBeTruthy();
    expect(screen.getByText("9월 14일 · 안목")).toBeTruthy();
  });

  it("순간이 둘 미만이면 줄을 두지 않는다", () => {
    const { container } = render(<YearMoments moments={moments.slice(0, 1)} />);
    expect(container.textContent).toBe("");
  });
});
