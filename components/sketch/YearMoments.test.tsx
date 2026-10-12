import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { YearMoments } from "./YearMoments";

const moments = [
  { key: "first" as const, label: "해의 첫 길", value: "6월 12일", note: "정동진에서" },
  { key: "busiest" as const, label: "하루 최다", value: "50장", note: "9월 14일 · 안목" },
];

describe("YearMoments", () => {
  it("순간들을 한 줄에 이어 보인다 — 이름·값·설명", () => {
    render(<YearMoments moments={moments} />);
    const line = screen.getByLabelText("올해의 순간");
    expect(line.tagName).toBe("P");
    expect(line.textContent).toContain("해의 첫 길 6월 12일(정동진에서)");
    expect(line.textContent).toContain("하루 최다 50장(9월 14일 · 안목)");
  });

  it("순간이 둘 미만이면 줄을 두지 않는다", () => {
    const { container } = render(<YearMoments moments={moments.slice(0, 1)} />);
    expect(container.textContent).toBe("");
  });
});
