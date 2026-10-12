import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({
  user: { id: "u" } as { id: string } | null,
  mine: [] as unknown[],
  submit: "ok" as "ok" | "limit" | "invalid" | "failed",
}));
const submit = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/spotSuggestions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/spotSuggestions")>()),
  fetchMySuggestions: async () => state.mine,
  submitSuggestion: (...args: unknown[]) => (submit(...args), Promise.resolve(state.submit)),
  removeSuggestion: (...args: unknown[]) => (remove(...args), Promise.resolve(true)),
}));
const { SuggestSpot } = await import("./SuggestSpot");

const mineRow = (id: string, status: string, note: string | null = null) => ({ id, userId: "u", name: `곳${id}`, place: null, reason: null, status, adminNote: note, createdAt: "2026-10-01" });
const open = async () => {
  render(<SuggestSpot />);
  fireEvent.click(screen.getByRole("button", { name: "빠진 곳이 있나요? 추천하기" }));
};

beforeEach(() => {
  state.user = { id: "u" };
  state.mine = [];
  state.submit = "ok";
  submit.mockClear();
  remove.mockClear();
});

describe("SuggestSpot · 빠진 곳 추천하기", () => {
  it("로그인하지 않았으면 로그인하라고 하고 입력칸은 없다", async () => {
    state.user = null;
    await open();
    expect(await screen.findByRole("link", { name: "로그인하기" })).toBeTruthy();
    expect(screen.queryByLabelText("곳 이름")).toBeNull();
  });

  it("이름이 비어 있으면 보낼 수 없다", async () => {
    await open();
    const send = await screen.findByRole("button", { name: "추천 보내기" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("곳 이름"), { target: { value: "안목해변" } });
    expect(send).toBeEnabled();
  });

  it("보내면 적은 것을 건네고, 칸을 비우고, 검토한다고 알린다", async () => {
    await open();
    fireEvent.change(await screen.findByLabelText("곳 이름"), { target: { value: "안목해변" } });
    fireEvent.change(screen.getByLabelText(/어디쯤인가요/), { target: { value: "강릉시" } });
    fireEvent.click(screen.getByRole("button", { name: "추천 보내기" }));
    await screen.findByText(/보냈어요/);
    expect(submit).toHaveBeenCalledWith(expect.anything(), "u", { name: "안목해변", place: "강릉시", reason: "" });
    expect((screen.getByLabelText("곳 이름") as HTMLInputElement).value).toBe("");
  });

  it("검토 전 추천이 이미 다섯이면 보낼 수 없다고 말한다", async () => {
    state.mine = [1, 2, 3, 4, 5].map((n) => mineRow(String(n), "new"));
    await open();
    fireEvent.change(await screen.findByLabelText("곳 이름"), { target: { value: "또" } });
    expect(screen.getByRole("button", { name: "추천 보내기" })).toBeDisabled();
  });

  it("서버가 한도라고 하면 이유를 알린다", async () => {
    state.submit = "limit";
    await open();
    fireEvent.change(await screen.findByLabelText("곳 이름"), { target: { value: "곳" } });
    fireEvent.click(screen.getByRole("button", { name: "추천 보내기" }));
    expect(await screen.findByText(/검토 중인 추천이 5건/)).toBeTruthy();
  });

  it("보낸 추천과 처리 결과·메모를 보이고, 검토 전인 것만 거둘 수 있다", async () => {
    state.mine = [mineRow("1", "new"), mineRow("2", "planned", "다음 배포에 넣어요")];
    await open();
    expect(await screen.findByText("검토 중")).toBeTruthy();
    expect(screen.getByText("반영 예정")).toBeTruthy();
    expect(screen.getByText("다음 배포에 넣어요")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "거두기" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "거두기" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith(expect.anything(), "1"));
  });
});
