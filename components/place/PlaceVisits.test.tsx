import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/placeVisits", () => ({
  fetchVisitsByName: async () => [
    { id: "v2", tripId: "t2", tripTitle: "여름 강릉", placeName: "안목해변", spotId: null, dong: "강원 강릉시", startedAt: "2026-08-13T10:00:00", photoCount: 3 },
    { id: "v1", tripId: "t1", tripTitle: null, placeName: "안목해변", spotId: null, dong: null, startedAt: "2024-05-02T09:00:00", photoCount: 0 },
  ],
}));
vi.mock("@/lib/supabase/photos", () => ({
  fetchPlacePhotos: async () => [
    { id: "p1", visitId: "v2", storagePath: "u/v2/a.webp", takenAt: "" },
  ],
  thumbUrls: async () => new Map([["u/v2/a.webp", "https://예시/a"]]),
  signedUrls: async () => new Map(),
}));
const { PlaceVisits } = await import("./PlaceVisits");

/*
  한 곳을 여러 번 갔으면 그때마다가 해를 건너 한 줄로 이어져야 한다.
*/
describe("PlaceVisits", () => {
  it("같은 이름으로 다녀온 때를 최근부터, 그 여행으로 가는 길과 함께", async () => {
    render(<PlaceVisits name="안목해변" />);
    expect(await screen.findByText("두 번 다녀왔어요 · 사진 3장")).toBeTruthy();
    expect(screen.getByText(/처음 2024년 5월 · 마지막 2026년 8월/)).toBeTruthy();
    const days = screen.getAllByText(/년 \d+월 \d+일$/).map((node) => node.textContent);
    expect(days).toEqual(["2026년 8월 13일", "2024년 5월 2일"]);
    expect(screen.getByRole("link", { name: "여름 강릉 열기 ›" }).getAttribute("href")).toBe("/trips/t2");
    expect(screen.getByText("사진 없이 기록했어요")).toBeTruthy();
  });
});
