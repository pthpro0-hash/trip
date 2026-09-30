import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
const { StorageTidy } = await import("./StorageTidy");

/*
  보관함 정리는 이제 도움말에 있다 — 로그인하지 않은 사람도 그 페이지를 연다. 누르고
  아무 일도 없으면 고장난 단추로 보인다.
*/
describe("StorageTidy · 로그인 전", () => {
  it("보관함 살펴보기를 누르면 로그인이 필요하다고 말한다", async () => {
    render(<StorageTidy />);
    fireEvent.click(screen.getByRole("button", { name: "보관함 살펴보기" }));
    expect(await screen.findByText("로그인해야 보관함을 살펴볼 수 있어요.")).toBeTruthy();
  });
});
