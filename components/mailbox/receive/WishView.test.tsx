import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { MailboxView } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import { wishSpots } from "@/lib/wishSpots";

const calls = vi.hoisted(() => ({ wish: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/mailboxPublic", async () => ({
  ...(await vi.importActual<object>("@/lib/supabase/mailboxPublic")),
  toggleWish: calls.wish,
}));

const { WishView } = await import("./WishView");

const TOKEN = "T".repeat(43);
const whoKey = `mailbox-who:${TOKEN.slice(0, 16)}`;
const view = (over: Partial<MailboxView> = {}): MailboxView => ({
  tone: "casual",
  settings: RECOMMENDED,
  members: ["엄마", "아빠"],
  wishes: [],
  postcards: [],
  ...over,
});
const asMom = () => window.localStorage.setItem(whoKey, "엄마");
const first = wishSpots[0];

describe("WishView · 가고 싶은 곳 보내기", () => {
  beforeEach(() => {
    window.localStorage.clear();
    calls.wish.mockReset();
    calls.wish.mockResolvedValue({ ok: true });
  });

  it("무엇을 하는 화면인지 말하고, 여행 100선의 곳들을 보여 준다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    expect(screen.getByRole("heading", { level: 1, name: "가고 싶은 곳 보내기" })).toBeTruthy();
    expect(screen.getByText(/누르면 가족에게 전해져요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: `${first.name} 가고 싶어요` })).toBeTruthy();
  });

  it("곳마다 이름과 소개가 있고, 권역으로 거를 수 있다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    const row = screen.getByRole("button", { name: `${first.name} 가고 싶어요` }).closest("li") as HTMLElement;
    expect(within(row).getByText(first.name)).toBeTruthy();
    const other = wishSpots.find((spot) => spot.region !== first.region)!;
    fireEvent.click(screen.getByRole("button", { name: other.region }));
    expect(screen.getByRole("button", { name: `${other.name} 가고 싶어요` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: `${first.name} 가고 싶어요` })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getByRole("button", { name: `${first.name} 가고 싶어요` })).toBeTruthy();
  });

  it("이름으로 찾을 수 있다 — 안 맞는 곳은 빠진다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    const count = () => screen.getAllByRole("button", { name: /가고 싶어요$/ }).length;
    const before = count();
    fireEvent.change(screen.getByRole("searchbox", { name: "곳 찾기" }), { target: { value: "경복궁" } });
    expect(screen.getByRole("button", { name: "경복궁 가고 싶어요" })).toBeTruthy();
    expect(count()).toBeLessThan(before);
  });

  it("찾는 곳이 없으면 그렇게 말한다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "곳 찾기" }), { target: { value: "ㅋㅋㅋㅋㅋㅋ없는곳" } });
    expect(screen.getByText(/찾는 곳이 없어요/)).toBeTruthy();
  });

  it("누르면 고른 이름으로 바로 보내고, 눌린 모양이 된다", async () => {
    asMom();
    render(<WishView token={TOKEN} view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
    expect(screen.getByRole("button", { name: `${first.name} 가고 싶은 곳에서 빼기` }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(calls.wish).toHaveBeenCalledWith(expect.anything(), TOKEN, "엄마", first.id, true));
  });

  it("다시 누르면 뺀다", async () => {
    asMom();
    render(<WishView token={TOKEN} view={view({ wishes: [{ who: "엄마", spot: first.id }] })} />);
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶은 곳에서 빼기` }));
    expect(screen.getByRole("button", { name: `${first.name} 가고 싶어요` })).toBeTruthy();
    await waitFor(() => expect(calls.wish).toHaveBeenCalledWith(expect.anything(), TOKEN, "엄마", first.id, false));
  });

  it("보낸 곳은 맨 위에 모아 보인다 — 누가 골랐는지와 함께", () => {
    asMom();
    render(<WishView token={TOKEN} view={view({ wishes: [{ who: "아빠", spot: first.id }, { who: "엄마", spot: wishSpots[1].id }] })} />);
    const sent = screen.getByRole("list", { name: "보낸 곳" });
    expect(sent).toHaveTextContent(`아빠: ${first.name}`);
    expect(sent).toHaveTextContent(`엄마: ${wishSpots[1].name}`);
    expect(screen.getByText("보낸 곳 2곳")).toBeTruthy();
  });

  it("보낸 곳이 없으면 그 칸이 없다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    expect(screen.queryByRole("list", { name: "보낸 곳" })).toBeNull();
  });

  it("누구인지 모르면 보내지 않고 먼저 고르게 한다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    expect(screen.getByText("누가 보시나요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
    expect(calls.wish).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("누구신지");
  });

  it("받는 분 이름이 없는 책장은 '가족'으로 바로 보낸다", async () => {
    render(<WishView token={TOKEN} view={view({ members: [] })} />);
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
    await waitFor(() => expect(calls.wish).toHaveBeenCalledWith(expect.anything(), TOKEN, "가족", first.id, true));
  });

  it.each([
    ["often", /너무 자주/],
    ["full", /가득 찼어요/],
    ["off", /받지 않고 있어요/],
    ["closed", /닫혀 있어요/],
    ["failed", /보내지 못했어요/],
  ])("안 되면(%s) 눌린 모양을 되돌리고 이유를 말로 알린다", async (reason, text) => {
    asMom();
    calls.wish.mockResolvedValue({ ok: false, reason });
    render(<WishView token={TOKEN} view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
    expect(await screen.findByRole("status")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }).getAttribute("aria-pressed")).toBe("false");
  });

  it("보내는 중에 같은 곳을 또 눌러도 한 번만 보낸다", async () => {
    asMom();
    let finish: (value: { ok: true }) => void = () => undefined;
    calls.wish.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<WishView token={TOKEN} view={view()} />);
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
    fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶은 곳에서 빼기` }));
    expect(calls.wish).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: `${first.name} 가고 싶은 곳에서 빼기` })).toBeTruthy());
  });

  it("설정에서 끈 책장이면 보내는 화면을 열지 않는다 — 책장으로 돌려보낸다", () => {
    render(<WishView token={TOKEN} view={view({ settings: { ...RECOMMENDED, wish: false } })} />);
    expect(screen.getByText("가고 싶은 곳 받기는 지금 쓰지 않고 있어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: `${first.name} 가고 싶어요` })).toBeNull();
    expect(screen.getByRole("link", { name: /책장/ })).toHaveAttribute("href", `/m/${TOKEN}`);
  });

  it("책장으로 돌아가는 길이 있다", () => {
    render(<WishView token={TOKEN} view={view()} />);
    for (const link of screen.getAllByRole("link", { name: /책장/ })) expect(link).toHaveAttribute("href", `/m/${TOKEN}`);
  });

  it("글씨 크기는 설정을 따른다", () => {
    const { container } = render(<WishView token={TOKEN} view={view({ settings: { ...RECOMMENDED, font: "xlarge" } })} />);
    expect((container.querySelector("main") as HTMLElement).style.getPropertyValue("--rs")).toBe("1.2");
  });

  describe("미리보기", () => {
    it("띠가 붙고, 눌러도 보내지 않으며 눌린 모양도 되지 않는다", async () => {
      render(<WishView token={TOKEN} view={view()} preview />);
      expect(screen.getByRole("note", { name: "미리보기" })).toBeTruthy();
      expect(screen.queryByText("누가 보시나요?")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }));
      expect(await screen.findByRole("status")).toHaveTextContent("미리보기라서 가고 싶은 곳은 보내지 않아요");
      expect(calls.wish).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: `${first.name} 가고 싶어요` }).getAttribute("aria-pressed")).toBe("false");
    });

    it("책장으로 돌아가는 길에 미리보기가 이어진다", () => {
      render(<WishView token={TOKEN} view={view()} preview="all" />);
      const back = screen.getAllByRole("link", { name: /책장/ }).filter((link) => !link.closest("[role=note]"));
      for (const link of back) expect(link).toHaveAttribute("href", `/m/${TOKEN}?preview=all`);
    });
  });
});
