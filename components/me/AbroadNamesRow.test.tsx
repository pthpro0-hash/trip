import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({ visits: [] as unknown[], outcome: { checked: 2, renamed: 2, failed: 0 } }));
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } }),
}));
vi.mock("@/lib/supabase/abroadNames", () => ({
  fetchOverseasVisits: async () => state.visits,
  refreshAbroadNames: async (...args: unknown[]) => (refresh(...args), state.outcome),
}));
const { AbroadNamesRow } = await import("./AbroadNamesRow");

const two = [
  { id: "a", placeName: "영국 런던", lat: 51.5, lng: -0.17 },
  { id: "b", placeName: "알 수 없는 곳", lat: 48.86, lng: 2.35 },
];

beforeEach(() => {
  state.visits = two;
  state.outcome = { checked: 2, renamed: 2, failed: 0 };
  refresh.mockClear();
});

describe("AbroadNamesRow", () => {
  it("해외 곳이 없으면 줄을 두지 않는다", async () => {
    state.visits = [];
    const { container } = render(<AbroadNamesRow />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.textContent).toBe("");
  });

  it("해외 곳이 있으면 몇 곳인지 적은 줄이 있다", async () => {
    render(<AbroadNamesRow />);
    expect(await screen.findByText("해외에서 다녀온 2곳을 세부 지역명으로 바꿔요")).toBeTruthy();
  });

  it("누르면 새로 붙이고 몇 곳을 바꿨는지 알린다", async () => {
    render(<AbroadNamesRow />);
    fireEvent.click(await screen.findByRole("button", { name: /해외 장소 이름 새로 붙이기/ }));
    expect(await screen.findByText("2곳의 이름을 세부 지역명으로 바꿨어요.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("바꿀 것이 없으면 그렇게 말하고, 못 한 곳이 있으면 다시 해 보라고 한다", async () => {
    state.outcome = { checked: 2, renamed: 0, failed: 0 };
    render(<AbroadNamesRow />);
    fireEvent.click(await screen.findByRole("button", { name: /해외 장소 이름 새로 붙이기/ }));
    expect(await screen.findByText(/바꿀 이름이 없어요/)).toBeTruthy();

    state.outcome = { checked: 2, renamed: 1, failed: 1 };
    fireEvent.click(screen.getByRole("button", { name: /해외 장소 이름 새로 붙이기/ }));
    await waitFor(() => expect(screen.getByText(/1곳은 조회하지 못했어요/)).toBeTruthy());
  });
});
