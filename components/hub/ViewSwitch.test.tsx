import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewSwitch } from "./ViewSwitch";

/*
  내 여행은 한 화면의 두 모습이다 — 지도와 목록. 지금 어느 쪽인지, 다른 쪽으로 가는
  길이 어디인지가 한눈에 보여야 한다.
*/
describe("ViewSwitch", () => {
  it("지도와 목록을 보이고, 지금 모습이 켜져 있다", () => {
    render(<ViewSwitch view="map" onChange={() => undefined} />);
    expect(screen.getByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "목록" })).toHaveAttribute("aria-checked", "false");
  });

  it("목록이면 목록이 켜진다", () => {
    render(<ViewSwitch view="list" onChange={() => undefined} />);
    expect(screen.getByRole("radio", { name: "목록" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "false");
  });

  it("다른 쪽을 누르면 그쪽으로 바꾼다", () => {
    const onChange = vi.fn();
    render(<ViewSwitch view="map" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "목록" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("이미 켜진 쪽을 눌러도 아무 일이 없다", () => {
    const onChange = vi.fn();
    render(<ViewSwitch view="map" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "지도" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("무엇을 고르는 것인지 이름이 있다", () => {
    render(<ViewSwitch view="map" onChange={() => undefined} />);
    expect(screen.getByRole("radiogroup", { name: "보기 방식" })).toBeTruthy();
  });
});
