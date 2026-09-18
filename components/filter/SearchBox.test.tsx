import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SearchBox } from "./SearchBox";
import type { Spot } from "@/lib/types";

function makeSpot(id: string, name: string): Spot {
  return {
    id,
    name,
    region: "수도권",
    lat: 37.5,
    lng: 127,
    summary: "",
    highlights: [],
    seasons: ["사계절"],
    specialty: [],
    foods: [],
    themes: [],
  };
}

const SPOTS = [makeSpot("a", "경복궁"), makeSpot("b", "경희궁"), makeSpot("c", "남이섬")];

afterEach(() => {
  vi.useRealTimers();
});

describe("SearchBox", () => {
  it("value를 입력값으로 렌더링한다", () => {
    render(<SearchBox value="경복궁" onChange={() => {}} spots={SPOTS} />);
    expect(screen.getByLabelText("검색")).toHaveValue("경복궁");
  });

  it("타이핑이 멈춘 뒤에 onChange를 호출한다 (디바운스)", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} spots={SPOTS} />);

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "경복" } });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onChange).toHaveBeenCalledWith("경복");
  });

  it("입력 중에는 이름이 맞는 곳을 추천한다", () => {
    render(<SearchBox value="" onChange={() => {}} spots={SPOTS} />);
    const input = screen.getByLabelText("검색");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "경" } });

    expect(screen.getByRole("button", { name: /경복궁/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /경희궁/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /남이섬/ })).toBeNull();
  });

  it("추천을 누르면 그 이름으로 바로 검색한다", () => {
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} spots={SPOTS} />);
    const input = screen.getByLabelText("검색");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "남이" } });
    fireEvent.click(screen.getByRole("button", { name: /남이섬/ }));

    expect(onChange).toHaveBeenCalledWith("남이섬");
  });

  it("빈 검색창에 포커스하면 추천 검색어를 보여준다", () => {
    render(<SearchBox value="" onChange={() => {}} spots={SPOTS} />);
    fireEvent.focus(screen.getByLabelText("검색"));
    expect(screen.getByText("이런 걸 찾아보세요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "야경" })).toBeTruthy();
  });
});
