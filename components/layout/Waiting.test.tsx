import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Waiting, WaitingOverlay } from "./Waiting";

/*
  기다리게 할 때 반드시 나와야 하는 말이 있다.

  무엇을 하고 있는지와 기다려 달라는 말. 이 둘이 빠지면 사람은 멈춘 줄
  알고 다시 누르거나 자리를 뜬다.
*/
describe("Waiting", () => {
  it("무엇을 하는지와 기다려 달라는 말을 함께 낸다", () => {
    render(<Waiting title="사진을 읽고 있어요" />);
    expect(screen.getByText("사진을 읽고 있어요")).toBeTruthy();
    expect(screen.getByText("잠시만 기다려 주세요.")).toBeTruthy();
  });

  it("어디까지 왔는지 셀 수 있으면 함께 적는다", () => {
    render(<Waiting title="사진을 읽고 있어요" detail="12장 / 300장" note="아직 올라가지 않았어요." />);
    expect(screen.getByText("12장 / 300장")).toBeTruthy();
    expect(screen.getByText("아직 올라가지 않았어요.")).toBeTruthy();
  });

  it("셀 수 없으면 숫자 자리를 비워 둔다", () => {
    const { container } = render(<Waiting title="여행을 지우고 있어요" />);
    // 고리 · 제목 · 기다려 달라는 말, 셋뿐이다.
    expect(container.firstElementChild?.children).toHaveLength(3);
  });

  /*
    읽어 주는 기계도 알아야 한다. 화면을 못 보는 사람에게는 이 알림이
    "지금 무슨 일이 일어나는 중"이라는 유일한 단서다.
  */
  it("읽어 주는 기계에 알린다", () => {
    render(<Waiting title="불러오고 있어요" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("덮는 안내도 같은 말을 낸다", () => {
    render(<WaitingOverlay title="사진을 올리고 있어요" detail="3장 / 100장" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("사진을 올리고 있어요")).toBeTruthy();
    expect(screen.getByText("3장 / 100장")).toBeTruthy();
    expect(screen.getByText("잠시만 기다려 주세요.")).toBeTruthy();
  });
});
