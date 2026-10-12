import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const state = vi.hoisted(() => ({ user: { id: "a" } as { id: string } | null, admin: true, list: [] as unknown[] }));
const setStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/spotSuggestions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/spotSuggestions")>()),
  isAdmin: async () => state.admin,
  fetchAllSuggestions: async () => state.list,
  setSuggestionStatus: (...args: unknown[]) => (setStatus(...args), Promise.resolve(true)),
}));
const { AdminSuggestions } = await import("./AdminSuggestions");

const item = (id: string, name: string, status = "new") => ({ id, userId: "u", name, place: "강릉시", reason: "커피 거리", status, adminNote: null, createdAt: "2026-10-01T00:00:00Z" });

beforeEach(() => {
  state.user = { id: "a" };
  state.admin = true;
  state.list = [item("1", "안목해변"), item("2", "정동진", "planned")];
  setStatus.mockClear();
});

describe("AdminSuggestions · 추천 관리", () => {
  it("관리자가 아니면 권한이 없다고 하고 아무것도 읽지 않는다", async () => {
    state.admin = false;
    render(<AdminSuggestions />);
    expect(await screen.findByText("이 화면을 볼 권한이 없어요.")).toBeTruthy();
    expect(screen.queryByText("안목해변")).toBeNull();
  });

  it("로그인하지 않았어도 마찬가지다", async () => {
    state.user = null;
    render(<AdminSuggestions />);
    expect(await screen.findByText("이 화면을 볼 권한이 없어요.")).toBeTruthy();
  });

  it("추천을 보여 주고 전체·검토 전 수를 말한다", async () => {
    render(<AdminSuggestions />);
    expect(await screen.findByText("전체 2건 · 검토 전 1건")).toBeTruthy();
    expect(screen.getByText("안목해변")).toBeTruthy();
    expect(screen.getAllByText("커피 거리")).toHaveLength(2);
  });

  it("상태와 메모를 정해 저장한다 — 바꾸기 전에는 저장할 수 없다", async () => {
    render(<AdminSuggestions />);
    const save = (await screen.findAllByRole("button", { name: "저장" }))[0];
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("안목해변 상태"), { target: { value: "planned" } });
    fireEvent.change(screen.getByLabelText("안목해변 메모"), { target: { value: "다음 배포에" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(expect.anything(), "1", "planned", "다음 배포에"));
  });

  it("추천이 없으면 없다고 말한다", async () => {
    state.list = [];
    render(<AdminSuggestions />);
    expect(await screen.findByText("아직 받은 추천이 없어요.")).toBeTruthy();
  });
});
