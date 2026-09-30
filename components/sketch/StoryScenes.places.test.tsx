import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { StoryPlace, YearStory } from "@/lib/sketchStory";
import { tripFocus } from "@/lib/scrollMemory";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));
const { StoryScenes } = await import("./StoryScenes");

/*
  "그해의 곳들" — 카드의 점에 이름을 붙여 날짜순으로 늘어놓는다. 곳을 누르면 그
  여행의 상세로 가고, 링크로 받은 사람에게는 눌러도 갈 곳이 없다.
*/

const base: YearStory = {
  year: 2026,
  tripCount: 3,
  placeCount: 3,
  photoCount: 90,
  distanceKm: 0,
  distanceWords: null,
  topPlace: null,
  places: [],
  seasons: [
    { season: "봄", trips: 0 },
    { season: "여름", trips: 0 },
    { season: "가을", trips: 0 },
    { season: "겨울", trips: 0 },
  ],
  seasonLine: null,
  photoPaths: [],
  sido: [],
  firstSido: null,
  compare: null,
  companions: [],
};

const place = (name: string, rank: number, extra: Partial<StoryPlace> = {}): StoryPlace => ({
  placeName: name,
  photoCount: 50 - rank,
  photoPath: `${name}.webp`,
  lastVisitedOn: `2026-${String((rank % 12) + 1).padStart(2, "0")}-05`,
  visits: 1,
  tripId: `trip-${name}`,
  rank,
  ...extra,
});

const 우도 = place("우도", 1, { photoCount: 12, photoPath: "c.webp", lastVisitedOn: "2026-04-10", tripId: "t2" });
const 안목 = place("안목해변", 0, {
  photoCount: 62,
  photoPath: "a.webp",
  lastVisitedOn: "2026-08-30",
  visits: 2,
  tripId: "t4",
});

const withPlaces = (places: StoryPlace[]): YearStory => ({ ...base, places });
const rowOf = (name: string) => screen.getByText(name).closest("li")!;

describe("StoryScenes · 그해의 곳들", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("곳마다 이름·날짜·사진 수를 적는다", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} />);
    expect(within(rowOf("우도")).getByText("4월 10일 · 사진 12장")).toBeTruthy();
  });

  it("여러 번 간 곳은 마지막으로 간 날을 밝히고 횟수를 말한다", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} />);
    const row = rowOf("안목해변");
    expect(within(row).getByText("마지막 8월 30일 · 사진 62장")).toBeTruthy();
    expect(within(row).getByText("두 번 다녀왔어요")).toBeTruthy();
    // 한 번 간 곳에는 횟수를 말하지 않는다.
    expect(within(rowOf("우도")).queryByText(/다녀왔어요/)).toBeNull();
  });

  it("사진을 가장 많이 남긴 곳에만 표시한다", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} />);
    expect(screen.getAllByText("가장 많이 찍은 곳")).toHaveLength(1);
    expect(within(rowOf("안목해변")).getByText("가장 많이 찍은 곳")).toBeTruthy();
  });

  it("곳이 하나뿐이면 표시하지 않는다 — 혼자서는 '가장'이 아니다", () => {
    render(<StoryScenes story={withPlaces([place("우도", 0)])} photoUrls={new Map()} />);
    expect(screen.queryByText("가장 많이 찍은 곳")).toBeNull();
  });

  it("누르면 그 여행의 상세로 간다", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} />);
    expect(within(rowOf("우도")).getByRole("link")).toHaveAttribute("href", "/trips/t2");
    expect(within(rowOf("안목해변")).getByRole("link")).toHaveAttribute("href", "/trips/t4");
  });

  it("누르면 돌아올 곳을 적어 둔다 — 보던 해의 한장 요약", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} backHref="/sketch?y=2026" />);
    const link = within(rowOf("우도")).getByRole("link");
    // 실제로 이동하지는 않는다.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(tripFocus.from()).toBe("/sketch?y=2026");
  });

  it("돌아올 곳을 안 주면 아무것도 적지 않는다", () => {
    render(<StoryScenes story={withPlaces([우도, 안목])} photoUrls={new Map()} />);
    const link = within(rowOf("우도")).getByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(tripFocus.from()).toBeNull();
  });

  it("작은 사진 주소가 있으면 그것만 쓴다 — 큰 판을 열 장씩 받지 않게", () => {
    const { container } = render(
      <StoryScenes
        story={withPlaces([우도, 안목])}
        photoUrls={new Map([["a.webp", "https://큰/a"]])}
        placeUrls={
          new Map([
            ["a.webp", "https://작은/a"],
            ["c.webp", "https://작은/c"],
          ])
        }
      />,
    );
    const shown = [...container.querySelectorAll("li img")].map((img) => img.getAttribute("src"));
    expect(shown).toEqual(["https://작은/c", "https://작은/a"]);
  });

  it("작은 사진 주소를 안 주면 큰 판 주소로 그린다 — 링크로 받은 화면", () => {
    const { container } = render(
      <StoryScenes
        story={withPlaces([{ ...안목, tripId: "" }])}
        photoUrls={new Map([["a.webp", "https://공개/a"]])}
        shared
      />,
    );
    expect(container.querySelector("li img")?.getAttribute("src")).toBe("https://공개/a");
  });

  it("사진이 없는 줄은 핀 자리표시를 둔다 — 다른 줄에는 사진이 있을 때", () => {
    render(
      <StoryScenes
        story={withPlaces([place("있는곳", 0), place("없는곳", 1, { photoPath: null })])}
        photoUrls={new Map()}
        placeUrls={new Map([["있는곳.webp", "https://작은/x"]])}
      />,
    );
    expect(within(rowOf("없는곳")).getByText("📍")).toBeTruthy();
  });

  it("사진이 아예 없으면(지도만·사진 없이 가져옴) 사진 자리 없이 글로만 늘어놓는다", () => {
    const { container } = render(
      <StoryScenes
        story={withPlaces([place("가", 0, { photoPath: null }), place("나", 1, { photoPath: null })])}
        photoUrls={new Map()}
      />,
    );
    expect(container.querySelectorAll("li img")).toHaveLength(0);
    expect(screen.queryByText("📍")).toBeNull();
  });

  describe("열 곳이 넘으면", () => {
    const many = Array.from({ length: 13 }, (_, index) => place(`곳${String(index).padStart(2, "0")}`, index));
    const items = () => within(screen.getAllByRole("list")[0]).getAllByRole("listitem");

    it("사진 많은 열 곳만 먼저 보이고 '더 보기'로 나머지를 편다", () => {
      render(<StoryScenes story={withPlaces(many)} photoUrls={new Map()} />);
      expect(items()).toHaveLength(10);
      expect(screen.queryByText("곳10")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "3곳 더 보기" }));
      expect(items()).toHaveLength(13);
      expect(screen.getByText("곳12")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "접기" }));
      expect(items()).toHaveLength(10);
    });

    it("열 곳 이하면 '더 보기'가 없다", () => {
      render(<StoryScenes story={withPlaces(many.slice(0, 10))} photoUrls={new Map()} />);
      expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
    });
  });

  describe("링크로 받은 화면", () => {
    const received: StoryPlace[] = [
      { placeName: "우도", photoCount: 12, photoPath: "k1-0.webp", lastVisitedOn: "2026-04", visits: 1, tripId: "", rank: 1 },
      { placeName: "안목해변", photoCount: 62, photoPath: null, lastVisitedOn: "2026-09", visits: 1, tripId: "", rank: 0 },
    ];

    it("눌러도 갈 곳이 없다 — 내 여행 상세는 남에게 열리지 않는다", () => {
      render(<StoryScenes story={withPlaces(received)} photoUrls={new Map()} shared />);
      expect(within(rowOf("우도")).queryByRole("link")).toBeNull();
      expect(within(rowOf("안목해변")).queryByRole("link")).toBeNull();
    });

    it("날짜는 달까지만 적는다", () => {
      render(<StoryScenes story={withPlaces(received)} photoUrls={new Map()} shared />);
      expect(within(rowOf("우도")).getByText("4월 · 사진 12장")).toBeTruthy();
      expect(within(rowOf("안목해변")).getByText("9월 · 사진 62장")).toBeTruthy();
      expect(screen.queryByText(/마지막/)).toBeNull();
    });
  });
});
