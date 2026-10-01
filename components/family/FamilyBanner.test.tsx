import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { readFamilyView, startFamilyView, stopFamilyView } from "@/lib/familyView";

const circle = vi.hoisted(() => ({ value: "failed" as "failed" | { owned: []; shared: { id: string; email: string; role: string; since: string }[] } }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/family", () => ({ fetchCircle: async () => circle.value }));

const { FamilyBanner } = await import("./FamilyBanner");

const mine = { ownerId: "o1", label: "mom@example.com", role: "edit" as const };

describe("FamilyBanner", () => {
  beforeEach(() => {
    act(() => stopFamilyView());
    circle.value = "failed";
  });

  it("내 여행을 볼 때는 없다", () => {
    const { container } = render(<FamilyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("가족의 여행을 보는 중이면 누구의 것인지와 권한을 알리고, 내 여행으로 돌아가는 길을 둔다", () => {
    render(<FamilyBanner />);
    act(() => startFamilyView(mine));
    expect(screen.getByRole("status")).toHaveTextContent("mom@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("수정만");
    expect(screen.getByRole("button", { name: "내 여행으로" })).toBeTruthy();
  });

  it("그 사이 주인이 권한을 바꿨으면 띠와 단추가 새 권한을 따른다", async () => {
    circle.value = { owned: [], shared: [{ id: "o1", email: "mom@example.com", role: "full", since: "" }] };
    render(<FamilyBanner />);
    act(() => startFamilyView(mine));
    await waitFor(() => expect(readFamilyView()?.role).toBe("full"));
    expect(screen.getByRole("status")).toHaveTextContent("추가도 가능");
  });

  it("확인하지 못했으면(네트워크) 그대로 둔다", async () => {
    render(<FamilyBanner />);
    act(() => startFamilyView(mine));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readFamilyView()).toEqual(mine);
  });
});
