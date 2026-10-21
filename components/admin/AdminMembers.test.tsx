import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { readFamilyView, stopFamilyView } from "@/lib/familyView";

/*
  관리자 — 회원 목록. 등급은 한 번 더 묻고 바꾸고, "이 계정 보기"는 기록을 남긴 뒤 보기 전용으로 연다.
*/

const api = vi.hoisted(() => ({
  fetchMembers: vi.fn(),
  setMemberGrade: vi.fn(),
  logAccountView: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/grade", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/grade")>()),
  ...api,
}));

const { AdminMembers } = await import("./AdminMembers");

const member = {
  id: "u1",
  email: "kim@example.com",
  createdAt: "2026-10-01T00:00:00Z",
  lastSignInAt: "2026-10-20T00:00:00Z",
  grade: 4 as const,
  photoCount: 312,
  tripCount: 7,
  pendingTo: 3 as const,
};

describe("AdminMembers", () => {
  beforeEach(() => {
    act(() => stopFamilyView());
    api.fetchMembers.mockReset().mockResolvedValue({ members: [member], more: false });
    api.setMemberGrade.mockReset().mockResolvedValue(true);
    api.logAccountView.mockReset().mockResolvedValue(true);
  });

  it("이메일·사용량·검토 전 등업 신청을 보인다", async () => {
    render(<AdminMembers />);
    expect(await screen.findByText("kim@example.com")).toBeTruthy();
    expect(screen.getByText(/여행 7건 · 사진 312 \/ 500장/)).toBeTruthy();
    expect(screen.getByText("등업 신청 1,000장")).toBeTruthy();
  });

  it("등급은 고른 뒤 한 번 더 묻고 바꾼다", async () => {
    render(<AdminMembers />);
    const select = await screen.findByLabelText("kim@example.com 등급");
    fireEvent.change(select, { target: { value: "2" } });
    expect(api.setMemberGrade).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("4등급 · 500장 → 2등급 · 2,000장으로 바꿀까요?");
    fireEvent.click(screen.getByRole("button", { name: "바꾸기" }));
    await waitFor(() => expect(api.setMemberGrade).toHaveBeenCalledWith(expect.anything(), "u1", 2));
  });

  it("이 계정 보기 — 기록을 남기지 못하면 열지 않는다", async () => {
    api.logAccountView.mockResolvedValue(false);
    render(<AdminMembers />);
    fireEvent.click(await screen.findByRole("button", { name: "이 계정 보기" }));
    expect(await screen.findByText(/기록을 남기지 못해 열지 않았어요/)).toBeTruthy();
    expect(readFamilyView()).toBeNull();
  });

  it("이 계정 보기 — 기록을 남기면 보기 전용 관리자 보기로 연다", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, set href(value: string) { assign(value); } } });
    try {
      render(<AdminMembers />);
      fireEvent.click(await screen.findByRole("button", { name: "이 계정 보기" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/?v=sketch"));
      expect(readFamilyView()).toEqual({ ownerId: "u1", label: "kim@example.com", role: "view", admin: true });
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });
});
