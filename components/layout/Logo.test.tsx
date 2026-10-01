import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("파란 타일 위의 흰 점들이다 — 점 다섯, 선 없음, 화면 읽기에서는 감춘다", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("circle")).toHaveLength(5);
    expect(svg.querySelector("rect")).toHaveAttribute("fill", "#0071e3");
    expect(svg.querySelector("line, polyline, path")).toBeNull();
  });
});
