import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/trip/StorageTidy", () => ({ StorageTidy: () => <p>보관함 정리 자리</p> }));
vi.mock("@/components/layout/ScrollTop", () => ({ ScrollTop: () => null }));
const { default: HelpPage } = await import("./page");

/*
  사진 보관함 정리는 예전에 여행 목록(/trips) 맨 아래에 있었다. 목록이 내 여행 화면의
  한 모습이 되면서 그 자리를 잃었고, 자주 쓸 일이 아니라 도움말의 "내 데이터"에 둔다.
  찾으러 온 사람은 목차부터 보므로 목차에도 있어야 한다.
*/
describe("HelpPage · 내 데이터", () => {
  it("보관함 정리가 도움말에 있다", () => {
    render(<HelpPage />);
    expect(screen.getByText("보관함 정리 자리")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /내 데이터/ })).toBeTruthy();
  });

  it("목차에서 바로 간다", () => {
    render(<HelpPage />);
    const toc = screen.getByRole("navigation", { name: "목차" });
    const link = Array.from(toc.querySelectorAll("a")).find((a) => a.textContent?.includes("내 데이터"));
    expect(link).toHaveAttribute("href", "#data");
    expect(document.getElementById("data")).toBeTruthy();
  });
});
