import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
vi.mock("./HelpDialog", () => ({ HelpDialog: () => <p>사용법 창</p> }));

const { FirstVisitHelp } = await import("./FirstVisitHelp");

describe("FirstVisitHelp · 받는 쪽", () => {
  beforeEach(() => window.localStorage.clear());

  it("처음 온 사람에게는 사용법 창을 낸다", async () => {
    path = "/";
    render(<FirstVisitHelp />);
    expect(await screen.findByText("사용법 창")).toBeTruthy();
  });

  it("가족 우편함의 받는 쪽(부모님)에게는 내지 않는다 — 엽서를 받은 사람이지 처음 온 사람이 아니다", async () => {
    path = "/m/abc/p/def";
    render(<FirstVisitHelp />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("사용법 창")).toBeNull();
  });
});
