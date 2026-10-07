import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { InboxCard, MailboxView } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import { YearBookPrint } from "./YearBookPrint";

const TOKEN = "T".repeat(43);
const idOf = (letter: string) => letter.repeat(43);
const place = (name: string, day: string, lat = 37.7, lng = 128.9) => ({ placeName: name, lat, lng, day, photoCount: 1, photo: "a.webp" });
const card = (letter: string, over: Partial<InboxCard> = {}): InboxCard => ({
  id: idOf(letter),
  senderName: "지민",
  title: `${letter} 여행`,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  places: [],
  heartCounts: [],
  cover: "a.webp",
  photoCount: 3,
  greeting: `${letter} 엄마 아빠, 잘 다녀왔어요`,
  sentAt: "2026-10-02T09:00:00",
  opened: true,
  replies: [],
  ...over,
});
const view = (postcards: InboxCard[], over: Partial<MailboxView> = {}): MailboxView => ({
  tone: "casual",
  settings: RECOMMENDED,
  members: ["엄마", "아빠"],
  wishes: [],
  postcards,
  ...over,
});
const photos = (n: number) => Array.from({ length: n }, (_, index) => `p${index}.webp`);

const books = [
  card("A", {
    startedOn: "2026-02-10",
    photoCount: 4,
    places: [place("안목해변", "2026-02-10"), place("경포대", "2026-02-11", 37.8, 128.9)],
    heartCounts: [{ file: "p1.webp", n: 3 }, { file: "", n: 1 }],
  }),
  card("B", { startedOn: "2026-09-13", photoCount: 2, places: [place("한옥마을", "2026-09-13", 35.8, 127.1)], heartCounts: [{ file: "p0.webp", n: 5 }] }),
  card("C", { startedOn: "2025-05-01" }),
];
const filesById = { [idOf("A")]: photos(4), [idOf("B")]: photos(2), [idOf("C")]: photos(3) };

const pages = (container: HTMLElement) => [...container.querySelectorAll("[data-page]")].map((page) => page.getAttribute("data-page"));

// jsdom 은 그림을 불러오지 않는다. 불러오는 중인 것으로 보이게 하고 load 를 직접 쏜다.
let completeSpy: ReturnType<typeof vi.spyOn> | null = null;
beforeEach(() => {
  completeSpy = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
});
afterEach(() => {
  completeSpy?.mockRestore();
  vi.restoreAllMocks();
});

describe("YearBookPrint · 올해의 책을 쪽으로 나눈 인쇄용 책", () => {
  it("쪽 순서 — 표지, 사랑받은 사진, 사랑받은 책, 지도, 달마다, 여행마다, 끝쪽", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    expect(pages(container)).toEqual(["cover", "loved-photos", "loved-books", "map", "months", "trip", "trip", "last"]);
  });

  it("하트가 없으면 사랑받은 사진·책 쪽이 빠지고, 곳 정보가 없으면 지도 쪽이 빠진다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view([card("A")])} year="2026" filesById={{ [idOf("A")]: photos(2) }} />);
    expect(pages(container)).toEqual(["cover", "months", "trip", "last"]);
  });

  it("표지에는 해와 숫자가 있다 — 다른 해의 책은 들어오지 않는다", () => {
    render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    expect(screen.getByRole("heading", { level: 1, name: "2026년" })).toBeTruthy();
    expect(screen.getByText("2번 다녀왔어요 · 3곳 · 사진 6장 · 하트 9개")).toBeTruthy();
    expect(screen.queryByText("C 여행")).toBeNull();
  });

  it("여행 쪽에는 제목·날짜·보낸 사람·인사말·곳이 있고, 사진이 모두 나온다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const trip = container.querySelectorAll("[data-page='trip']")[0] as HTMLElement;
    expect(within(trip).getByRole("heading", { name: "A 여행" })).toBeTruthy();
    expect(trip).toHaveTextContent("2월 10일");
    expect(trip).toHaveTextContent("지민");
    expect(trip).toHaveTextContent("A 엄마 아빠, 잘 다녀왔어요");
    expect(trip).toHaveTextContent("안목해변");
    expect(trip).toHaveTextContent("경포대");
    expect(trip.querySelectorAll("img")).toHaveLength(4);
  });

  it("사진이 여섯 장을 넘으면 둘째 쪽으로 이어진다 — 스무 장도 두 쪽에 모두", () => {
    const many = [card("A", { photoCount: 20 })];
    const { container } = render(<YearBookPrint token={TOKEN} view={view(many)} year="2026" filesById={{ [idOf("A")]: photos(20) }} />);
    const trips = [...container.querySelectorAll("[data-page='trip'], [data-page='trip-more']")];
    expect(trips).toHaveLength(2);
    expect(trips[0].querySelectorAll("img")).toHaveLength(6);
    expect(trips[1].querySelectorAll("img")).toHaveLength(14);
  });

  it("사진 목록이 없으면 표지 사진 하나만 — 엽서 한 장을 못 읽어도 책은 만들어진다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view([card("A")])} year="2026" filesById={{}} />);
    const trip = container.querySelector("[data-page='trip']") as HTMLElement;
    expect(trip.querySelectorAll("img")).toHaveLength(1);
  });

  it("그림은 보일 때가 아니라 바로 불러온다 — 인쇄할 때 빠지지 않게(lazy 가 아니다)", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const images = [...container.querySelectorAll("img")];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image.getAttribute("loading")).toBe("eager");
  });

  it("지도 쪽에는 다녀온 곳이 점과 번호 목록으로 있다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const map = container.querySelector("[data-page='map']") as HTMLElement;
    expect(within(map).getByRole("img", { name: "다녀온 곳 지도" })).toBeTruthy();
    expect(map).toHaveTextContent("1. 안목해변");
    expect(map).toHaveTextContent("3. 한옥마을");
  });

  it("달마다 쪽에는 여행 있는 달의 제목이 있다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const months = container.querySelector("[data-page='months']") as HTMLElement;
    expect(months).toHaveTextContent("2월");
    expect(months).toHaveTextContent("A 여행");
    expect(months).toHaveTextContent("9월");
    expect(months).not.toHaveTextContent("3월");
  });

  describe("PDF 로 저장", () => {
    it("사진을 다 불러오기 전에는 단추가 막혀 있고, 얼마나 불러왔는지 알린다", async () => {
      const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
      const total = container.querySelectorAll("img").length;
      const button = await screen.findByRole("button", { name: new RegExp(`사진 불러오는 중 0/${total}`) });
      expect(button).toBeDisabled();
    });

    it("다 불러오면(실패한 사진도 센다) 단추가 켜지고, 누르면 인쇄 창을 연다", async () => {
      const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
      const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
      const images = [...container.querySelectorAll("img")];
      images.forEach((image, index) => (index % 2 === 0 ? fireEvent.load(image) : fireEvent.error(image)));
      const button = await screen.findByRole("button", { name: "PDF로 저장" });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(print).toHaveBeenCalledTimes(1);
    });

    it("그림이 하나도 없는 책은 바로 저장할 수 있다", async () => {
      const plain = [card("A", { cover: null })];
      render(<YearBookPrint token={TOKEN} view={view(plain)} year="2026" filesById={{ [idOf("A")]: [] }} />);
      expect(await screen.findByRole("button", { name: "PDF로 저장" })).toBeEnabled();
    });

    it("어떻게 저장하는지 알려 준다 — 인쇄 창에서 PDF 로 저장, 용지·여백, 권장 브라우저", () => {
      render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
      const help = screen.getByRole("region", { name: "저장하는 법" });
      expect(help).toHaveTextContent("PDF로 저장");
      expect(help).toHaveTextContent("A5");
      expect(help).toHaveTextContent("여백");
      expect(help).toHaveTextContent("크롬");
      // 인쇄 창이 주소·날짜를 위아래에 찍는 것은 끌 수 있다.
      expect(help).toHaveTextContent("머리글");
    });

    it("사진 크기에 맞는 쓰임을 솔직히 말한다 — 가족용 기념 PDF", () => {
      render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
      expect(screen.getByRole("region", { name: "저장하는 법" })).toHaveTextContent("가족용");
    });
  });

  it("쪽 크기는 A5 세로로 정한다 — 이 화면이 열려 있는 동안만 인쇄 설정에 들어간다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const style = container.querySelector("style");
    expect(style?.textContent).toContain("@page");
    expect(style?.textContent).toContain("A5");
  });

  /*
    아이폰 사파리에서 쪽이 어긋나 한 쪽이 두 장에 걸쳐 찍혔다 — 사파리는 flex 안에 든 것의 쪽 나누기(break-after)를
    지키지 않는다. 그래서 인쇄할 때는 쪽을 감싸는 상자들(main, 쪽 묶음)을 flex 가 아닌 일반 상자로 되돌려야 한다.
  */
  it("인쇄할 때는 쪽을 감싸는 상자가 flex 가 아닌 일반 상자다 — 사파리가 쪽 나누기를 지키게", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const css = container.querySelector("style")?.textContent ?? "";
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.book-main\s*\{[^}]*display:\s*block\s*!important/);
    expect(print).toMatch(/\.book-zoom\s*\{[^}]*display:\s*block\s*!important/);
    expect(container.querySelector("main")?.className).toContain("book-main");
    expect(container.querySelector(".book-zoom")).toBeTruthy();
  });

  it("쪽은 한 장에 한 쪽씩 — 쪽 앞뒤로 줄바꿈하고, 한 쪽이 두 장에 걸쳐 쪼개지지 않게 한다", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toMatch(/break-after:\s*page/);
    expect(css).toMatch(/page-break-after:\s*always/);
    expect(css).toMatch(/break-inside:\s*avoid/);
    expect(css).toMatch(/page-break-inside:\s*avoid/);
    // 마지막 쪽 뒤에는 빈 장이 생기지 않게.
    expect(css).toMatch(/\.book-page:last-child\s*\{[^}]*break-after:\s*auto/);
  });

  it("쪽을 감싸는 상자 안에서 쪽이 첫째 자식 상자 없이 바로 이어진다 — :last-child 가 쪽 자신을 가리키게", () => {
    const { container } = render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    const zoom = container.querySelector(".book-zoom") as HTMLElement;
    const children = [...zoom.children];
    expect(children.length).toBeGreaterThan(1);
    for (const child of children) expect(child.getAttribute("data-page")).not.toBeNull();
  });

  it("책장으로 돌아가는 길이 있다 — 올해의 책으로", () => {
    render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} />);
    expect(screen.getByRole("link", { name: /올해의 책/ })).toHaveAttribute("href", `/m/${TOKEN}/year/2026`);
  });

  it("그해 열어 본 책이 없으면 '아직 없어요'", () => {
    render(<YearBookPrint token={TOKEN} view={view(books)} year="2024" filesById={filesById} />);
    expect(screen.getByText("2024년의 책은 아직 없어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /PDF로 저장|사진 불러오는 중/ })).toBeNull();
  });

  it("설정에서 올해의 책을 끈 책장이면 만들지 않는다", () => {
    render(<YearBookPrint token={TOKEN} view={view(books, { settings: { ...RECOMMENDED, year: false } })} year="2026" filesById={filesById} />);
    expect(screen.getByText("올해의 책은 지금 쓰지 않고 있어요")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "2026년" })).toBeNull();
  });

  describe("미리보기", () => {
    it("띠가 붙고, 돌아가는 길에 미리보기 방식이 이어진다", () => {
      render(<YearBookPrint token={TOKEN} view={view(books)} year="2026" filesById={filesById} preview="all" />);
      expect(screen.getByRole("note", { name: "미리보기" })).toBeTruthy();
      const back = screen.getAllByRole("link", { name: /올해의 책/ }).filter((link) => !link.closest("[role=note]"));
      for (const link of back) expect(link).toHaveAttribute("href", `/m/${TOKEN}/year/2026?preview=all`);
    });
  });
});
