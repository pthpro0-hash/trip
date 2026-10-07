import { describe, it, expect } from "vitest";
import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { lastYearLabel, lastYearToday, shelfYears, yearPhotoUrls, yearSteps, yearTitle, yearTotals } from "./mailboxShelf";
import { tripsPerMonth } from "./footprint";

const card = (id: string, over: Partial<InboxCard> = {}): InboxCard => ({
  id: id.repeat(43).slice(0, 43),
  senderName: "지민",
  title: id,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  places: [],
  cover: null,
  photoCount: 0,
  greeting: "",
  sentAt: "2026-10-02T09:00:00",
  opened: true,
  replies: [],
  ...over,
});

describe("shelfYears · 해별 책꽂이", () => {
  it("해마다 한 칸 — 새 해가 위, 같은 해 안에서는 최근에 다녀온 책이 먼저", () => {
    const years = shelfYears([
      card("A", { startedOn: "2025-04-01" }),
      card("B", { startedOn: "2026-02-10" }),
      card("C", { startedOn: "2026-09-13" }),
      card("D", { startedOn: "2025-12-24" }),
    ]);
    expect(years.map((entry) => entry.year)).toEqual(["2026", "2025"]);
    expect(years[0].cards.map((entry) => entry.title)).toEqual(["C", "B"]);
    expect(years[1].cards.map((entry) => entry.title)).toEqual(["D", "A"]);
  });

  it("책꽂이에는 열어 본 책만 — 안 열어 본 엽서는 위의 '새 엽서'에 있다", () => {
    const years = shelfYears([card("A", { opened: false }), card("B", { opened: true })]);
    expect(years).toHaveLength(1);
    expect(years[0].cards.map((entry) => entry.title)).toEqual(["B"]);
    expect(shelfYears([card("A", { opened: false })])).toEqual([]);
  });

  it("다녀온 날을 모르면 보낸 날의 해로, 그것도 모르면 맨 아래 '날짜 모름'", () => {
    const years = shelfYears([
      card("A", { startedOn: "", sentAt: "2024-05-01T00:00:00" }),
      card("B", { startedOn: "", sentAt: "" }),
      card("C", { startedOn: "2026-09-13" }),
    ]);
    expect(years.map((entry) => entry.year)).toEqual(["2026", "2024", ""]);
  });

  it("엽서가 없으면 빈 목록", () => {
    expect(shelfYears([])).toEqual([]);
  });
});

describe("yearTitle", () => {
  it("'2026년 · 7권', 날짜를 모르면 '날짜 모름 · 2권'", () => {
    expect(yearTitle("2026", 7)).toBe("2026년 · 7권");
    expect(yearTitle("", 2)).toBe("날짜 모름 · 2권");
  });
});

describe("lastYearToday · 작년 오늘", () => {
  const today = "2026-10-07";

  it("작년 오늘이 여행 기간 안에 든 책", () => {
    const found = lastYearToday([card("A", { startedOn: "2025-10-05", endedOn: "2025-10-07" })], today);
    expect(found?.card.title).toBe("A");
    expect(found?.yearsAgo).toBe(1);
  });

  it("기간 밖이어도 앞뒤 3일 안이면 — 시작보다 3일 일찍, 끝난 뒤 3일까지", () => {
    expect(lastYearToday([card("A", { startedOn: "2025-10-10", endedOn: "2025-10-11" })], today)?.card.title).toBe("A");
    expect(lastYearToday([card("A", { startedOn: "2025-10-01", endedOn: "2025-10-04" })], today)?.card.title).toBe("A");
    expect(lastYearToday([card("A", { startedOn: "2025-10-11", endedOn: "2025-10-12" })], today)).toBeNull();
    expect(lastYearToday([card("A", { startedOn: "2025-09-30", endedOn: "2025-10-03" })], today)).toBeNull();
  });

  it("올해 다녀온 책은 '작년'이 아니다", () => {
    expect(lastYearToday([card("A", { startedOn: "2026-10-05", endedOn: "2026-10-06" })], today)).toBeNull();
  });

  it("여러 권이면 오늘에 가장 가까운 책, 같으면 더 최근 해", () => {
    const near = card("N", { startedOn: "2025-10-09", endedOn: "2025-10-09" });
    const exact = card("E", { startedOn: "2024-10-06", endedOn: "2024-10-08" });
    expect(lastYearToday([near, exact], today)?.card.title).toBe("E");
    expect(lastYearToday([near, exact], today)?.yearsAgo).toBe(2);

    const older = card("O", { startedOn: "2023-10-07", endedOn: "2023-10-07" });
    const recent = card("R", { startedOn: "2025-10-07", endedOn: "2025-10-07" });
    expect(lastYearToday([older, recent], today)?.card.title).toBe("R");
  });

  it("해를 넘기는 여행도 맞춘다 — 12월 30일에 떠나 1월 2일에 돌아온 책은 1월 1일의 '작년 오늘'", () => {
    const found = lastYearToday([card("A", { startedOn: "2025-12-30", endedOn: "2026-01-02" })], "2027-01-01");
    expect(found?.card.title).toBe("A");
    expect(found?.yearsAgo).toBe(1);
  });

  it("끝난 날을 모르면 시작한 날 하루로 본다", () => {
    expect(lastYearToday([card("A", { startedOn: "2025-10-07", endedOn: "" })], today)?.card.title).toBe("A");
  });

  it("오늘을 모르거나(서버가 그린 첫 그림) 엽서가 없으면 없다", () => {
    expect(lastYearToday([card("A", { startedOn: "2025-10-07" })], "")).toBeNull();
    expect(lastYearToday([], today)).toBeNull();
  });

  it("날짜를 못 읽는 책은 건너뛴다", () => {
    expect(lastYearToday([card("A", { startedOn: "", endedOn: "" })], today)).toBeNull();
  });

  it("말은 '작년 오늘', 두 해 전부터는 'N년 전 오늘'", () => {
    expect(lastYearLabel(1)).toBe("작년 오늘");
    expect(lastYearLabel(3)).toBe("3년 전 오늘");
  });
});

describe("올해 지도의 재료", () => {
  const place = (placeName: string, day: string, over: Record<string, unknown> = {}) => ({
    placeName,
    lat: 35,
    lng: 127,
    day,
    photoCount: 1,
    photo: "a.webp",
    ...over,
  });
  const a = card("A", { photoCount: 3, places: [place("오동도", "2026-10-05"), place("향일암", "2026-10-06", { photo: null, photoCount: 0 })] });
  const b = card("B", { photoCount: 2, places: [place("안목해변", "2026-02-10")] });

  it("곳을 날짜순으로 — 책이 달라도 날짜가 먼저", () => {
    const steps = yearSteps([a, b]);
    expect(steps.map((step) => step.placeName)).toEqual(["안목해변", "오동도", "향일암"]);
    expect(steps.map((step) => [step.month, step.day])).toEqual([
      [2, 10],
      [10, 5],
      [10, 6],
    ]);
  });

  it("눌러서 갈 여행은 없고, 책마다 한 여행으로 센다", () => {
    const steps = yearSteps([a, b]);
    expect(steps.map((step) => step.tripId)).toEqual([b.id, a.id, a.id]);
    expect(tripsPerMonth(steps)[9]).toBe(1);
    expect(tripsPerMonth(steps)[1]).toBe(1);
  });

  it("대표 사진 키는 '엽서 주소/파일' — 책마다 같은 파일 이름(a.webp)이 있어도 섞이지 않는다", () => {
    const steps = yearSteps([a, b]);
    expect(steps.map((step) => step.photoPath)).toEqual([`${b.id}/a.webp`, `${a.id}/a.webp`, null]);
    const urls = yearPhotoUrls([a, b]);
    expect(urls.get(`${a.id}/a.webp`)).toMatch(new RegExp(`/postcards/${a.id}/a\\.webp$`));
    expect(urls.get(`${b.id}/a.webp`)).toMatch(new RegExp(`/postcards/${b.id}/a\\.webp$`));
    expect(urls.size).toBe(2);
  });

  it("달을 못 읽는 곳은 건너뛴다", () => {
    const odd = card("O", { places: [place("이상한 곳", "2026-13-05"), place("제대로", "2026-05-05")] });
    expect(yearSteps([odd]).map((step) => step.placeName)).toEqual(["제대로"]);
  });

  it("합계 — 책 수, 곳 수, 사진 수", () => {
    const steps = yearSteps([a, b]);
    expect(yearTotals([a, b], steps)).toEqual({ trips: 2, places: 3, photos: 5 });
  });
});
