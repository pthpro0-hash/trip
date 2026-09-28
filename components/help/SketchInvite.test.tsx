import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const client = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => client }));
const count = vi.fn();
vi.mock("@/lib/supabase/trips", () => ({ countTrips: (...args: unknown[]) => count(...args) }));
const { SketchInvite } = await import("./SketchInvite");

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem("seen:help", "1");
  client.auth.getUser.mockReset();
  count.mockReset();
});

describe("SketchInvite", () => {
  it("로그인 전이면 — 사진만 올리면 무엇이 되는지와, 로그인하고 시작하기", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null } });
    render(<SketchInvite spot="home" />);
    expect(await screen.findByRole("dialog", { name: "내 스케치 안내" })).toBeTruthy();
    expect(screen.getByText("여행 사진 수백 장, 올리기만 하세요")).toBeTruthy();
    expect(screen.getByText(/한장 요약/)).toBeTruthy();
    expect(screen.getByText("로그인하고 사진만 올리면 끝!")).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인하고 시작하기" }).getAttribute("href")).toBe("/login?next=%2Ftrips%2Fnew");
  });

  it("로그인했지만 여행이 없으면 — 사진 올리러 가기", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    count.mockResolvedValue(0);
    render(<SketchInvite spot="home" />);
    expect(await screen.findByRole("link", { name: "사진 올리러 가기" })).toBeTruthy();
  });

  it("이미 쓰고 있는 사람에게는 내밀지 않는다 — 셀 수 없을 때도", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    count.mockResolvedValue(3);
    const first = render(<SketchInvite spot="home" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    count.mockResolvedValue(null);
    render(<SketchInvite spot="sketch" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("오늘 그만 보기를 누르면 닫히고, 내 스케치에 들어와도 오늘은 다시 뜨지 않는다", async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null } });
    const first = render(<SketchInvite spot="home" />);
    fireEvent.click(await screen.findByRole("button", { name: "오늘 그만 보기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    render(<SketchInvite spot="sketch" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("사용법 창이 떠 있으면 기다렸다가, 닫히면 이어서 뜬다", async () => {
    window.localStorage.removeItem("seen:help");
    client.auth.getUser.mockResolvedValue({ data: { user: null } });
    render(<SketchInvite spot="home" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
    window.localStorage.setItem("seen:help", "1");
    window.dispatchEvent(new Event("help:closed"));
    expect(await screen.findByRole("dialog", { name: "내 스케치 안내" })).toBeTruthy();
  });
});
