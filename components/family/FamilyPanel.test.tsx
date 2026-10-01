import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Circle, PendingInvite } from "@/lib/supabase/family";

const state = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  circle: { owned: [], shared: [] } as Circle,
  invites: [] as PendingInvite[],
  token: "T".repeat(43),
}));
const api = vi.hoisted(() => ({
  createInvite: vi.fn(),
  cancelInvite: vi.fn(),
  changeRole: vi.fn(),
  removeLink: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/family", async () => ({
  ...(await vi.importActual<object>("@/lib/supabase/family")),
  fetchCircle: async () => state.circle,
  fetchInvites: async () => state.invites,
  createInvite: api.createInvite,
  cancelInvite: api.cancelInvite,
  changeRole: api.changeRole,
  removeLink: api.removeLink,
}));

const { FamilyPanel } = await import("./FamilyPanel");

const member = (id: string, email: string, role: "view" | "edit" | "full") => ({ id, email, role, since: "2026-10-01T00:00:00Z" });

describe("FamilyPanel", () => {
  beforeEach(() => {
    state.user = { id: "me" };
    state.circle = { owned: [], shared: [] };
    state.invites = [];
    for (const fn of Object.values(api)) fn.mockReset();
    api.createInvite.mockResolvedValue(state.token);
    api.cancelInvite.mockResolvedValue(true);
    api.changeRole.mockResolvedValue(true);
    api.removeLink.mockResolvedValue(true);
  });

  it("로그인하지 않았으면 로그인으로 안내한다", async () => {
    state.user = null;
    render(<FamilyPanel />);
    expect(await screen.findByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=/family");
  });

  it("권한 셋이 한눈에 보이고, 처음에는 '보기만'이 골라져 있다", async () => {
    render(<FamilyPanel />);
    const view = (await screen.findAllByRole("radio", { name: /보기만/ }))[0];
    expect(view).toBeChecked();
    expect(screen.getAllByRole("radio", { name: /수정만/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radio", { name: /추가도 가능/ }).length).toBeGreaterThan(0);
  });

  it("고른 권한으로 초대를 만들고, 링크를 보여 준다", async () => {
    state.invites = [{ token: state.token, role: "edit", expiresAt: "2099-01-01T00:00:00Z" }];
    render(<FamilyPanel />);
    fireEvent.click((await screen.findAllByRole("radio", { name: /수정만/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));
    await waitFor(() => expect(api.createInvite).toHaveBeenCalledWith(expect.anything(), "me", "edit"));
    expect(await screen.findByLabelText("초대 링크")).toHaveValue(`${window.location.origin}/join/${state.token}`);
  });

  it("가족의 권한을 바꾼다", async () => {
    state.circle = { owned: [member("m1", "mom@example.com", "view")], shared: [] };
    render(<FamilyPanel />);
    await screen.findByText("mom@example.com");
    const group = screen.getAllByRole("radiogroup")[1];
    fireEvent.click(group.querySelector("input[value='full']")!);
    await waitFor(() => expect(api.changeRole).toHaveBeenCalledWith(expect.anything(), "me", "m1", "full"));
  });

  it("해제는 한 번 더 묻고, 그때 지운다", async () => {
    state.circle = { owned: [member("m1", "mom@example.com", "view")], shared: [] };
    render(<FamilyPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "가족에서 해제" }));
    expect(api.removeLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "해제" }));
    await waitFor(() => expect(api.removeLink).toHaveBeenCalledWith(expect.anything(), "me", "m1"));
  });

  it("나에게 열어 준 사람에게서는 나가기 — 주인 자리에 그 사람을 넣어 끊는다", async () => {
    state.circle = { owned: [], shared: [member("o1", "dad@example.com", "full")] };
    render(<FamilyPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "나가기" }));
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    await waitFor(() => expect(api.removeLink).toHaveBeenCalledWith(expect.anything(), "o1", "me"));
  });

  it("나에게 열어 준 사람의 [여행 보기]는 그 주인의 여행을 보는 상태로 바꾼다", async () => {
    window.sessionStorage.clear();
    state.circle = { owned: [], shared: [member("o1", "dad@example.com", "edit")] };
    render(<FamilyPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "여행 보기" }));
    expect(JSON.parse(window.sessionStorage.getItem("family-view")!)).toEqual({
      ownerId: "o1",
      label: "dad@example.com",
      role: "edit",
    });
  });

  it("수락 전 초대는 취소할 수 있다", async () => {
    state.invites = [{ token: state.token, role: "view", expiresAt: "2099-01-01T00:00:00Z" }];
    render(<FamilyPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() => expect(api.cancelInvite).toHaveBeenCalledWith(expect.anything(), state.token));
  });

  it("가족이 8명이면 초대 단추 대신 안내가 나온다", async () => {
    state.circle = {
      owned: Array.from({ length: 8 }, (_, i) => member(`m${i}`, `f${i}@example.com`, "view")),
      shared: [],
    };
    render(<FamilyPanel />);
    await screen.findByText("f0@example.com");
    expect(screen.queryByRole("button", { name: "초대 링크 만들기" })).toBeNull();
    expect(screen.getByText(/8명까지 들일 수 있어요/)).toBeTruthy();
  });
});
