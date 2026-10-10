import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";

vi.mock("@/lib/curatedData", () => ({
  SPOTS: [
    { id: "경복궁", name: "경복궁", lat: 37.58, lng: 126.97 },
    { id: "북촌", name: "북촌", lat: 37.58, lng: 126.98 },
  ],
}));
vi.mock("@/lib/sido", () => ({
  sidoOf: (visit: { lat: number }) => (visit.lat > 37 ? "서울" : null),
}));
const { Dex } = await import("./Dex");

const trips: SketchTrip[] = [
  { id: "a", startedOn: "2026-05-01", endedOn: "2026-05-01", companions: null, visits: [{ placeName: "경복궁", spotId: "경복궁", lat: 37.58, lng: 126.97, photoCount: 3 }] },
];

describe("Dex · 내 도감", () => {
  it("기록이 없으면 그리지 않는다", () => {
    const { container } = render(<Dex all={[]} />);
    expect(container.textContent).toBe("");
  });

  it("시도 칸과 100선 숫자를 보인다", async () => {
    render(<Dex all={trips} />);
    expect(await screen.findByText("시도 1/17 · 100선 1/2")).toBeTruthy();
    expect(screen.getByText(/서울/, { selector: "li" }).textContent).toContain("다녀옴");
    expect(screen.getByText(/부산/, { selector: "li" }).textContent).toContain("아직");
  });

  it("다녀온 곳은 도장, 빈칸은 그 곳의 100선 상세로 가는 링크다", async () => {
    render(<Dex all={trips} />);
    const group = (await screen.findByText("서울 100선")).closest("details")!;
    expect(within(group).getByText("✓ 경복궁")).toBeTruthy();
    expect(within(group).getByRole("link", { name: "북촌" })).toHaveAttribute("href", `/spots/${encodeURIComponent("북촌")}`);
  });
});
