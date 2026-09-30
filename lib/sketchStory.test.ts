import { describe, it, expect } from "vitest";
import {
  PLACE_FLOOR,
  PLACE_MIN_PHOTOS,
  PLACE_SHOWN,
  notablePlaces,
  tripsOfYear,
  yearFromSearch,
  yearStory,
  yearsOf,
} from "./sketchStory";
import type { SketchDot, SketchTrip } from "./sketch";

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

/*
  한장 요약의 "그해의 곳들". 사진을 10장 이상 남긴 곳을 날짜순으로 늘어놓는다.
  기준을 고정하면 해마다 들쭉날쭉하다 — 어떤 해는 0곳, 어떤 해는 서른 곳. 그래서
  적으면 사진 많은 순으로 채우고, 많으면 위의 열 곳만 먼저 보인다.
*/
const dot = (placeName: string, photoCount: number, lastVisitedOn: string, extra: Partial<SketchDot> = {}): SketchDot => ({
  lat: 37.5,
  lng: 127,
  placeName,
  lastVisitedOn,
  photoPath: `${placeName}.webp`,
  photoCount,
  season: "여름",
  tripId: `trip-${placeName}`,
  ...extra,
});

describe("notablePlaces · 어떤 곳을 보일까", () => {
  it("기준은 사진 10장", () => {
    expect(PLACE_MIN_PHOTOS).toBe(10);
    expect(PLACE_FLOOR).toBe(3);
    expect(PLACE_SHOWN).toBe(10);
  });

  it("10장 이상인 곳만 고른다", () => {
    const places = notablePlaces([
      dot("가", 21, "2026-01-01"),
      dot("나", 4, "2026-02-01"),
      dot("다", 15, "2026-03-01"),
      dot("라", 10, "2026-04-01"),
      dot("마", 9, "2026-05-01"),
      dot("바", 12, "2026-06-01"),
    ]);
    expect(places.map((place) => place.placeName)).toEqual(["가", "다", "라", "바"]);
  });

  it("10장 이상이 3곳 미만이면 사진 많은 순으로 3곳까지 채운다", () => {
    const places = notablePlaces([
      dot("가", 21, "2026-01-01"),
      dot("나", 4, "2026-02-01"),
      dot("다", 2, "2026-03-01"),
      dot("라", 1, "2026-04-01"),
    ]);
    expect(places.map((place) => place.placeName)).toEqual(["가", "나", "다"]);
  });

  it("사진을 하나도 안 남긴 곳은 곳으로 치지 않는다", () => {
    expect(notablePlaces([dot("가", 0, "2026-01-01"), dot("나", 0, "2026-02-01")])).toEqual([]);
    expect(notablePlaces([])).toEqual([]);
  });

  it("곳이 두셋뿐이면 있는 만큼만", () => {
    expect(notablePlaces([dot("가", 5, "2026-01-01")])).toHaveLength(1);
    expect(notablePlaces([dot("가", 5, "2026-01-01"), dot("나", 3, "2026-02-01")])).toHaveLength(2);
  });

  it("날짜순으로 세운다 — 같은 날이면 사진 많은 쪽이 먼저", () => {
    const places = notablePlaces([
      dot("가을", 21, "2026-09-13"),
      dot("봄", 15, "2026-03-02"),
      dot("여름B", 11, "2026-06-10"),
      dot("여름A", 30, "2026-06-10"),
    ]);
    expect(places.map((place) => place.placeName)).toEqual(["봄", "여름A", "여름B", "가을"]);
  });

  it("rank 는 사진 많은 순 — 날짜순으로 세워도 무엇이 1등인지 남는다", () => {
    const places = notablePlaces([
      dot("가을", 21, "2026-09-13"),
      dot("봄", 15, "2026-03-02"),
      dot("여름", 40, "2026-06-10"),
    ]);
    expect(Object.fromEntries(places.map((place) => [place.placeName, place.rank]))).toEqual({
      여름: 0,
      가을: 1,
      봄: 2,
    });
  });

  it("사진 수가 같으면 이름 순으로 rank 를 가른다", () => {
    const places = notablePlaces([dot("나", 12, "2026-01-01"), dot("가", 12, "2026-02-01"), dot("다", 12, "2026-03-01")]);
    expect(places.find((place) => place.rank === 0)?.placeName).toBe("가");
  });

  it("열 곳을 넘으면 rank 10 부터가 '더 보기'", () => {
    const many = Array.from({ length: 13 }, (_, index) =>
      dot(`곳${String(index).padStart(2, "0")}`, 50 - index, `2026-${String((index % 12) + 1).padStart(2, "0")}-01`),
    );
    const places = notablePlaces(many);
    expect(places).toHaveLength(13);
    const shown = places.filter((place) => place.rank < PLACE_SHOWN);
    expect(shown).toHaveLength(10);
    // 먼저 보이는 열 곳은 사진이 가장 많은 열 곳이다.
    expect(Math.min(...shown.map((place) => place.photoCount))).toBeGreaterThan(
      Math.max(...places.filter((place) => place.rank >= PLACE_SHOWN).map((place) => place.photoCount)),
    );
  });

  it("다녀온 횟수를 모르면 1, 알면 그 수", () => {
    const [a, b] = notablePlaces([dot("가", 12, "2026-01-01"), dot("나", 12, "2026-02-01", { visitCount: 3 })]);
    expect(a.visits).toBe(1);
    expect(b.visits).toBe(3);
  });

  it("여행 id 와 대표 사진은 그대로 넘기고, 사진이 없으면 null", () => {
    const [place] = notablePlaces([dot("가", 12, "2026-01-01", { photoPath: null, tripId: "trip-x" })]);
    expect(place.tripId).toBe("trip-x");
    expect(place.photoPath).toBeNull();
  });
});

describe("yearStory · 그해의 곳들", () => {
  const story = yearStory(all, 2026, sidoOf);

  it("사진 많은 곳을 날짜순으로 — 두 번 간 곳은 더한 사진과 횟수, 마지막 여행으로", () => {
    // 10장 이상은 안목해변(62)·우도(12) 둘뿐이라 속초해변(8)까지 채워 셋이 된다.
    expect(story.places.map((place) => place.placeName)).toEqual(["우도", "속초해변", "안목해변"]);
    const 안목 = story.places.find((place) => place.placeName === "안목해변")!;
    expect(안목.photoCount).toBe(62);
    expect(안목.visits).toBe(2);
    expect(안목.tripId).toBe("t4");
    expect(안목.lastVisitedOn).toBe("2026-08-30");
    expect(안목.rank).toBe(0);
  });

  it("그해의 곳만 — 다른 해의 곳은 없다", () => {
    expect(story.places.map((place) => place.placeName)).not.toContain("대천해수욕장");
  });
});

describe("yearFromSearch · 돌아왔을 때 그 해를 그대로", () => {
  it("?y=2025 → 2025", () => {
    expect(yearFromSearch("?y=2025")).toBe(2025);
    expect(yearFromSearch("y=2025&x=1")).toBe(2025);
  });

  it("?y=all → 전체", () => {
    expect(yearFromSearch("?y=all")).toBe("all");
  });

  it("없거나 이상하면 null — 화면이 가장 최근 해를 고른다", () => {
    expect(yearFromSearch("")).toBeNull();
    expect(yearFromSearch("?y=abc")).toBeNull();
    expect(yearFromSearch("?y=20255")).toBeNull();
    expect(yearFromSearch("?y=1800")).toBeNull();
    expect(yearFromSearch("?z=2025")).toBeNull();
  });
});
