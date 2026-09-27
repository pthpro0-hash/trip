import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useHydrated } from "./useHydrated";

/*
  서버가 그린 것과 처음 그린 것이 다르면 React 는 고쳐 주지 않는다.

  그래서 저장소에서 읽은 것을 처음부터 그리면 안 된다. 이 고리는 서버
  몫의 답을 따로 내놓아, 처음 한 번은 서버와 똑같이 그리게 한다.
*/
function Probe() {
  return <span>{useHydrated() ? "붙었다" : "아직"}</span>;
}

describe("useHydrated", () => {
  it("서버에서 그릴 때는 아직이라고 답한다", () => {
    expect(renderToStaticMarkup(<Probe />)).toContain("아직");
  });

  it("화면에 붙고 나면 붙었다고 답한다", () => {
    render(<Probe />);
    expect(screen.getByText("붙었다")).toBeTruthy();
  });
});
