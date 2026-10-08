import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ImportSteps } from "./ImportSteps";

/*
  사진으로 여행을 추가하는 길은 세 걸음이다 — 고르기 · 확인 · 기록. 지금 어디쯤인지, 앞으로 몇 걸음이 남았는지를
  늘 보여 주면 "이거 언제 끝나지?" 하는 불안이 없다.
*/
describe("ImportSteps", () => {
  const items = () =>
    within(screen.getByRole("list", { name: "진행 단계" }))
      .getAllByRole("listitem")
      .map((item) => item.textContent?.replace(/\s+/g, ""));

  it("고르기 · 확인 · 기록, 세 걸음을 순서대로 보인다", () => {
    render(<ImportSteps current={1} />);
    expect(items()).toEqual(["1고르기", "2확인", "3기록"]);
  });

  it("지금 걸음에만 aria-current 를 단다", () => {
    render(<ImportSteps current={2} />);
    const now = screen.getAllByRole("listitem").filter((item) => item.getAttribute("aria-current") === "step");
    expect(now).toHaveLength(1);
    expect(now[0]).toHaveTextContent("확인");
  });

  it("지나온 걸음은 끝났다고 알린다 — 눈이 안 보이는 사람에게도", () => {
    render(<ImportSteps current={3} />);
    const [first, second, third] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("완료");
    expect(second).toHaveTextContent("완료");
    expect(third).not.toHaveTextContent("완료");
    expect(third).toHaveAttribute("aria-current", "step");
  });

  it("아직 오지 않은 걸음에는 끝났다는 말이 없다", () => {
    render(<ImportSteps current={1} />);
    for (const item of screen.getAllByRole("listitem")) expect(item).not.toHaveTextContent("완료");
  });
});
