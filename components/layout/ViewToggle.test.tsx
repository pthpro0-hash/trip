import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("현재 선택된 탭을 표시한다", () => {
    render(<ViewToggle value="list" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "리스트" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("지도 탭 클릭 시 onChange('map')이 호출된다", () => {
    const onChange = vi.fn();
    render(<ViewToggle value="list" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "지도" }));
    expect(onChange).toHaveBeenCalledWith("map");
  });
});
