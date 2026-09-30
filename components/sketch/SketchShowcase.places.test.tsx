import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";
import { tripFocus } from "@/lib/scrollMemory";

const { markerUrls } = vi.hoisted(() => ({
  markerUrls: vi.fn(async (_supabase: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://핀/${path}`]))),
}));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/photos", () => ({ markerUrls, thumbUrls: async () => new Map() }));
// 카드가 사진을 그림 글자로 바꾸느라 주소를 실제로 부르지 않게 한다.
vi.mock("@/lib/photo/inlinePhoto", () => ({ inlinePhoto: async () => null, inlinePhotos: async () => new Map() }));
const { SketchShowcase } = await import("./SketchShowcase");

const trips: SketchTrip[] = [
  {
    id: "t1",
    startedOn: "2026-08-13",
    endedOn: "2026-08-14",
    companions: null,
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: null, photoPath: "a.webp" },
      { placeName: "속초해변", spotId: null, lat: 38.19, lng: 128.6, photoCount: 8, dong: null, photoPath: "b.webp" },
    ],
  },
];

const show = (year = 2026) =>
  render(<SketchShowcase year={year} all={trips} written={undefined} onWrite={async () => true} sidoOf={undefined} />);

describe("SketchShowcase · 그해의 곳들", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    markerUrls.mockClear();
  });

  it("카드 아래에 곳을 늘어놓고, 누르면 그 여행 상세로 간다", () => {
    show();
    const row = screen.getByText("안목해변").closest("li")!;
    expect(within(row).getByRole("link")).toHaveAttribute("href", "/trips/t1");
    expect(screen.getByText("그해의 곳들")).toBeTruthy();
  });

  it("줄의 사진은 핀용 작은 판이다 — 큰 판을 줄마다 받지 않는다", async () => {
    const { container } = show();
    await waitFor(() => expect(container.querySelector("li img")?.getAttribute("src")).toBe("https://핀/a.webp"));
    // 곳 목록이 요청한 것: 보이는 곳 모두의 대표 사진.
    expect(markerUrls.mock.calls.some(([, paths]) => paths.includes("a.webp") && paths.includes("b.webp"))).toBe(true);
  });

  it("누르면 보던 해의 한장 요약으로 돌아올 길을 적어 둔다", () => {
    show(2026);
    const link = within(screen.getByText("안목해변").closest("li")!).getByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(tripFocus.from()).toBe("/sketch?y=2026");
  });
});
