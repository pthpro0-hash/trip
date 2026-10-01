import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { FamilyBanner } from "./FamilyBanner";
import { startFamilyView, stopFamilyView } from "@/lib/familyView";

describe("FamilyBanner", () => {
  beforeEach(() => act(() => stopFamilyView()));

  it("내 여행을 볼 때는 없다", () => {
    const { container } = render(<FamilyBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("가족의 여행을 보는 중이면 누구의 것인지와 권한을 알리고, 내 여행으로 돌아가는 길을 둔다", () => {
    render(<FamilyBanner />);
    act(() => startFamilyView({ ownerId: "o1", label: "mom@example.com", role: "edit" }));
    expect(screen.getByRole("status")).toHaveTextContent("mom@example.com");
    expect(screen.getByRole("status")).toHaveTextContent("수정만");
    expect(screen.getByRole("button", { name: "내 여행으로" })).toBeTruthy();
  });
});
