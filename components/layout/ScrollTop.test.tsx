import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollTop } from "./ScrollTop";

/*
  폰에서는 하단 탭이 아래를 덮는다. 아래 구석에 떠 있는 이 단추가 탭 밑에 깔리면
  눌리지 않으므로, 탭이 차지한 높이(--bottom-nav-h)만큼 올려 둔다. 넓은 화면에서는
  그 값이 0 이라 예전 자리(아래 20px)와 같다.
*/
describe("ScrollTop", () => {
  it("하단 탭 높이만큼 올려 둔다", () => {
    render(<ScrollTop />);
    expect(screen.getByRole("button", { name: "맨 위로" }).className).toContain(
      "bottom-[calc(1.25rem+var(--bottom-nav-h,0px))]",
    );
  });

  it("다른 단추가 떠 있는 화면(raised)에서는 넓은 화면에서만 한 칸 더 올린다", () => {
    render(<ScrollTop raised />);
    const className = screen.getByRole("button", { name: "맨 위로" }).className;
    // 폰에서는 그 단추가 없으므로 하단 탭 위에 붙는다.
    expect(className).toContain("bottom-[calc(1.25rem+var(--bottom-nav-h,0px))]");
    expect(className).toContain("sm:bottom-[76px]");
  });
});
