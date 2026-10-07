import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { MailboxView } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";

// 지도 그림은 시험 안에서 잴 것이 아니다. 무엇을 받았는지만 본다.
vi.mock("@/components/sketch/FootprintPlayer", () => ({
  FootprintPlayer: ({
    heading,
    shared,
    showMonths,
    steps,
    totals,
  }: {
    heading: string;
    shared: boolean;
    showMonths: boolean;
    steps: unknown[];
    totals: { trips: number };
  }) => (
    <p>
      지도:{heading}:{String(shared)}:{String(showMonths)}:곳{steps.length}:책{totals.trips}
    </p>
  ),
}));

const { MailboxHome } = await import("./MailboxHome");

const TOKEN = "T".repeat(43);
const card = (over: Partial<MailboxView["postcards"][number]> = {}) => ({
  id: "P".repeat(43),
  senderName: "지민",
  title: "강릉 바다",
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  places: [],
  heartCounts: [],
  cover: "a.webp",
  photoCount: 14,
  greeting: "엄마 아빠, 바다 보고 왔어요",
  sentAt: "2026-10-02T09:00:00",
  opened: false,
  replies: [],
  ...over,
});
const idOf = (letter: string) => letter.repeat(43);
const place = (placeName: string, day: string) => ({ placeName, lat: 35, lng: 127, day, photoCount: 1, photo: "a.webp" });
const view = (over: Partial<MailboxView> = {}): MailboxView => ({ tone: "casual", settings: RECOMMENDED, members: ["엄마", "아빠"], postcards: [card()], ...over });

describe("MailboxHome · 부모님이 보는 우편함", () => {
  beforeEach(() => window.localStorage.clear());

  it("새 엽서가 있으면 말로 알리고 '새 엽서' 표시가 보인다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText("새 엽서가 1장 도착했어요.")).toBeTruthy();
    expect(screen.getByText("새 엽서")).toBeTruthy();
  });

  it("엽서를 누르면 그 엽서 한 장으로 간다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByRole("link", { name: /강릉 바다/ })).toHaveAttribute("href", `/m/${TOKEN}/p/${"P".repeat(43)}`);
  });

  it("엽서에는 보낸 사람과 날짜, 대표 사진(공개 보관함)이 있다", () => {
    const { container } = render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText(/지민 · 10월 2일/)).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/\/storage\/v1\/object\/public\/postcards\/P+\/a\.webp$/);
  });

  it("이미 열어 본 엽서는 새 표시가 없고, 답장한 말이 보인다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ opened: true, replies: [{ who: "엄마", reaction: "좋구나" }] })] })} />);
    expect(screen.queryByText("새 엽서")).toBeNull();
    expect(screen.getByText("받은 엽서 1장")).toBeTruthy();
    expect(screen.getByText("엄마: 좋구나")).toBeTruthy();
  });

  it("엽서가 없으면 기다리라고 말한다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [] })} />);
    expect(screen.getByText(/아직 도착한 엽서가 없어요/)).toBeTruthy();
  });

  it("제목이 없는 엽서는 '여행 엽서'로", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ title: null })] })} />);
    expect(screen.getByRole("link", { name: /여행 엽서/ })).toBeTruthy();
  });

  it("처음에는 '누가 보시나요?'를 묻고, 한 번 고르면 기억해 다시 묻지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText("누가 보시나요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "엄마" }));
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
    expect(screen.getByText(/\(으\)로 보고 계세요/)).toBeTruthy();
    expect(window.localStorage.getItem(`mailbox-who:${TOKEN.slice(0, 16)}`)).toBe("엄마");
  });

  it("받는 분 이름이 없는 우편함은 묻지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={view({ members: [] })} />);
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
  });

  it("바깥 길(설정·로그인·메뉴)이 없다 — 엽서 링크와 홈 화면 안내뿐", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links.every((href) => href?.startsWith("/m/"))).toBe(true);
    expect(screen.getByText(/홈 화면에 추가/)).toBeTruthy();
  });

  it("엽서마다 사진이 몇 장인지 보인다 — 앨범이 있다는 뜻", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.getByText(/사진 14장/)).toBeTruthy();
  });

  it("사진이 없는 엽서에는 사진 수를 적지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ photoCount: 0, cover: null })] })} />);
    expect(screen.queryByText(/사진 0장/)).toBeNull();
  });

  it("설정의 글씨 크기가 화면 전체의 배율이 된다 — 보통 0.85·크게 1·아주 크게 1.2", () => {
    const scaleOf = (font: "normal" | "large" | "xlarge") => {
      const { container, unmount } = render(<MailboxHome token={TOKEN} view={view({ settings: { ...RECOMMENDED, font } })} />);
      const value = (container.querySelector("main") as HTMLElement).style.getPropertyValue("--rs");
      unmount();
      return value;
    };
    expect(scaleOf("normal")).toBe("0.85");
    expect(scaleOf("large")).toBe("1");
    expect(scaleOf("xlarge")).toBe("1.2");
  });
});

describe("MailboxHome · 새 엽서와 책꽂이", () => {
  beforeEach(() => window.localStorage.clear());

  const shelf = (...cards: ReturnType<typeof card>[]) => view({ postcards: cards });
  // 다녀온 날만 정하면 하루짜리 여행으로 둔다(끝난 날이 기본값에 남아 '작년 오늘'에 걸리지 않게).
  const opened = (letter: string, over: Partial<ReturnType<typeof card>> = {}) => {
    const startedOn = over.startedOn ?? "2026-09-13";
    return card({ id: idOf(letter), title: `${letter} 여행`, opened: true, startedOn, endedOn: startedOn, ...over });
  };

  it("안 열어 본 엽서는 위에 큰 카드로, 열어 본 책은 책꽂이로 — 둘이 겹치지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={shelf(card({ id: idOf("N"), title: "새 여행", opened: false }), opened("O"))} />);
    const fresh = screen.getByRole("list", { name: "새로 온 엽서" });
    expect(within(fresh).getByRole("link", { name: /새 여행/ })).toBeTruthy();
    expect(within(fresh).queryByRole("link", { name: /O 여행/ })).toBeNull();
    const books = screen.getByRole("list", { name: "2026년 · 1권 책꽂이" });
    expect(within(books).getByRole("link", { name: /O 여행/ })).toBeTruthy();
    expect(within(books).queryByRole("link", { name: /새 여행/ })).toBeNull();
  });

  it("열어 본 책이 없으면 책꽂이는 없다 — 새 엽서만", () => {
    render(<MailboxHome token={TOKEN} view={view()} />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("새 엽서가 없으면 새 엽서 칸도 없다", () => {
    render(<MailboxHome token={TOKEN} view={shelf(opened("O"))} />);
    expect(screen.queryByRole("list", { name: "새로 온 엽서" })).toBeNull();
  });

  it("책꽂이는 해마다 한 칸 — 가장 새 해만 펼쳐 있고, 지난 해는 접혀 있다가 눌러서 연다", () => {
    render(
      <MailboxHome
        token={TOKEN}
        view={shelf(opened("A", { startedOn: "2026-09-13" }), opened("B", { startedOn: "2025-05-01" }), opened("C", { startedOn: "2025-12-24" }))}
      />,
    );
    const now = screen.getByRole("button", { name: /2026년 · 1권/ });
    const before = screen.getByRole("button", { name: /2025년 · 2권/ });
    expect(now).toHaveAttribute("aria-expanded", "true");
    expect(before).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /B 여행/ })).toBeNull();

    fireEvent.click(before);
    expect(before).toHaveAttribute("aria-expanded", "true");
    const books = screen.getByRole("list", { name: "2025년 · 2권 책꽂이" });
    // 같은 해 안에서는 최근에 다녀온 책이 먼저.
    expect(within(books).getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("C 여행"),
      expect.stringContaining("B 여행"),
    ]);
    fireEvent.click(now);
    expect(screen.queryByRole("link", { name: /A 여행/ })).toBeNull();
  });

  it("책 표지는 그 엽서로 가는 길이고, 그림은 보일 때 불러온다(lazy) — 책이 많아도 폰이 무겁지 않게", () => {
    const { container } = render(<MailboxHome token={TOKEN} view={shelf(opened("O"))} />);
    const link = screen.getByRole("link", { name: /O 여행/ });
    expect(link).toHaveAttribute("href", `/m/${TOKEN}/p/${idOf("O")}`);
    const image = container.querySelector("ul[aria-label$='책꽂이'] img");
    expect(image?.getAttribute("loading")).toBe("lazy");
    expect(image?.getAttribute("src")).toMatch(/\/postcards\/O+\/a\.webp$/);
  });

  it("책 표지에는 다녀온 날과 보낸 사람, 사진 수, 마지막 답장이 보인다", () => {
    render(<MailboxHome token={TOKEN} view={shelf(opened("O", { startedOn: "2026-09-13", replies: [{ who: "엄마", reaction: "좋구나" }] }))} />);
    const link = screen.getByRole("link", { name: /O 여행/ });
    expect(link).toHaveTextContent("9월 13일");
    expect(link).toHaveTextContent("지민");
    expect(link).toHaveTextContent("사진 14장");
    expect(link).toHaveTextContent("엄마: 좋구나");
  });

  it("제목이 없는 책은 '여행 엽서', 사진이 없으면 편지 그림", () => {
    const { container } = render(<MailboxHome token={TOKEN} view={shelf(opened("O", { title: null, cover: null, photoCount: 0 }))} />);
    expect(screen.getByRole("link", { name: /여행 엽서/ })).toBeTruthy();
    expect(container.querySelector("ul[aria-label$='책꽂이'] img")).toBeNull();
  });

  describe("작년 오늘", () => {
    const old = opened("L", { title: "여수", startedOn: "2025-10-05", endedOn: "2025-10-07", senderName: "지민" });

    it("오늘 즈음 다녀온 지난 해의 책을 위에 보인다 — 몇 해 전인지도", () => {
      render(<MailboxHome token={TOKEN} today="2026-10-07" view={shelf(old)} />);
      const section = screen.getByRole("region", { name: "작년 오늘" });
      expect(within(section).getByText("작년 오늘")).toBeTruthy();
      expect(within(section).getByRole("link", { name: /여수/ })).toHaveAttribute("href", `/m/${TOKEN}/p/${idOf("L")}`);
      expect(section).toHaveTextContent("2025년 10월 5일");
    });

    it("두 해 전부터는 'N년 전 오늘'", () => {
      render(<MailboxHome token={TOKEN} today="2027-10-07" view={shelf(old)} />);
      expect(screen.getByRole("region", { name: "2년 전 오늘" })).toBeTruthy();
    });

    it("오늘 즈음이 아니면 칸 자체가 없다", () => {
      render(<MailboxHome token={TOKEN} today="2026-03-01" view={shelf(old)} />);
      expect(screen.queryByRole("region", { name: /오늘/ })).toBeNull();
    });

    it("오늘을 모르는 첫 그림(서버)에서는 없다", () => {
      render(<MailboxHome token={TOKEN} today="" view={shelf(old)} />);
      expect(screen.queryByRole("region", { name: /오늘/ })).toBeNull();
    });

    it("설정에서 끄면 없다", () => {
      render(<MailboxHome token={TOKEN} today="2026-10-07" view={view({ postcards: [old], settings: { ...RECOMMENDED, past: false } })} />);
      expect(screen.queryByRole("region", { name: /오늘/ })).toBeNull();
    });

    it("안 열어 본 엽서는 쓰지 않는다 — 새 엽서에 이미 있다", () => {
      render(<MailboxHome token={TOKEN} today="2026-10-07" view={shelf({ ...old, opened: false })} />);
      expect(screen.queryByRole("region", { name: /오늘/ })).toBeNull();
    });
  });

  describe("해마다 지도", () => {
    const withPlaces = (letter: string, startedOn: string, ...days: string[]) =>
      opened(letter, { startedOn, endedOn: startedOn, places: days.map((day, index) => place(`곳${index}`, day)) });

    it("곳이 있으면 '2026년 다녀온 곳 지도로 보기' 단추가 있고, 눌러야 지도가 열린다", async () => {
      render(
        <MailboxHome
          token={TOKEN}
          view={shelf(withPlaces("A", "2026-09-13", "2026-09-13", "2026-09-14"), withPlaces("B", "2026-02-10", "2026-02-10"))}
        />,
      );
      expect(screen.queryByText(/^지도:/)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "2026년 다녀온 곳 지도로 보기" }));
      // 책 둘, 곳 셋 — 링크로 받은 모양(눌러도 갈 곳 없음)으로, 달 막대와 함께.
      expect(await screen.findByText("지도:2026년 다녀온 곳:true:true:곳3:책2", {}, { timeout: 10000 })).toBeTruthy();
    });

    it("지도를 연 뒤에는 '지도 닫기'로 바뀌고, 누르면 닫힌다", async () => {
      render(<MailboxHome token={TOKEN} view={shelf(withPlaces("A", "2026-09-13", "2026-09-13"))} />);
      fireEvent.click(screen.getByRole("button", { name: "2026년 다녀온 곳 지도로 보기" }));
      await screen.findByText(/^지도:/, {}, { timeout: 10000 });
      fireEvent.click(screen.getByRole("button", { name: "2026년 지도 닫기" }));
      expect(screen.queryByText(/^지도:/)).toBeNull();
      expect(screen.getByRole("button", { name: "2026년 다녀온 곳 지도로 보기" })).toBeTruthy();
    });

    it("곳 정보가 없는 해(옛 SQL)에는 단추가 없다", () => {
      render(<MailboxHome token={TOKEN} view={shelf(opened("A"))} />);
      expect(screen.queryByRole("button", { name: /지도/ })).toBeNull();
    });

    it("접힌 해에서는 단추도 안 보이고, 펼치면 그 해의 책들로만 그린다", async () => {
      render(
        <MailboxHome
          token={TOKEN}
          view={shelf(withPlaces("A", "2026-09-13", "2026-09-13"), withPlaces("B", "2025-05-01", "2025-05-01", "2025-05-02"))}
        />,
      );
      expect(screen.queryByRole("button", { name: "2025년 다녀온 곳 지도로 보기" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /2025년 · 1권/ }));
      fireEvent.click(screen.getByRole("button", { name: "2025년 다녀온 곳 지도로 보기" }));
      expect(await screen.findByText("지도:2025년 다녀온 곳:true:true:곳2:책1", {}, { timeout: 10000 })).toBeTruthy();
    });
  });
});

describe("MailboxHome · 미리보기(보내는 사람이 부모님 화면을 미리 본다)", () => {
  beforeEach(() => window.localStorage.clear());

  const mixed = view({
    postcards: [
      card({ id: "N".repeat(43), title: "새 여행", opened: false }),
      card({ id: "O".repeat(43), title: "열어 본 여행", opened: true, startedOn: "2025-10-05", endedOn: "2025-10-06" }),
    ],
  });

  it("맨 위에 미리보기라고 알린다 — 부모님께는 아무 표시도 가지 않는다는 말과 함께", () => {
    render(<MailboxHome token={TOKEN} view={mixed} preview today="2026-10-07" />);
    const note = screen.getByRole("note", { name: "미리보기" });
    expect(note).toHaveTextContent("미리보기예요");
    expect(note).toHaveTextContent("부모님께는 아무 표시도 가지 않아요");
    expect(within(note).getByRole("link", { name: /내 우편함/ })).toHaveAttribute("href", "/mailboxes");
  });

  it("평소에는 미리보기 띠가 없다", () => {
    render(<MailboxHome token={TOKEN} view={mixed} />);
    expect(screen.queryByRole("note", { name: "미리보기" })).toBeNull();
  });

  it("엽서·책·작년 오늘의 길마다 미리보기 표시가 이어진다 — 엽서로 들어가도 미리보기", () => {
    render(<MailboxHome token={TOKEN} view={mixed} preview today="2026-10-07" />);
    const links = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith(`/m/${TOKEN}/p/`));
    // 새 엽서 하나, 작년 오늘 하나, 책꽂이 하나.
    expect(links).toHaveLength(3);
    for (const href of links) expect(href).toMatch(/\?preview=1$/);
  });

  it("'누가 보시나요?'는 묻지 않는다 — 부모님이 고르는 것이다", () => {
    render(<MailboxHome token={TOKEN} view={mixed} preview />);
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
  });

  it("평소 길에는 미리보기 표시가 붙지 않는다", () => {
    render(<MailboxHome token={TOKEN} view={mixed} today="2026-10-07" />);
    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).not.toContain("preview");
  });
});

describe("MailboxHome · 올해의 책", () => {
  beforeEach(() => window.localStorage.clear());

  const opened = (letter: string, over: Partial<ReturnType<typeof card>> = {}) => {
    const startedOn = over.startedOn ?? "2026-09-13";
    return card({ id: idOf(letter), title: `${letter} 여행`, opened: true, startedOn, endedOn: startedOn, ...over });
  };
  const books = view({ postcards: [opened("A", { startedOn: "2026-05-05" }), opened("B", { startedOn: "2025-03-03" })] });

  it("12월이면 맨 위에 '2026년 올해의 책이 만들어졌어요' — 누르면 그 책으로", () => {
    render(<MailboxHome token={TOKEN} view={books} today="2026-12-05" />);
    const link = screen.getByRole("link", { name: /2026년 올해의 책이 만들어졌어요/ });
    expect(link).toHaveAttribute("href", `/m/${TOKEN}/year/2026`);
  });

  it("1~2월에는 지난해의 책을 알린다", () => {
    render(<MailboxHome token={TOKEN} view={books} today="2027-01-20" />);
    expect(screen.getByRole("link", { name: /2026년 올해의 책이 만들어졌어요/ })).toBeTruthy();
  });

  it("철이 아니면 알림은 없다 — 오늘을 모르는 첫 그림에서도", () => {
    render(<MailboxHome token={TOKEN} view={books} today="2026-07-07" />);
    expect(screen.queryByRole("link", { name: /올해의 책이 만들어졌어요/ })).toBeNull();
    render(<MailboxHome token={TOKEN} view={books} today="" />);
    expect(screen.queryByRole("link", { name: /올해의 책이 만들어졌어요/ })).toBeNull();
  });

  it("설정에서 끄면 알림도, 해마다 단추도 없다", () => {
    render(<MailboxHome token={TOKEN} view={{ ...books, settings: { ...RECOMMENDED, year: false } }} today="2026-12-05" />);
    expect(screen.queryByRole("link", { name: /올해의 책/ })).toBeNull();
  });

  it("그해에 열어 본 책이 없으면 알릴 책이 없다 — 안 열어 본 엽서는 책이 아니다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [card({ id: idOf("N"), opened: false })] })} today="2026-12-05" />);
    expect(screen.queryByRole("link", { name: /올해의 책/ })).toBeNull();
  });

  it("책꽂이의 해마다 '○○년 올해의 책 보기'가 있다 — 철이 아니어도 1년 내내", () => {
    render(<MailboxHome token={TOKEN} view={books} today="2026-07-07" />);
    expect(screen.getByRole("link", { name: "2026년 올해의 책 보기" })).toHaveAttribute("href", `/m/${TOKEN}/year/2026`);
    // 접힌 지난 해에서는 펼친 뒤에.
    expect(screen.queryByRole("link", { name: "2025년 올해의 책 보기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /2025년 · 1권/ }));
    expect(screen.getByRole("link", { name: "2025년 올해의 책 보기" })).toHaveAttribute("href", `/m/${TOKEN}/year/2025`);
  });

  it("날짜를 모르는 책들 칸에는 올해의 책이 없다", () => {
    render(<MailboxHome token={TOKEN} view={view({ postcards: [opened("U", { startedOn: "", sentAt: "" })] })} today="2026-07-07" />);
    expect(screen.queryByRole("link", { name: /올해의 책/ })).toBeNull();
  });

  it("미리보기에서는 길에 표시가 이어진다", () => {
    render(<MailboxHome token={TOKEN} view={books} today="2026-12-05" preview />);
    for (const link of screen.getAllByRole("link", { name: /올해의 책/ })) expect(link.getAttribute("href")).toMatch(/\?preview=1$/);
  });
});
