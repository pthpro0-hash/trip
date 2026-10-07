import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { InboxCard, MailboxView } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";

// 지도 그림은 시험 안에서 잴 것이 아니다. 무엇을 받았는지만 본다.
vi.mock("@/components/sketch/FootprintPlayer", () => ({
  FootprintPlayer: ({ heading, shared, steps }: { heading: string; shared: boolean; steps: unknown[] }) => (
    <p>
      지도:{heading}:{String(shared)}:곳{steps.length}
    </p>
  ),
}));

const { YearBookView } = await import("./YearBookView");

const TOKEN = "T".repeat(43);
const idOf = (letter: string) => letter.repeat(43);
const place = (name: string, day: string) => ({ placeName: name, lat: 35, lng: 127, day, photoCount: 1, photo: "a.webp" });
const card = (letter: string, over: Partial<InboxCard> = {}): InboxCard => ({
  id: idOf(letter),
  senderName: "지민",
  title: `${letter} 여행`,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  places: [],
  heartCounts: [],
  cover: "a.webp",
  photoCount: 10,
  greeting: "",
  sentAt: "2026-10-02T09:00:00",
  opened: true,
  replies: [],
  ...over,
});
const view = (postcards: InboxCard[], over: Partial<MailboxView> = {}): MailboxView => ({
  tone: "casual",
  settings: RECOMMENDED,
  members: ["엄마", "아빠"],
  postcards,
  ...over,
});

const books = [
  card("A", {
    startedOn: "2026-02-10",
    photoCount: 14,
    places: [place("안목해변", "2026-02-10"), place("경포대", "2026-02-11")],
    heartCounts: [
      { file: "a.webp", n: 3 },
      { file: "", n: 1 },
    ],
  }),
  card("B", { startedOn: "2026-09-13", photoCount: 6, places: [place("한옥마을", "2026-09-13")], heartCounts: [{ file: "b.webp", n: 5 }] }),
  card("C", { startedOn: "2025-05-01" }),
];

describe("YearBookView · 올해의 책", () => {
  it("맨 위에 해와 숫자가 크게 — 몇 번 다녀왔나, 몇 곳, 사진, 하트", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    expect(screen.getByRole("heading", { level: 1, name: "2026년" })).toBeTruthy();
    expect(screen.getByText("우리 가족 올해의 책")).toBeTruthy();
    expect(screen.getByText("2번 다녀왔어요 · 3곳 · 사진 20장 · 하트 9개")).toBeTruthy();
  });

  it("그해 열어 본 책만 센다 — 다른 해의 책은 들어오지 않는다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    expect(screen.queryByRole("link", { name: /C 여행/ })).toBeNull();
  });

  it("표지 모자이크는 그림 몇 장 — 보일 때만 불러온다(lazy)", () => {
    const { container } = render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    const images = container.querySelectorAll("[data-testid='mosaic'] img");
    expect(images.length).toBe(2);
    for (const image of images) expect(image.getAttribute("loading")).toBe("lazy");
  });

  describe("가장 사랑받은 사진", () => {
    it("하트 많은 순으로 보이고, 누르면 그 책으로 간다", () => {
      render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
      const section = screen.getByRole("region", { name: "가장 사랑받은 사진" });
      const links = within(section).getAllByRole("link");
      expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(["B 여행 사진, 하트 5개", "A 여행 사진, 하트 3개"]);
      expect(links[0]).toHaveAttribute("href", `/m/${TOKEN}/p/${idOf("B")}`);
      expect(links[0].querySelector("img")?.getAttribute("src")).toMatch(/\/postcards\/B+\/b\.webp$/);
    });

    it("하트가 없으면 이 칸이 없다", () => {
      render(<YearBookView token={TOKEN} view={view([card("A")])} year="2026" />);
      expect(screen.queryByRole("region", { name: "가장 사랑받은 사진" })).toBeNull();
      expect(screen.queryByRole("region", { name: "가장 사랑받은 책" })).toBeNull();
    });
  });

  it("가장 사랑받은 책은 하트 합계 순 — 책 하트까지 더한다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    const section = screen.getByRole("region", { name: "가장 사랑받은 책" });
    const items = within(section).getAllByRole("link");
    expect(items[0]).toHaveTextContent("B 여행");
    expect(items[0]).toHaveTextContent("하트 5개");
    expect(items[1]).toHaveTextContent("A 여행");
    expect(items[1]).toHaveTextContent("하트 4개");
  });

  it("한 해 다녀온 길은 지도로 바로 보인다 — 링크로 받은 모양, 그해 곳 전부", async () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    expect(await screen.findByText("지도:2026년 다녀온 곳:true:곳3", {}, { timeout: 10000 })).toBeTruthy();
  });

  it("곳 정보가 없으면(옛 SQL) 지도 칸이 없다", () => {
    render(<YearBookView token={TOKEN} view={view([card("A")])} year="2026" />);
    expect(screen.queryByRole("region", { name: "한 해 다녀온 길" })).toBeNull();
  });

  it("달마다 — 여행이 있는 달만, 책 제목이 그 엽서로 가는 길", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    const section = screen.getByRole("region", { name: "달마다" });
    expect(within(section).getByText("2월")).toBeTruthy();
    expect(within(section).getByText("9월")).toBeTruthy();
    expect(within(section).queryByText("3월")).toBeNull();
    expect(within(section).getByRole("link", { name: /A 여행/ })).toHaveAttribute("href", `/m/${TOKEN}/p/${idOf("A")}`);
  });

  it("우편함으로 돌아가는 길이 맨 위와 맨 아래에 있다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
    const back = screen.getAllByRole("link", { name: /우편함/ });
    expect(back.length).toBeGreaterThanOrEqual(2);
    for (const link of back) expect(link).toHaveAttribute("href", `/m/${TOKEN}`);
  });

  it("그해 열어 본 책이 없으면 '아직 없어요' — 만들어지는 때를 알려 준다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2024" />);
    expect(screen.getByText("2024년의 책은 아직 없어요")).toBeTruthy();
    expect(screen.getByText(/열어 본 엽서가 모이면/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /우편함/ })[0]).toHaveAttribute("href", `/m/${TOKEN}`);
  });

  it("설정에서 끈 우편함이면 올해의 책은 열리지 않는다 — 우편함으로 돌려보낸다", () => {
    render(<YearBookView token={TOKEN} view={view(books, { settings: { ...RECOMMENDED, year: false } })} year="2026" />);
    expect(screen.queryByRole("heading", { level: 1, name: "2026년" })).toBeNull();
    expect(screen.getByText("올해의 책은 지금 쓰지 않고 있어요")).toBeTruthy();
  });

  it("글씨 크기는 설정을 따른다", () => {
    const { container } = render(
      <YearBookView token={TOKEN} view={view(books, { settings: { ...RECOMMENDED, font: "xlarge" } })} year="2026" />,
    );
    expect((container.querySelector("main") as HTMLElement).style.getPropertyValue("--rs")).toBe("1.2");
  });

  describe("미리보기", () => {
    it("띠가 붙고, 모든 길에 미리보기 표시가 이어진다", () => {
      render(<YearBookView token={TOKEN} view={view(books)} year="2026" preview />);
      expect(screen.getByRole("note", { name: "미리보기" })).toBeTruthy();
      // 띠 안의 링크(방식 바꾸기)는 따로 본다 — 책 안의 길들만.
      const hrefs = screen
        .getAllByRole("link")
        .filter((link) => !link.closest("[role=note]"))
        .map((link) => link.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/m/"));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).toMatch(/\?preview=1$/);
    });

    it("평소에는 띠도 표시도 없다", () => {
      render(<YearBookView token={TOKEN} view={view(books)} year="2026" />);
      expect(screen.queryByRole("note", { name: "미리보기" })).toBeNull();
      for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).not.toContain("preview");
    });
  });
});

describe("YearBookView · 미리보기 방식", () => {
  it("'모두 열어 본 것처럼'이면 그 말과 지금 모습으로 바꾸는 길이 있다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" preview="all" />);
    const note = screen.getByRole("note", { name: "미리보기" });
    expect(note).toHaveTextContent("모든 엽서를 열어 본 것처럼");
    expect(within(note).getByRole("link", { name: /지금 부모님이 보시는 대로/ })).toHaveAttribute("href", `/m/${TOKEN}/year/2026?preview=1`);
  });

  it("'지금 모습'이면 모두 열어 본 것처럼 보는 길이 있다", () => {
    render(<YearBookView token={TOKEN} view={view(books)} year="2026" preview />);
    const note = screen.getByRole("note", { name: "미리보기" });
    expect(within(note).getByRole("link", { name: /모든 엽서를 열어 본 것처럼 보기/ })).toHaveAttribute("href", `/m/${TOKEN}/year/2026?preview=all`);
  });
});
