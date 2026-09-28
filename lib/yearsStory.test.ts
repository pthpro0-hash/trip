// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SketchTrip } from "./sketch";
import { YEAR_COLORS, yearColors, yearsStory } from "./yearsStory";

const trip = (id: string, startedOn: string, dong: string, photos = 5, lat = 37.5, lng = 127): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions: null,
  visits: [{ placeName: id, spotId: null, lat, lng, photoCount: photos, dong, photoPath: null }],
});

const sidoOf = (visit: { dong?: string | null }) => visit.dong?.split(" ")[0] ?? null;

const all = [
  trip("a", "2024-05-01", "강원 강릉시", 10, 37.77, 128.95),
  trip("b", "2025-04-01", "강원 속초시", 3, 38.19, 128.6),
  trip("c", "2025-08-01", "제주 제주시", 40, 33.5, 126.95),
  trip("d", "2025-10-01", "부산 해운대구", 2, 35.16, 129.16),
  trip("e", "2026-02-01", "강원 강릉시", 20, 37.77, 128.95),
];

describe("yearColors", () => {
  it("가장 최근 해가 첫 색, 해마다 다른 색", () => {
    const colors = yearColors([2024, 2026, 2025]);
    expect(colors.get(2026)).toBe(YEAR_COLORS[0]);
    expect(new Set(colors.values()).size).toBe(3);
  });

  it("색이 모자라면 돌아서 다시 쓴다", () => {
    const years = Array.from({ length: YEAR_COLORS.length + 1 }, (_, i) => 2000 + i);
    expect(yearColors(years).get(2000)).toBe(YEAR_COLORS[0]);
  });
});

describe("yearsStory", () => {
  const story = yearsStory(all, sidoOf);

  it("해마다 한 줄 — 오래된 해부터", () => {
    expect(story.rows.map((row) => row.year)).toEqual([2024, 2025, 2026]);
    expect(story.rows.map((row) => row.tripCount)).toEqual([1, 3, 1]);
    expect(story.layers.map((layer) => layer.year)).toEqual([2024, 2025, 2026]);
  });

  it("처음 밟은 시도 — 기록의 첫 해는 셈하지 않는다", () => {
    expect(story.rows[0].newSidoCount).toBeNull();
    expect(story.rows[1].newSidoCount).toBe(2); // 제주·부산 (강원은 2024년에 이미)
    expect(story.rows[2].newSidoCount).toBe(0);
    expect(story.sido.sort()).toEqual(["강원", "부산", "제주"]);
  });

  it("견주기 — 가장 많이 떠난 해, 사진을 가장 많이 남긴 해, 처음이 가장 많던 해", () => {
    expect(story.busiest?.year).toBe(2025);
    expect(story.mostPhotos?.year).toBe(2025);
    expect(story.mostNew?.year).toBe(2025);
    expect(story.spanLine).toBe("3년 동안 다섯 번 떠났어요");
  });

  it("같으면 최근 해", () => {
    const tie = yearsStory([trip("x", "2024-01-01", "서울 종로구"), trip("y", "2025-01-01", "서울 종로구")]);
    expect(tie.busiest?.year).toBe(2025);
  });

  it("해가 하나면 견줄 것이 없다", () => {
    const one = yearsStory([trip("x", "2026-01-01", "서울 종로구")]);
    expect(one.busiest).toBeNull();
    expect(one.spanLine).toBe("2026년에 한 번 떠났어요");
  });
});
