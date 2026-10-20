import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { MailboxItem, MailboxList, PendingMailboxInvite } from "@/lib/supabase/mailbox";
import { RECOMMENDED } from "@/lib/mailboxSettings";

const state = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  list: { owned: [], joined: [] } as MailboxList,
  invites: [] as PendingMailboxInvite[],
  token: "T".repeat(43),
}));
const postcards = vi.hoisted(() => ({
  sent: [] as unknown[],
  withdrawPostcard: vi.fn(),
  markRepliesSeen: vi.fn(),
  markHeartsSeen: vi.fn(),
}));
const api = vi.hoisted(() => ({
  createMailbox: vi.fn(),
  updateMailbox: vi.fn(),
  updateMailboxSettings: vi.fn(),
  rotateMailboxToken: vi.fn(),
  setMailboxClosed: vi.fn(),
  createMailboxInvite: vi.fn(),
  cancelMailboxInvite: vi.fn(),
  leaveMailbox: vi.fn(),
  planMailboxDelete: vi.fn(),
  deleteMailbox: vi.fn(),
  planMailboxTrim: vi.fn(),
  trimMailbox: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("@/lib/supabase/mailbox", async () => ({
  ...(await vi.importActual<object>("@/lib/supabase/mailbox")),
  fetchMailboxes: async () => state.list,
  fetchMailboxInvites: async () => state.invites,
  ...api,
}));

vi.mock("@/lib/supabase/postcards", () => ({
  fetchSentPostcards: async () => postcards.sent,
  withdrawPostcard: postcards.withdrawPostcard,
  markRepliesSeen: postcards.markRepliesSeen,
  markHeartsSeen: postcards.markHeartsSeen,
}));

const { MailboxPanel } = await import("./MailboxPanel");

const box = (over: Partial<MailboxItem> = {}): MailboxItem => ({
  id: "m1",
  ownerId: "me",
  name: "엄마 아빠 사진첩",
  greetingName: "엄마 아빠",
  useGreeting: true,
  tone: "casual",
  members: ["엄마", "아빠"],
  token: "T".repeat(43),
  closed: false,
  settings: RECOMMENDED,
  senderCount: 2,
  ...over,
});

const NAME = "엄마 아빠 사진첩";
const copied = vi.fn(async () => undefined);

/*
  가족 사진첩 — 두 겹이다. 목록(표지가 있는 카드)에서 하나를 열면 그 사진첩의 화면이 나오고, 거기에 [링크 보내기]와 [부모님 화면으로 보기],
  그 아래에 엽서 · 반응 · 설정이 있다. 예전에는 한 화면에 모든 단추가 있었고 '더 보기' 안에 일곱 개가 숨어 있었다.
*/

/** 사진첩 카드를 눌러 그 화면을 연다. */
async function 열기(name = NAME) {
  render(<MailboxPanel />);
  fireEvent.click(await screen.findByRole("button", { name: `${name} 열기` }));
  return screen.findByRole("heading", { level: 2, name });
}
const 갈래 = (name: RegExp | string) => fireEvent.click(screen.getByRole("tab", { name }));
const 설정열기 = async (name = NAME) => {
  await 열기(name);
  갈래("설정");
};

const sentCard = (over: Record<string, unknown> = {}) => ({
  id: "pc1",
  tripId: "t1",
  title: "강릉 바다",
  startedOn: "2026-09-13",
  sentAt: "2026-10-02T00:00:00Z",
  cover: null,
  deliveries: [{ mailboxId: "m1", opened: true }],
  replies: [],
  hearts: [],
  unread: 0,
  ...over,
});

describe("MailboxPanel", () => {
  beforeEach(() => {
    state.user = { id: "me" };
    state.list = { owned: [], joined: [] };
    state.invites = [];
    for (const fn of Object.values(api)) fn.mockReset();
    api.createMailbox.mockResolvedValue({ ok: true, id: "new", token: "N".repeat(43) });
    api.updateMailbox.mockResolvedValue({ ok: true });
    api.updateMailboxSettings.mockResolvedValue({ ok: true });
    api.rotateMailboxToken.mockResolvedValue("R".repeat(43));
    api.setMailboxClosed.mockResolvedValue({ ok: true });
    api.createMailboxInvite.mockResolvedValue("I".repeat(43));
    api.cancelMailboxInvite.mockResolvedValue(true);
    api.leaveMailbox.mockResolvedValue(true);
    api.planMailboxDelete.mockResolvedValue({ sole: ["a".repeat(43), "b".repeat(43), "c".repeat(43)], kept: 2 });
    api.deleteMailbox.mockResolvedValue("ok");
    api.planMailboxTrim.mockResolvedValue({ books: [] });
    api.trimMailbox.mockResolvedValue({ ok: true, books: 2, files: 5 });
    postcards.sent = [];
    postcards.withdrawPostcard.mockReset();
    postcards.withdrawPostcard.mockResolvedValue(true);
    postcards.markRepliesSeen.mockReset();
    postcards.markRepliesSeen.mockResolvedValue(true);
    postcards.markHeartsSeen.mockReset();
    postcards.markHeartsSeen.mockResolvedValue(true);
    copied.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    window.history.replaceState(null, "", "/mailboxes");
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("로그인하지 않았으면 로그인으로 안내한다", async () => {
    state.user = null;
    render(<MailboxPanel />);
    expect(await screen.findByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=/mailboxes");
  });

  describe("목록", () => {
    it("사진첩이 없으면 '아직 없어요'와 새 사진첩 단추", async () => {
      render(<MailboxPanel />);
      expect(await screen.findByText(/아직 없어요/)).toBeTruthy();
      expect(screen.getByRole("heading", { name: "내 사진첩 0/3" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "+ 새 사진첩" })).toBeTruthy();
    });

    it("카드는 이름 · 받는 분 · 엽서 수만 — 부르는 말 · 사진 장수 같은 설정 말은 카드에 없다", async () => {
      state.list = { owned: [box()], joined: [] };
      postcards.sent = [sentCard(), sentCard({ id: "pc2" })];
      render(<MailboxPanel />);
      const card = await screen.findByRole("button", { name: `${NAME} 열기` });
      expect(card.textContent).toContain(NAME);
      expect(card.textContent).toContain("받는 분 엄마 · 아빠");
      expect(card.textContent).toContain("엽서 2장");
      expect(card.textContent).not.toContain("부르는 말");
      expect(card.textContent).not.toContain("사진 6장");
    });

    it("카드에는 링크 복사 · 닫기 같은 단추가 없다 — 열어야 나온다", async () => {
      state.list = { owned: [box()], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: `${NAME} 열기` });
      for (const name of ["링크 보내기", "링크 복사", "사진첩 닫기", "고치기", "설정"]) expect(screen.queryByRole("button", { name }), name).toBeNull();
    });

    it("표지는 그 사진첩에 가장 최근에 보낸 엽서의 첫 사진이다 — 없으면 편지 그림", async () => {
      state.list = { owned: [box({ id: "m1" }), box({ id: "m2", name: "장모님 사진첩" })], joined: [] };
      postcards.sent = [sentCard({ id: "pcA", cover: "a.webp" })];
      render(<MailboxPanel />);
      const withCover = await screen.findByRole("button", { name: `${NAME} 열기` });
      const img = withCover.querySelector("img");
      expect(img?.getAttribute("src")).toContain("/pcA/a.webp");
      expect(screen.getByRole("button", { name: "장모님 사진첩 열기" }).querySelector("img")).toBeNull();
    });

    it("아직 안 열어 보신 엽서가 있으면 그렇게 말한다", async () => {
      state.list = { owned: [box()], joined: [] };
      postcards.sent = [sentCard({ deliveries: [{ mailboxId: "m1", opened: false }] })];
      render(<MailboxPanel />);
      expect((await screen.findByRole("button", { name: `${NAME} 열기` })).textContent).toContain("아직 안 열어 보셨어요");
    });

    it("새 답장·하트는 카드에 '새 소식 N'으로 알리고, 봤다고 적는다", async () => {
      state.list = { owned: [box()], joined: [] };
      postcards.sent = [
        sentCard({
          replies: [{ id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "", seen: false }],
          hearts: [{ id: "h1", mailboxId: "m1", who: "아빠", file: "a.webp", seen: false }],
        }),
      ];
      render(<MailboxPanel />);
      expect((await screen.findByRole("button", { name: `${NAME} 열기` })).textContent).toContain("새 소식 2");
      await waitFor(() => expect(postcards.markRepliesSeen).toHaveBeenCalledWith(expect.anything(), ["r1"]));
      await waitFor(() => expect(postcards.markHeartsSeen).toHaveBeenCalledWith(expect.anything(), ["h1"]));
    });

    it("닫은 사진첩은 바탕색이 달라 한눈에 구분된다 — 보내는 사람으로 들어간 것도 같다", async () => {
      state.list = {
        owned: [box({ id: "a", name: "열린 곳" }), box({ id: "b", name: "닫은 곳", closed: true })],
        joined: [box({ id: "j", ownerId: "sis", name: "닫은 남의 곳", closed: true })],
      };
      render(<MailboxPanel />);
      const open = await screen.findByRole("button", { name: "열린 곳 열기" });
      const closed = screen.getByRole("button", { name: "닫은 곳 열기" });
      expect(closed.className).toMatch(/(^|\s)bg-bg-subtle(\s|$)/);
      expect(closed).toHaveAttribute("data-closed", "true");
      expect(closed.textContent).toContain("닫혀 있어요");
      expect(open.className).not.toMatch(/(^|\s)bg-bg-subtle(\s|$)/);
      expect(open).not.toHaveAttribute("data-closed");
      expect(screen.getByText("닫은 남의 곳").closest("li")).toHaveAttribute("data-closed", "true");
    });

    it("사진첩이 3개 열려 있으면 새 사진첩 대신 안내", async () => {
      state.list = { owned: [box({ id: "a" }), box({ id: "b", name: "장모님" }), box({ id: "c", name: "고모" })], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "장모님 열기" });
      expect(screen.queryByRole("button", { name: "+ 새 사진첩" })).toBeNull();
      expect(screen.getByText(/3개까지 열어 둘 수 있어요/)).toBeTruthy();
    });

    it("닫은 사진첩은 열린 수에 세지 않는다", async () => {
      state.list = { owned: [box({ id: "a" }), box({ id: "b", closed: true }), box({ id: "c", closed: true })], joined: [] };
      render(<MailboxPanel />);
      expect(await screen.findByRole("heading", { name: "내 사진첩 1/3" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "+ 새 사진첩" })).toBeTruthy();
    });

    it("내가 보낸 모든 엽서는 '모두 보기'에 접어 둔다 — 남의 사진첩으로 보낸 것도 거둘 수 있게", async () => {
      state.list = { owned: [box()], joined: [] };
      postcards.sent = [sentCard()];
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: `${NAME} 열기` });
      const all = screen.getByText("보낸 엽서 1장 모두 보기").closest("details")!;
      expect(all.open).toBe(false);
      expect(within(all).getByRole("button", { name: "엽서 거두기" })).toBeTruthy();
    });
  });

  describe("새 사진첩 만들기 — 받는 분과 말투만 묻는다", () => {
    it("받는 분과 말투로 만든다 — 이름 · 부르는 말은 저절로 지어진다", async () => {
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "+ 새 사진첩" }));
      fireEvent.change(screen.getByLabelText("누구에게 보여 드릴까요?"), { target: { value: "엄마, 아빠" } });
      fireEvent.click(screen.getByRole("radio", { name: "존댓말" }));
      fireEvent.click(screen.getByRole("button", { name: "사진첩 만들기" }));
      await waitFor(() =>
        expect(api.createMailbox).toHaveBeenCalledWith(expect.anything(), "me", {
          name: "엄마 아빠 사진첩",
          greetingName: "엄마 아빠",
          members: "엄마, 아빠",
          tone: "polite",
          useGreeting: true,
        }),
      );
    });

    it("받는 분을 안 적으면 만들지 않고 말로 알린다", async () => {
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "+ 새 사진첩" }));
      fireEvent.click(screen.getByRole("button", { name: "사진첩 만들기" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("받는 분을 적어 주세요");
      expect(api.createMailbox).not.toHaveBeenCalled();
    });

    it("만들면 그 사진첩의 화면으로 가서 링크를 보내라고 한다", async () => {
      // 만든 뒤 다시 읽은 목록에 새 사진첩이 있다.
      api.createMailbox.mockImplementation(async () => {
        state.list = { owned: [box({ id: "new", token: "N".repeat(43) })], joined: [] };
        return { ok: true, id: "new", token: "N".repeat(43) };
      });
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "+ 새 사진첩" }));
      fireEvent.change(screen.getByLabelText("누구에게 보여 드릴까요?"), { target: { value: "엄마, 아빠" } });
      fireEvent.click(screen.getByRole("button", { name: "사진첩 만들기" }));
      expect(await screen.findByRole("heading", { level: 2, name: NAME })).toBeTruthy();
      expect(screen.getByRole("note")).toHaveTextContent("이제 받는 분께 링크를 보내 주세요");
      expect(window.location.search).toBe("?box=new");
    });

    it("그만두면 목록으로 돌아온다", async () => {
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "+ 새 사진첩" }));
      fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
      expect(screen.getByRole("button", { name: "+ 새 사진첩" })).toBeTruthy();
    });

    it("한도에 걸리면 이유를 알린다", async () => {
      api.createMailbox.mockResolvedValue({ ok: false, reason: "limit" });
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "+ 새 사진첩" }));
      fireEvent.change(screen.getByLabelText("누구에게 보여 드릴까요?"), { target: { value: "엄마" } });
      fireEvent.click(screen.getByRole("button", { name: "사진첩 만들기" }));
      expect(await screen.findByRole("status")).toHaveTextContent("3개까지 열어 둘 수 있어요");
    });
  });

  describe("사진첩 화면", () => {
    beforeEach(() => {
      state.list = { owned: [box()], joined: [] };
    });

    it("맨 앞에는 [링크 보내기]와 [부모님 화면으로 보기]뿐이고, 그 아래가 엽서 · 반응 · 설정이다", async () => {
      await 열기();
      expect(screen.getByRole("button", { name: "링크 보내기" })).toBeEnabled();
      expect(screen.getByRole("link", { name: "부모님 화면으로 보기" })).toBeTruthy();
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["엽서 0", "반응", "설정"]);
      // 설정 쪽 단추는 설정 갈래에 있다.
      for (const name of ["링크 새로 만들기", "사진첩 닫기", "보내는 사람 초대"]) expect(screen.queryByRole("button", { name }), name).toBeNull();
    });

    it("열면 주소에 적히고, [가족 사진첩]이나 뒤로 가기로 목록에 돌아온다", async () => {
      await 열기();
      expect(window.location.search).toBe("?box=m1");
      fireEvent.click(screen.getByRole("button", { name: "가족 사진첩 목록으로" }));
      expect(await screen.findByRole("button", { name: `${NAME} 열기` })).toBeTruthy();
      expect(window.location.search).toBe("");

      // 주소에 사진첩이 적힌 채 뒤로 가기(popstate)가 오면 그 화면이다.
      window.history.pushState(null, "", "/mailboxes?box=m1");
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(await screen.findByRole("heading", { level: 2, name: NAME })).toBeTruthy();
      window.history.pushState(null, "", "/mailboxes");
      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(await screen.findByRole("button", { name: `${NAME} 열기` })).toBeTruthy();
    });

    it("주소에 사진첩이 적혀 있으면 새로 고쳐도 그 화면이다", async () => {
      window.history.replaceState(null, "", "/mailboxes?box=m1");
      render(<MailboxPanel />);
      expect(await screen.findByRole("heading", { level: 2, name: NAME })).toBeTruthy();
    });

    it("주소의 사진첩이 없는 것이면 목록을 보인다", async () => {
      window.history.replaceState(null, "", "/mailboxes?box=없는것");
      render(<MailboxPanel />);
      expect(await screen.findByRole("button", { name: `${NAME} 열기` })).toBeTruthy();
    });

    it("[링크 보내기]는 폰의 공유창이 있으면 그것으로 보낸다", async () => {
      const share = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "share", { value: share, configurable: true });
      await 열기();
      fireEvent.click(screen.getByRole("button", { name: "링크 보내기" }));
      await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/m/${"T".repeat(43)}`, title: NAME })));
      expect(copied).not.toHaveBeenCalled();
    });

    it("공유창이 없으면 /m/<글자> 주소를 복사한다", async () => {
      await 열기();
      fireEvent.click(screen.getByRole("button", { name: "링크 보내기" }));
      await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"T".repeat(43)}`));
      expect(await screen.findByRole("status")).toHaveTextContent("링크를 복사했어요");
    });

    it("공유창을 그냥 닫은 것은 아무 일도 아니다 — 복사하지 않는다", async () => {
      const share = vi.fn(async () => {
        throw new DOMException("닫음", "AbortError");
      });
      Object.defineProperty(navigator, "share", { value: share, configurable: true });
      await 열기();
      fireEvent.click(screen.getByRole("button", { name: "링크 보내기" }));
      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(copied).not.toHaveBeenCalled();
    });

    it("공유창이 막히면 복사로 물러난다", async () => {
      const share = vi.fn(async () => {
        throw new Error("막힘");
      });
      Object.defineProperty(navigator, "share", { value: share, configurable: true });
      await 열기();
      fireEvent.click(screen.getByRole("button", { name: "링크 보내기" }));
      await waitFor(() => expect(copied).toHaveBeenCalled());
    });

    it("[부모님 화면으로 보기]는 새 탭에서 미리보기 주소로 열린다 — 묶음까지 보이게 모든 엽서를 열어 본 것처럼", async () => {
      await 열기();
      const link = screen.getByRole("link", { name: "부모님 화면으로 보기" });
      expect(link).toHaveAttribute("href", `/m/${"T".repeat(43)}?preview=all`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("닫힌 사진첩은 보낼 수도 미리볼 수도 없다 — 닫혀 있다고 알린다", async () => {
      state.list = { owned: [box({ closed: true })], joined: [] };
      await 열기();
      expect(screen.getByRole("button", { name: "링크 보내기" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "부모님 화면으로 보기" })).toBeDisabled();
      expect(screen.queryByRole("link", { name: "부모님 화면으로 보기" })).toBeNull();
      expect(screen.getByText("닫혀 있어요")).toBeTruthy();
    });

    describe("엽서 갈래", () => {
      it("보낸 엽서가 없으면 어떻게 보내는지 알려 준다", async () => {
        await 열기();
        expect(screen.getByText("아직 보낸 엽서가 없어요")).toBeTruthy();
        expect(screen.getByRole("link", { name: "엽서 보낼 여행 고르기" })).toHaveAttribute("href", "/trips");
      });

      it("이 사진첩에 보낸 엽서만 보이고, 열어 봤는지가 보인다", async () => {
        state.list = { owned: [box({ id: "m1" }), box({ id: "m2", name: "장모님 사진첩" })], joined: [] };
        postcards.sent = [
          sentCard({ id: "pc1", title: "강릉 바다", deliveries: [{ mailboxId: "m1", opened: true }, { mailboxId: "m2", opened: false }] }),
          sentCard({ id: "pc2", title: "제주 3일", deliveries: [{ mailboxId: "m2", opened: false }] }),
        ];
        await 열기();
        expect(screen.getAllByRole("tab")[0].textContent).toBe("엽서 1");
        const list = screen.getByRole("list", { name: `${NAME} 엽서` });
        expect(list).toHaveTextContent("강릉 바다");
        expect(list).not.toHaveTextContent("제주 3일");
        // 이 사진첩 것만 — 다른 사진첩의 '아직 안 열어 보셨어요'는 섞이지 않는다.
        expect(within(list).getByText("열어 보셨어요")).toBeTruthy();
        expect(within(list).queryByText("아직 안 열어 보셨어요")).toBeNull();
      });

      it("엽서 거두기는 한 번 더 묻는다", async () => {
        postcards.sent = [sentCard()];
        await 열기();
        fireEvent.click(screen.getByRole("button", { name: "엽서 거두기" }));
        expect(postcards.withdrawPostcard).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "거두기" }));
        await waitFor(() => expect(postcards.withdrawPostcard).toHaveBeenCalledWith(expect.anything(), "pc1"));
      });

      it("엽서를 거두지 못하면 다시 누르라고 알린다", async () => {
        postcards.withdrawPostcard.mockResolvedValue(false);
        postcards.sent = [sentCard()];
        await 열기();
        fireEvent.click(screen.getByRole("button", { name: "엽서 거두기" }));
        fireEvent.click(screen.getByRole("button", { name: "거두기" }));
        expect(await screen.findByRole("status")).toHaveTextContent("엽서를 거두지 못했어요");
      });
    });

    describe("반응 갈래", () => {
      it("답장도 하트도 없으면 그렇게 말한다", async () => {
        postcards.sent = [sentCard()];
        await 열기();
        갈래(/^반응/);
        expect(screen.getByText("아직 답장이나 하트가 없어요")).toBeTruthy();
      });

      it("부모님이 답장하면 '엄마가 좋구나 하셨어요'로 보이고, 새 답장은 표시된다", async () => {
        postcards.sent = [
          sentCard({
            replies: [
              { id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "2026-10-03T00:00:00Z", seen: true },
              { id: "r2", mailboxId: "m1", who: "아빠", reaction: "잘 다녀왔니", at: "2026-10-04T00:00:00Z", seen: false },
            ],
          }),
        ];
        await 열기();
        // 새 소식은 갈래 이름에도 알린다.
        expect(screen.getByRole("tab", { name: /^반응/ }).textContent).toContain("새 소식 1");
        갈래(/^반응/);
        const list = screen.getByRole("list", { name: "강릉 바다 답장" });
        expect(list).toHaveTextContent("엄마가 ‘좋구나’ 하셨어요");
        expect(list).toHaveTextContent("아빠가 ‘잘 다녀왔니’ 하셨어요");
        expect(screen.getAllByText("새 답장")).toHaveLength(1);
        await waitFor(() => expect(postcards.markRepliesSeen).toHaveBeenCalledWith(expect.anything(), ["r2"]));
      });

      it("다른 사진첩의 답장은 섞이지 않는다", async () => {
        state.list = { owned: [box({ id: "m1" }), box({ id: "m2", name: "장모님 사진첩" })], joined: [] };
        postcards.sent = [
          sentCard({
            deliveries: [{ mailboxId: "m1", opened: true }, { mailboxId: "m2", opened: true }],
            replies: [
              { id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "", seen: true },
              { id: "r2", mailboxId: "m2", who: "장모님", reaction: "고맙다", at: "", seen: true },
            ],
          }),
        ];
        await 열기();
        갈래(/^반응/);
        const list = screen.getByRole("list", { name: "강릉 바다 답장" });
        expect(list).toHaveTextContent("엄마");
        expect(list).not.toHaveTextContent("장모님");
      });

      it("하트는 '엄마가 사진 2장에 하트를 눌렀어요'로 모아 보이고, 새 하트는 표시되며, 봤다고 적는다", async () => {
        postcards.sent = [
          sentCard({
            hearts: [
              { id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: true },
              { id: "h2", mailboxId: "m1", who: "엄마", file: "b.webp", seen: false },
              { id: "h3", mailboxId: "m1", who: "아빠", file: "a.webp", seen: false },
            ],
          }),
        ];
        await 열기();
        갈래(/^반응/);
        const list = screen.getByRole("list", { name: "강릉 바다 하트" });
        expect(within(list).getAllByRole("listitem")).toHaveLength(2);
        expect(list).toHaveTextContent("엄마가 사진 2장에 하트를 눌렀어요");
        expect(list).toHaveTextContent("아빠가 사진 1장에 하트를 눌렀어요");
        expect(screen.getAllByText("새 하트")).toHaveLength(2);
        await waitFor(() => expect(postcards.markHeartsSeen).toHaveBeenCalledWith(expect.anything(), ["h2", "h3"]));
      });

      it("엽서 하트는 '이 여행에', 둘 다 있으면 '이 여행과 사진 N장에'", async () => {
        postcards.sent = [
          sentCard({
            hearts: [
              { id: "h1", mailboxId: "m1", who: "엄마", file: "", seen: true },
              { id: "h2", mailboxId: "m1", who: "아빠", file: "", seen: true },
              { id: "h3", mailboxId: "m1", who: "아빠", file: "a.webp", seen: true },
            ],
          }),
        ];
        await 열기();
        갈래(/^반응/);
        const list = screen.getByRole("list", { name: "강릉 바다 하트" });
        expect(list).toHaveTextContent("엄마가 이 여행에 하트를 눌렀어요");
        expect(list).toHaveTextContent("아빠가 이 여행과 사진 1장에 하트를 눌렀어요");
      });

      it("이미 본 것만 있으면 새 표시도, 봤다는 표시 호출도 없다", async () => {
        postcards.sent = [
          sentCard({
            replies: [{ id: "r1", mailboxId: "m1", who: "아빠", reaction: "좋구나", at: "", seen: true }],
            hearts: [{ id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: true }],
          }),
        ];
        await 열기();
        갈래(/^반응/);
        expect(screen.queryByText("새 답장")).toBeNull();
        expect(screen.queryByText("새 하트")).toBeNull();
        expect(postcards.markRepliesSeen).not.toHaveBeenCalled();
        expect(postcards.markHeartsSeen).not.toHaveBeenCalled();
      });

      it("봤다고 적으면 위 띠의 새 소식 표시도 따라 사라지게 알린다", async () => {
        const seen = vi.fn();
        window.addEventListener("postcard-replies-seen", seen);
        postcards.sent = [sentCard({ hearts: [{ id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: false }] })];
        render(<MailboxPanel />);
        await waitFor(() => expect(seen).toHaveBeenCalled());
        window.removeEventListener("postcard-replies-seen", seen);
      });
    });

    describe("설정 갈래", () => {
      it("지금 값을 한눈에 보인다 — 받는 분 · 말투 · 부르는 말 · 엽서 한 장의 사진 · 보내는 사람", async () => {
        state.list = { owned: [box({ settings: { ...RECOMMENDED, photos: 12 } })], joined: [] };
        await 설정열기();
        const panel = screen.getByRole("tabpanel");
        for (const text of ["엄마 · 아빠", "편하게", "엄마 아빠", "12장", "2명"]) expect(panel.textContent, text).toContain(text);
      });

      it("이름·받는 분 고치기: 지금 값이 채워진 칸이 열리고, 저장하면 고친다", async () => {
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "이름·받는 분 고치기" }));
        expect(screen.getByPlaceholderText("엄마 아빠 사진첩")).toHaveValue(NAME);
        expect(screen.getByPlaceholderText("엄마, 아빠")).toHaveValue("엄마, 아빠");
        fireEvent.change(screen.getByPlaceholderText("엄마 아빠 사진첩"), { target: { value: "엄마 아빠 집" } });
        fireEvent.click(screen.getByRole("button", { name: "저장" }));
        await waitFor(() =>
          expect(api.updateMailbox).toHaveBeenCalledWith(expect.anything(), "m1", expect.objectContaining({ name: "엄마 아빠 집", tone: "casual" })),
        );
      });

      it("세부 설정: 열리고, 저장하면 그 사진첩에 저장하고 칸을 닫는다", async () => {
        state.list = { owned: [box({ settings: { ...RECOMMENDED, photos: 12 } })], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "세부 설정" }));
        expect(screen.getByRole("radio", { name: /12장/ })).toBeChecked();
        expect(screen.getByRole("button", { name: "권장으로 되돌리기" })).toBeTruthy();
        fireEvent.click(screen.getByRole("radio", { name: /6장/ }));
        fireEvent.click(screen.getByRole("button", { name: "저장" }));
        await waitFor(() => expect(api.updateMailboxSettings).toHaveBeenCalledWith(expect.anything(), "m1", expect.objectContaining({ photos: 6 })));
        await waitFor(() => expect(screen.queryByRole("button", { name: "권장으로 되돌리기" })).toBeNull());
      });

      it("설정을 저장하지 못하면 알린다", async () => {
        api.updateMailboxSettings.mockResolvedValue({ ok: false, reason: "failed" });
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "세부 설정" }));
        fireEvent.click(screen.getByRole("button", { name: "저장" }));
        expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장하지 못했어요");
      });

      it("보내는 사람 초대를 만들면 초대 링크가 보이고, 취소할 수 있다", async () => {
        state.invites = [{ token: "I".repeat(43), mailboxId: "m1", expiresAt: "2099-01-01T00:00:00Z" }];
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "보내는 사람 초대" }));
        await waitFor(() => expect(api.createMailboxInvite).toHaveBeenCalledWith(expect.anything(), "m1", "me"));
        expect(await screen.findByLabelText("보내는 사람 초대 링크")).toHaveValue(`${window.location.origin}/mailboxes/join/${"I".repeat(43)}`);
        fireEvent.click(screen.getByRole("button", { name: "취소" }));
        await waitFor(() => expect(api.cancelMailboxInvite).toHaveBeenCalledWith(expect.anything(), "I".repeat(43)));
      });

      it("링크 새로 만들기는 한 번 더 묻고, 새 링크를 복사하고, 옛 링크가 끊긴다고 알린다", async () => {
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "링크 새로 만들기" }));
        expect(api.rotateMailboxToken).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "새로 만들기" }));
        await waitFor(() => expect(api.rotateMailboxToken).toHaveBeenCalledWith(expect.anything(), "m1"));
        await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"R".repeat(43)}`));
        expect(await screen.findByRole("status")).toHaveTextContent("옛 링크는 이제 열리지 않아요");
      });

      it("닫기는 한 번 더 묻는다", async () => {
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 닫기" }));
        expect(api.setMailboxClosed).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "닫기" }));
        await waitFor(() => expect(api.setMailboxClosed).toHaveBeenCalledWith(expect.anything(), "m1", true));
      });

      it("닫힌 사진첩: 초대·링크 새로 만들기가 막히고 [다시 열기]가 있다", async () => {
        state.list = { owned: [box({ closed: true })], joined: [] };
        await 설정열기();
        expect(screen.getByRole("button", { name: "보내는 사람 초대" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "링크 새로 만들기" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
        await waitFor(() => expect(api.setMailboxClosed).toHaveBeenCalledWith(expect.anything(), "m1", false));
      });

      it("다시 열다 한도에 걸리면 이유를 알린다", async () => {
        api.setMailboxClosed.mockResolvedValue({ ok: false, reason: "limit" });
        state.list = { owned: [box({ closed: true })], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
        expect(await screen.findByRole("status")).toHaveTextContent("열려 있는 사진첩이 이미 3개");
      });

      it("알림 문구는 스크롤해도 화면에 붙어 있다 — 아래쪽 단추를 눌렀을 때 맨 위에 떠서 안 보이면 '아무 일도 안 일어난 것'처럼 보인다", async () => {
        state.list = { owned: [box({ closed: true })], joined: [] };
        api.planMailboxDelete.mockResolvedValue(null);
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        expect((await screen.findByRole("status")).className).toContain("sticky");
      });
    });

    describe("오래된 엽서의 사진 줄이기", () => {
      const books = { books: [{ id: "a".repeat(43), drop: ["b.webp", "c.webp", "d.webp"] }, { id: "b".repeat(43), drop: ["b.webp", "c.webp"] }] };

      it("줄일 엽서가 없으면 아무 말도 없다", async () => {
        await 열기();
        expect(screen.queryByRole("button", { name: "사진 줄이기" })).toBeNull();
      });

      it("보관 권수를 넘은 오래된 엽서가 있으면 몇 장·얼마나 아끼는지 알리고 [사진 줄이기]를 준다 — 엽서 갈래에서", async () => {
        api.planMailboxTrim.mockResolvedValue(books);
        await 열기();
        expect(await screen.findByText(/오래된 엽서 2장의 사진 5장을 줄일 수 있어요/)).toBeTruthy();
        expect(screen.getByText(/약 0\.3~0\.4MB 절약/)).toBeTruthy();
        expect(api.planMailboxTrim).toHaveBeenCalledWith(expect.anything(), "m1");
        expect(screen.getByRole("button", { name: "사진 줄이기" })).toBeTruthy();
      });

      it("보관을 '전부'로 해 둔 사진첩은 계획을 묻지도 않는다", async () => {
        state.list = { owned: [box({ id: "m1", settings: { ...RECOMMENDED, keep: "all" } })], joined: [] };
        await 열기();
        expect(api.planMailboxTrim).not.toHaveBeenCalled();
      });

      it("닫은 사진첩은 줄이지 않는다 — 계획도 묻지 않는다", async () => {
        state.list = { owned: [box({ closed: true })], joined: [] };
        await 열기();
        expect(api.planMailboxTrim).not.toHaveBeenCalled();
      });

      it("누르면 무엇이 지워지고 무엇이 남는지 숫자로 말하고 한 번 더 묻는다 — 아직 지우지 않는다", async () => {
        api.planMailboxTrim.mockResolvedValue(books);
        await 열기();
        fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
        expect(await screen.findByText(/오래된 엽서 2장의 사진 5장을 지워요/)).toBeTruthy();
        expect(screen.getByText(/표지와 하트 받은 사진은 남고/)).toBeTruthy();
        expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
        expect(api.trimMailbox).not.toHaveBeenCalled();
      });

      it("[그만두기]는 아무것도 지우지 않는다", async () => {
        api.planMailboxTrim.mockResolvedValue(books);
        await 열기();
        fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
        fireEvent.click(await screen.findByRole("button", { name: "그만두기" }));
        expect(api.trimMailbox).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "사진 줄이기" })).toBeTruthy();
      });

      it("[줄이기]를 누르면 줄이고, 몇 장을 줄였는지 말한다", async () => {
        api.planMailboxTrim.mockResolvedValue(books);
        await 열기();
        fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
        fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
        await waitFor(() => expect(api.trimMailbox).toHaveBeenCalledWith(expect.anything(), "m1"));
        expect(await screen.findByRole("status")).toHaveTextContent("오래된 엽서 2장의 사진 5장을 줄였어요");
      });

      it("파일을 다 못 지웠으면 지운 만큼만 줄였다고 알리고, 그 밖의 실패도 말한다", async () => {
        api.planMailboxTrim.mockResolvedValue(books);
        await 열기();
        api.trimMailbox.mockResolvedValue({ ok: false, reason: "files" });
        fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
        fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
        expect(await screen.findByRole("status")).toHaveTextContent("사진을 모두 지우지 못했어요. 지운 만큼만 줄였어요");
        api.trimMailbox.mockResolvedValue({ ok: false, reason: "failed" });
        fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("사진을 줄이지 못했어요"));
      });
    });

    describe("사진첩 지우기", () => {
      const closedBox = () => box({ id: "m1", name: NAME, closed: true });

      it("열려 있는 사진첩에는 지우기가 없다 — 먼저 닫아야 한다", async () => {
        await 설정열기();
        expect(screen.queryByRole("button", { name: "사진첩 지우기" })).toBeNull();
        expect(screen.getByRole("button", { name: "사진첩 닫기" })).toBeTruthy();
      });

      it("닫은 사진첩에는 '다시 열기'와 함께 '사진첩 지우기'가 있다", async () => {
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        expect(screen.getByRole("button", { name: "다시 열기" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "사진첩 지우기" })).toBeTruthy();
      });

      it("누르면 무엇이 지워지는지 숫자로 말하고 한 번 더 묻는다 — 아직 지우지 않는다", async () => {
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        expect(await screen.findByText(new RegExp(`‘${NAME}’ 사진첩을 지울까요\\?`))).toBeTruthy();
        expect(screen.getByText(/이 사진첩에만 보낸 엽서 3장과 그 사진 복사본·답장·하트가 모두 지워지고 되돌릴 수 없어요/)).toBeTruthy();
        expect(screen.getByText(/다른 사진첩에도 보낸 엽서 2장은 그쪽에 그대로 남아요/)).toBeTruthy();
        expect(screen.getByText(/내 여행과 원본 사진은 그대로예요/)).toBeTruthy();
        expect(api.planMailboxDelete).toHaveBeenCalledWith(expect.anything(), "m1");
        expect(api.deleteMailbox).not.toHaveBeenCalled();
      });

      it("남는 엽서가 없으면 그 줄을 말하지 않고, 지울 엽서가 없으면 그렇게 말한다", async () => {
        api.planMailboxDelete.mockResolvedValue({ sole: [], kept: 0 });
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        expect(await screen.findByText(/이 사진첩에만 보낸 엽서는 없어요/)).toBeTruthy();
        expect(screen.queryByText(/그쪽에 그대로 남아요/)).toBeNull();
      });

      it("[그만두기]는 아무것도 지우지 않고 닫는다", async () => {
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        fireEvent.click(await screen.findByRole("button", { name: "그만두기" }));
        expect(screen.queryByText(/지울까요/)).toBeNull();
        expect(api.deleteMailbox).not.toHaveBeenCalled();
      });

      it("[지우기]를 누르면 지우고, 지웠다고 말한다", async () => {
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
        await waitFor(() => expect(api.deleteMailbox).toHaveBeenCalledWith(expect.anything(), "m1"));
        expect(await screen.findByRole("status")).toHaveTextContent("사진첩을 지웠어요");
      });

      it("사진 파일을 다 못 치웠으면 사진첩은 그대로라고 알리고 다시 하라고 한다", async () => {
        api.deleteMailbox.mockResolvedValue("files");
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
        expect(await screen.findByRole("status")).toHaveTextContent("사진을 모두 지우지 못했어요. 사진첩은 그대로 있어요");
      });

      it("그 밖의 실패도 말로 알린다", async () => {
        api.deleteMailbox.mockResolvedValue("failed");
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
        expect(await screen.findByRole("status")).toHaveTextContent("사진첩을 지우지 못했어요");
      });

      it("지울 내용을 못 읽으면 확인 창을 띄우지 않고 알린다 — 모르는 채로 지우게 하지 않는다", async () => {
        api.planMailboxDelete.mockResolvedValue(null);
        state.list = { owned: [closedBox()], joined: [] };
        await 설정열기();
        fireEvent.click(screen.getByRole("button", { name: "사진첩 지우기" }));
        const status = await screen.findByRole("status");
        expect(status).toHaveTextContent("지울 내용을 읽지 못했어요");
        // 서버 설정(mailbox.sql)을 아직 다시 실행하지 않은 때도 이 말로 알아챌 수 있게.
        expect(status).toHaveTextContent("mailbox.sql");
        expect(screen.queryByText(/지울까요/)).toBeNull();
      });
    });
  });

  describe("보내는 사람으로 들어간 사진첩", () => {
    it("링크 복사와 나가기만 — 고치기·닫기·설정·지우기는 없다(주인만 바꾼다)", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "sis", name: "장모님" })] };
      render(<MailboxPanel />);
      expect(await screen.findByText("장모님")).toBeTruthy();
      for (const name of ["고치기", "사진첩 닫기", "설정", "사진첩 지우기", "사진 줄이기"]) expect(screen.queryByRole("button", { name }), name).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "나가기" }));
      expect(api.leaveMailbox).not.toHaveBeenCalled();
      fireEvent.click(screen.getAllByRole("button", { name: "나가기" }).at(-1)!);
      await waitFor(() => expect(api.leaveMailbox).toHaveBeenCalledWith(expect.anything(), "j1", "me"));
    });

    it("링크 복사는 그 사진첩 주소를 복사한다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "sis", name: "장모님", token: "J".repeat(43) })] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "링크 복사" }));
      await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"J".repeat(43)}`));
    });

    it("미리볼 수 있다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳", token: "J".repeat(43) })] };
      render(<MailboxPanel />);
      const link = await screen.findByRole("link", { name: "부모님 화면으로 보기" });
      expect(link).toHaveAttribute("href", `/m/${"J".repeat(43)}?preview=all`);
    });

    it("닫힌 것은 미리볼 것도 없다 — 막혀 있다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳", closed: true })] };
      render(<MailboxPanel />);
      expect(await screen.findByRole("button", { name: "부모님 화면으로 보기" })).toBeDisabled();
    });
  });
});
