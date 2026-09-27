import { describe, it, expect } from "vitest";
import { tripsOfYear, yearStory, yearsOf } from "./sketchStory";
import type { SketchTrip } from "./sketch";

const trip = (
  id: string,
  startedOn: string,
  visits: { name: string; lat: number; lng: number; photos: number; path?: string; dong?: string }[],
  companions: string | null = null,
): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions,
  visits: visits.map((v) => ({
    placeName: v.name,
    spotId: null,
    lat: v.lat,
    lng: v.lng,
    photoCount: v.photos,
    dong: v.dong ?? null,
    photoPath: v.path ?? null,
  })),
});

// 시도는 법정동 맨 앞 칸으로 가리는 셈을 흉내 낸다.
const sidoOf = (visit: { dong?: string | null }) => visit.dong?.split(" ")[0] ?? null;

const 강릉 = { name: "안목해변", lat: 37.77, lng: 128.95, photos: 31, path: "a.webp", dong: "강원 강릉시" };
const 속초 = { name: "속초해변", lat: 38.19, lng: 128.6, photos: 8, path: "b.webp", dong: "강원 속초시" };
const 제주 = { name: "우도", lat: 33.5, lng: 126.95, photos: 12, path: "c.webp", dong: "제주 제주시" };
const 대천 = { name: "대천해수욕장", lat: 36.3, lng: 126.5, photos: 6, path: "d.webp", dong: "충남 보령시" };

const all = [
  trip("t1", "2025-07-25", [대천]),
  trip("t2", "2026-04-10", [제주]),
  trip("t3", "2026-08-13", [강릉, 속초]),
  trip("t4", "2026-08-30", [강릉], "민수"),
];

describe("yearsOf · tripsOfYear", () => {
  it("기록에 있는 해를 최근 해부터", () => {
    expect(yearsOf(all)).toEqual([2026, 2025]);
  });

  it("그해 여행만", () => {
    expect(tripsOfYear(all, 2026).map((t) => t.id)).toEqual(["t2", "t3", "t4"]);
  });
});

describe("yearStory", () => {
  const story = yearStory(all, 2026, sidoOf);

  it("그해 숫자를 센다", () => {
    expect(story.tripCount).toBe(3);
    expect(story.photoCount).toBe(12 + 31 + 8 + 31);
  });

  it("사진을 가장 많이 남긴 곳 — 같은 곳에 두 번 가면 더한다", () => {
    expect(story.topPlace?.placeName).toBe("안목해변");
    expect(story.topPlace?.photoCount).toBe(62);
  });

  it("대표 사진은 많이 찍은 곳부터, 여섯 장까지", () => {
    expect(story.photoPaths[0]).toBe("a.webp");
    expect(story.photoPaths.length).toBeLessThanOrEqual(6);
  });

  it("계절은 봄·여름·가을·겨울 순서 그대로 두고, 가장 많은 계절을 말한다", () => {
    expect(story.seasons.map((s) => s.season)).toEqual(["봄", "여름", "가을", "겨울"]);
    expect(story.seasons.find((s) => s.season === "여름")?.trips).toBe(2);
    expect(story.seasonLine).toBe("여름에 가장 많이 떠났어요");
  });

  it("그해 처음 밟은 시도 — 작년에 간 충남은 빼고", () => {
    expect(story.sido.sort()).toEqual(["강원", "제주"]);
    expect(story.firstSido?.sort()).toEqual(["강원", "제주"]);
  });

  it("작년과 견준다", () => {
    expect(story.compare?.previousYear).toBe(2025);
    expect(story.compare?.tripsLine).toBe("2025년보다 두 번 더 떠났어요");
    expect(story.compare?.photosLine).toBe("사진은 76장 더 남겼어요");
  });

  it("함께한 사람을 센다", () => {
    expect(story.companions).toEqual([{ label: "민수", count: 1 }]);
  });
});

describe("yearStory · 기록의 첫 해", () => {
  const first = yearStory(all, 2025, sidoOf);

  /*
    기록의 첫 해에는 모든 곳이 "처음"이다. 그 말은 아무것도 알려 주지
    않으므로 아예 셈하지 않는다.
  */
  it("처음 밟은 시도를 셈하지 않는다", () => {
    expect(first.firstSido).toBeNull();
    expect(first.sido).toEqual(["충남"]);
  });

  it("견줄 해가 없다", () => {
    expect(first.compare).toBeNull();
  });
});

describe("yearStory · 말", () => {
  it("계절이 같으면 둘 다 말한다", () => {
    const story = yearStory([trip("a", "2026-04-01", [대천]), trip("b", "2026-10-01", [제주])], 2026);
    expect(story.seasonLine).toBe("봄과 가을에 가장 많이 떠났어요");
  });

  it("네 계절이 다 같으면 '가장'이 아니다", () => {
    const story = yearStory(
      [
        trip("a", "2026-04-01", [대천]),
        trip("b", "2026-07-01", [대천]),
        trip("c", "2026-10-01", [대천]),
        trip("d", "2026-12-01", [대천]),
      ],
      2026,
    );
    expect(story.seasonLine).toBe("계절마다 고르게 떠났어요");
  });

  it("작년보다 덜 떠났으면 덜", () => {
    const story = yearStory([trip("a", "2025-04-01", [대천]), trip("b", "2025-05-01", [대천]), trip("c", "2026-04-01", [대천])], 2026);
    expect(story.compare?.tripsLine).toBe("2025년보다 한 번 덜 떠났어요");
  });

  it("같으면 같다고", () => {
    const story = yearStory([trip("a", "2025-04-01", [대천]), trip("c", "2026-04-01", [대천])], 2026);
    expect(story.compare?.tripsLine).toBe("2025년과 같이 한 번 떠났어요");
    expect(story.compare?.photosLine).toBeNull();
  });

  it("바로 앞 해가 비면 그 앞의 가장 가까운 해와 견준다", () => {
    const story = yearStory([trip("a", "2023-04-01", [대천]), trip("c", "2026-04-01", [대천])], 2026);
    expect(story.compare?.previousYear).toBe(2023);
  });

  it("사진을 하나도 안 올렸으면 가장 많이 찍은 곳도 없다", () => {
    const story = yearStory([trip("a", "2026-04-01", [{ ...대천, photos: 0, path: undefined }])], 2026);
    expect(story.topPlace).toBeNull();
    expect(story.photoPaths).toEqual([]);
  });

  it("시도 셈이 없으면 시도 장면을 비운다", () => {
    const story = yearStory(all, 2026);
    expect(story.sido).toEqual([]);
  });
});
