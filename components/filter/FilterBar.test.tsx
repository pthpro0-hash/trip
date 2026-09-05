import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "./FilterBar";

describe("FilterBar", () => {
  it("6개 권역 체크박스를 렌더링한다", () => {
    render(<FilterBar criteria={{}} onChange={() => {}} />);
    expect(screen.getByLabelText("수도권")).toBeTruthy();
    expect(screen.getByLabelText("제주권")).toBeTruthy();
  });

  it("권역을 선택하면 onChange가 갱신된 조건으로 호출된다", () => {
    const onChange = vi.fn();
    render(<FilterBar criteria={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("경상권"));
    expect(onChange).toHaveBeenCalledWith({ regions: ["경상권"] });
  });

  it("이미 선택된 권역을 다시 클릭하면 선택이 해제된다", () => {
    const onChange = vi.fn();
    render(<FilterBar criteria={{ regions: ["경상권"] }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("경상권"));
    expect(onChange).toHaveBeenCalledWith({ regions: [] });
  });

  it("필터 토글 버튼은 접힌 상태로 시작하며 클릭하면 펼침 상태로 전환된다", () => {
    render(<FilterBar criteria={{}} onChange={() => {}} />);
    const toggleButton = screen.getByRole("button", { name: /필터/ });
    expect(toggleButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggleButton);
    expect(toggleButton.getAttribute("aria-expanded")).toBe("true");
  });
});
