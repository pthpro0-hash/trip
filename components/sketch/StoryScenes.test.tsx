import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { YearStory } from "@/lib/sketchStory";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));
const { StoryScenes } = await import("./StoryScenes");

const full: YearStory = {
  year: 2026,
  tripCount: 3,
  placeCount: 4,
  photoCount: 82,
  distanceKm: 690,
  distanceWords: "서울에서 부산까지를 두 번 오갈 거리",
  topPlace: {
    lat: 37.77,
    lng: 128.95,
    placeName: "안목해변",
    lastVisitedOn: "2026-08-30",
    photoPath: "a.webp",
    photoCount: 62,
    season: "여름",
    tripId: "t4",
  },
  seasons: [
    { season: "봄", trips: 1 },
    { season: "여름", trips: 2 },
    { season: "가을", trips: 0 },
    { season: "겨울", trips: 0 },
  ],
  seasonLine: "여름에 가장 많이 떠났어요",
  photoPaths: ["a.webp", "c.webp"],
  sido: ["제주", "강원"],
  firstSido: ["제주"],
  compare: { previousYear: 2025, tripsLine: "2025년보다 두 번 더 떠났어요", photosLine: "사진은 76장 더 남겼어요" },
  companions: [{ label: "민수", count: 1 }],
};

describe("StoryScenes", () => {
  it("숫자를 말로 옮긴다", () => {
    render(<StoryScenes story={full} photoUrls={new Map()} />);
    expect(screen.getByText("세 번")).toBeTruthy();
    expect(screen.getByText("82장")).toBeTruthy();
    expect(screen.getByText("서울에서 부산까지를 두 번 오갈 거리")).toBeTruthy();
  });

  it("장면을 차례로 그린다", () => {
    render(<StoryScenes story={full} photoUrls={new Map()} />);
    for (const label of ["2026년의 나", "사진을 가장 많이 남긴 곳", "계절", "밟은 시도 2곳", "그해의 사진", "2025년과 견주면", "누구와", "지도에서 보기"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("시도는 지도 차례로 늘어놓고, 처음 밟은 곳을 표시하고, 조사를 받침에 맞춘다", () => {
    render(<StoryScenes story={full} photoUrls={new Map()} />);
    const chips = screen.getAllByRole("listitem").map((li) => li.textContent);
    // 강원이 제주보다 먼저다 — 북에서 남으로.
    expect(chips.indexOf("강원")).toBeLessThan(chips.findIndex((c) => c?.startsWith("제주")));
    expect(screen.getByText("제주를 처음 밟았어요")).toBeTruthy();
  });

  it("그해를 지도에서 보는 길을 낸다", () => {
    render(<StoryScenes story={full} photoUrls={new Map()} />);
    expect(screen.getByRole("link", { name: /2026년을 지도에서 보기/ })).toHaveAttribute(
      "href",
      "/?v=sketch&y=2026",
    );
  });

  /*
    할 말이 없는 장면은 그리지 않는다. 빈칸을 보여 주며 탓하지 않는다.
  */
  it("할 말이 없는 장면은 그리지 않는다", () => {
    render(
      <StoryScenes
        story={{
          ...full,
          distanceKm: 0,
          topPlace: null,
          photoPaths: [],
          sido: [],
          firstSido: null,
          compare: null,
          companions: [],
        }}
        photoUrls={new Map()}
      />,
    );
    for (const label of ["사진을 가장 많이 남긴 곳", "그해의 사진", "2025년과 견주면", "누구와"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.queryByText(/밟은 시도/)).toBeNull();
    expect(screen.queryByText(/km$/)).toBeNull();
  });

  it("기록의 첫 해에는 '처음'이라고 하지 않는다", () => {
    render(<StoryScenes story={{ ...full, firstSido: null }} photoUrls={new Map()} />);
    expect(screen.queryByText(/처음/)).toBeNull();
  });
});
