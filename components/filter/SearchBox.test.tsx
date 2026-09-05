import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBox } from "./SearchBox";

describe("SearchBox", () => {
  it("value를 입력값으로 렌더링한다", () => {
    render(<SearchBox value="경복궁" onChange={() => {}} />);
    expect(screen.getByLabelText("검색")).toHaveValue("경복궁");
  });

  it("입력하면 onChange가 새 값으로 호출된다", () => {
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "설렁탕" } });
    expect(onChange).toHaveBeenCalledWith("설렁탕");
  });
});
