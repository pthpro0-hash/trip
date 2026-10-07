import { describe, it, expect } from "vitest";
import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { yearBook, yearBookSeason } from "./mailboxYearBook";

const card = (id: string, over: Partial<InboxCard> = {}): InboxCard => ({
  id: id.repeat(43).slice(0, 43),
  senderName: "지민",
  title: id,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  places: [],
  heartCounts: [],
  cover: "a.webp",
  photoCount: 0,
  greeting: "",
  sentAt: "2026-10-02T09:00:00",
  opened: true,
  replies: [],
  ...over,
});
const place = (name: string, day: string) => ({ placeName: name, lat: 35, lng: 127, day, photoCount: 1, photo: "a.webp" });

describe("yearBook · 올해의 책", () => {
  it("그해 열어 본 책이 없으면 책이 없다", () => {
    expect(yearBook([], "2026")).toBeNull();
    expect(yearBook([card("A", { opened: false })], "2026")).toBeNull();
    expect(yearBook([card("A", { startedOn: "2025-05-01" })], "2026")).toBeNull();
  });

  it("날짜를 모르는 책들('')은 올해의 책이 되지 않는다", () => {
    expect(yearBook([card("A", { startedOn: "", sentAt: "" })], "")).toBeNull();
  });

  it("그해 열어 본 책만 다녀온 날 순으로 담는다", () => {
    const book = yearBook(
      [
        card("C", { startedOn: "2026-11-01" }),
        card("A", { startedOn: "2026-02-10" }),
        card("N", { startedOn: "2026-05-05", opened: false }),
        card("O", { startedOn: "2025-12-24" }),
        card("B", { startedOn: "2026-09-13" }),
      ],
      "2026",
    );
    expect(book?.cards.map((entry) => entry.title)).toEqual(["A", "B", "C"]);
  });

  it("숫자 — 몇 번 다녀왔나, 몇 곳, 사진 몇 장, 하트 몇 개(사진 하트와 책 하트를 모두)", () => {
    const book = yearBook(
      [
        card("A", {
          photoCount: 10,
          places: [place("가", "2026-02-10"), place("나", "2026-02-11")],
          heartCounts: [
            { file: "a.webp", n: 2 },
            { file: "", n: 1 },
          ],
        }),
        card("B", { photoCount: 5, places: [place("다", "2026-09-13")], heartCounts: [{ file: "b.webp", n: 4 }] }),
      ],
      "2026",
    );
    expect(book?.stats).toEqual({ trips: 2, places: 3, photos: 15, hearts: 7 });
  });

  describe("가장 사랑받은 사진", () => {
    it("하트 많은 순 — 같으면 최근에 다녀온 책의 것이 먼저, 책 하트는 사진이 아니라 뺀다", () => {
      const book = yearBook(
        [
          card("A", { startedOn: "2026-02-10", heartCounts: [{ file: "a.webp", n: 3 }, { file: "", n: 9 }] }),
          card("B", { startedOn: "2026-09-13", heartCounts: [{ file: "b.webp", n: 3 }, { file: "c.webp", n: 5 }] }),
        ],
        "2026",
      );
      expect(book?.lovedPhotos.map((entry) => [entry.card.title, entry.file, entry.n])).toEqual([
        ["B", "c.webp", 5],
        ["B", "b.webp", 3],
        ["A", "a.webp", 3],
      ]);
    });

    it("최대 여섯 장", () => {
      const counts = Array.from({ length: 9 }, (_, index) => ({ file: `p${index}.webp`, n: index + 1 }));
      const book = yearBook([card("A", { heartCounts: counts })], "2026");
      expect(book?.lovedPhotos).toHaveLength(6);
      expect(book?.lovedPhotos[0].n).toBe(9);
    });

    it("하트가 없으면 빈 목록", () => {
      expect(yearBook([card("A")], "2026")?.lovedPhotos).toEqual([]);
    });

    it("하트 수가 0 이하이거나 안 열어 본 책의 하트는 세지 않는다", () => {
      const book = yearBook(
        [card("A", { heartCounts: [{ file: "a.webp", n: 0 }] }), card("N", { opened: false, heartCounts: [{ file: "n.webp", n: 9 }] })],
        "2026",
      );
      expect(book?.lovedPhotos).toEqual([]);
      expect(book?.stats.hearts).toBe(0);
    });
  });

  describe("가장 사랑받은 책", () => {
    it("책 하나에 단 하트의 합계(사진 하트 + 책 하트)가 많은 순, 같으면 최근 것이 먼저, 최대 세 권", () => {
      const book = yearBook(
        [
          card("A", { startedOn: "2026-01-10", heartCounts: [{ file: "a.webp", n: 2 }, { file: "", n: 2 }] }), // 4
          card("B", { startedOn: "2026-03-10", heartCounts: [{ file: "b.webp", n: 4 }] }), // 4
          card("C", { startedOn: "2026-05-10", heartCounts: [{ file: "c.webp", n: 1 }] }), // 1
          card("D", { startedOn: "2026-07-10", heartCounts: [{ file: "d.webp", n: 7 }] }), // 7
          card("E", { startedOn: "2026-08-10" }), // 0
        ],
        "2026",
      );
      expect(book?.lovedBooks.map((entry) => [entry.card.title, entry.n])).toEqual([
        ["D", 7],
        ["B", 4],
        ["A", 4],
      ]);
    });

    it("하트가 하나도 없으면 빈 목록", () => {
      expect(yearBook([card("A"), card("B")], "2026")?.lovedBooks).toEqual([]);
    });
  });

  describe("표지 모자이크", () => {
    it("표지 그림이 있는 책에서 최대 네 장 — 사랑받은 책이 먼저, 나머지는 최근 순", () => {
      const book = yearBook(
        [
          card("A", { startedOn: "2026-01-10" }),
          card("B", { startedOn: "2026-02-10" }),
          card("C", { startedOn: "2026-03-10", heartCounts: [{ file: "x.webp", n: 2 }] }),
          card("D", { startedOn: "2026-04-10", cover: null }),
          card("E", { startedOn: "2026-05-10" }),
          card("F", { startedOn: "2026-06-10" }),
        ],
        "2026",
      );
      expect(book?.covers.map((entry) => entry.title)).toEqual(["C", "F", "E", "B"]);
    });

    it("표지가 하나도 없으면 빈 목록", () => {
      expect(yearBook([card("A", { cover: null })], "2026")?.covers).toEqual([]);
    });
  });

  describe("달마다", () => {
    it("여행이 있는 달만 1월부터 순서대로, 달 안에서는 다녀온 날 순", () => {
      const book = yearBook(
        [
          card("C", { startedOn: "2026-09-20" }),
          card("A", { startedOn: "2026-02-10" }),
          card("B", { startedOn: "2026-09-01" }),
        ],
        "2026",
      );
      expect(book?.months.map((entry) => [entry.month, entry.cards.map((item) => item.title)])).toEqual([
        [2, ["A"]],
        [9, ["B", "C"]],
      ]);
    });

    it("다녀온 날을 모르면 보낸 날의 달로 넣는다", () => {
      const book = yearBook([card("A", { startedOn: "", sentAt: "2026-04-03T00:00:00" })], "2026");
      expect(book?.months.map((entry) => entry.month)).toEqual([4]);
    });
  });
});

describe("yearBookSeason · 올해의 책을 알릴 철", () => {
  const books = [card("A", { startedOn: "2026-05-05" })];

  it("12월에는 그해, 1~2월에는 지난해", () => {
    expect(yearBookSeason(books, "2026-12-01")).toBe("2026");
    expect(yearBookSeason(books, "2026-12-31")).toBe("2026");
    expect(yearBookSeason(books, "2027-01-15")).toBe("2026");
    expect(yearBookSeason(books, "2027-02-28")).toBe("2026");
  });

  it("그 밖의 달에는 알리지 않는다", () => {
    for (const today of ["2026-11-30", "2027-03-01", "2026-07-07"]) expect(yearBookSeason(books, today)).toBeNull();
  });

  it("그해에 열어 본 책이 없으면 알릴 책이 없다", () => {
    expect(yearBookSeason([card("A", { startedOn: "2025-05-05" })], "2026-12-05")).toBeNull();
    expect(yearBookSeason([card("A", { startedOn: "2026-05-05", opened: false })], "2026-12-05")).toBeNull();
  });

  it("오늘을 모르면(서버가 그린 첫 그림) 없다", () => {
    expect(yearBookSeason(books, "")).toBeNull();
  });
});
