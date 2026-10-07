import { describe, it, expect, vi, beforeEach } from "vitest";
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
  markWishesSeen: vi.fn(),
  wishes: [] as unknown[],
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
  fetchWishes: async () => postcards.wishes,
  markWishesSeen: postcards.markWishesSeen,
}));

const { MailboxPanel } = await import("./MailboxPanel");

const box = (over: Partial<MailboxItem> = {}): MailboxItem => ({
  id: "m1",
  ownerId: "me",
  name: "우리 엄마 아빠",
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

const copied = vi.fn(async () => undefined);

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
    postcards.markWishesSeen.mockReset();
    postcards.markWishesSeen.mockResolvedValue(true);
    postcards.wishes = [];
    copied.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
  });

  it("로그인하지 않았으면 로그인으로 안내한다", async () => {
    state.user = null;
    render(<MailboxPanel />);
    expect(await screen.findByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=/mailboxes");
  });

  it("책장이 없으면 '아직 없어요'와 만들기 단추", async () => {
    render(<MailboxPanel />);
    expect(await screen.findByText("아직 없어요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "내 책장 0/3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "책장 만들기" })).toBeTruthy();
  });

  it("이름·부르는 말·받는 분·말투로 만든다", async () => {
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "책장 만들기" }));
    fireEvent.change(screen.getByPlaceholderText("우리 엄마 아빠"), { target: { value: "장인 장모님" } });
    fireEvent.change(screen.getByPlaceholderText("엄마 아빠"), { target: { value: "장모님" } });
    fireEvent.click(screen.getByRole("radio", { name: "존댓말" }));
    // 받는 분 이름을 비워 두면 부르는 말에서 미리보기가 나온다.
    expect(within(screen.getByLabelText("받는 분 미리보기")).getByText("장모님")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "책장 만들기" }).at(-1)!);
    await waitFor(() =>
      expect(api.createMailbox).toHaveBeenCalledWith(expect.anything(), "me", {
        name: "장인 장모님",
        greetingName: "장모님",
        members: "",
        tone: "polite",
        useGreeting: true,
      }),
    );
  });

  it("이름이 비면 만들 수 없다", async () => {
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "책장 만들기" }));
    expect(screen.getAllByRole("button", { name: "책장 만들기" }).at(-1)).toBeDisabled();
  });

  it("책장이 3개 열려 있으면 만들기 대신 안내", async () => {
    state.list = { owned: [box({ id: "a" }), box({ id: "b", name: "장모님" }), box({ id: "c", name: "고모" })], joined: [] };
    render(<MailboxPanel />);
    await screen.findByText("장모님");
    expect(screen.queryByRole("button", { name: "책장 만들기" })).toBeNull();
    expect(screen.getByText(/3개까지 열어 둘 수 있어요/)).toBeTruthy();
  });

  it("닫은 책장은 열린 수에 세지 않는다", async () => {
    state.list = { owned: [box({ id: "a" }), box({ id: "b", closed: true }), box({ id: "c", closed: true })], joined: [] };
    render(<MailboxPanel />);
    expect(await screen.findByRole("heading", { name: "내 책장 1/3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "책장 만들기" })).toBeTruthy();
  });

  it("카드에 받는 분·부르는 말·보내는 사람 수가 보인다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    const card = await screen.findByRole("article", { name: "우리 엄마 아빠" });
    expect(card.textContent).toContain("엄마 · 아빠");
    expect(card.textContent).toContain("부르는 말 ‘엄마 아빠’");
    expect(card.textContent).toContain("보내는 사람 2명");
  });

  it("링크 복사는 /m/<글자> 주소를 복사한다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"T".repeat(43)}`));
  });

  it("링크 새로 만들기는 한 번 더 묻고, 새 링크를 복사하고, 옛 링크가 끊긴다고 알린다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "링크 새로 만들기" }));
    expect(api.rotateMailboxToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "새로 만들기" }));
    await waitFor(() => expect(api.rotateMailboxToken).toHaveBeenCalledWith(expect.anything(), "m1"));
    await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"R".repeat(43)}`));
    expect(await screen.findByRole("status")).toHaveTextContent("옛 링크는 이제 열리지 않아요");
  });

  it("닫기는 한 번 더 묻고, 닫은 책장은 링크 복사가 막히고 다시 열 수 있다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "책장 닫기" }));
    expect(api.setMailboxClosed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(api.setMailboxClosed).toHaveBeenCalledWith(expect.anything(), "m1", true));
  });

  it("닫힌 책장: 링크 복사·초대가 막히고 [다시 열기]가 있다", async () => {
    state.list = { owned: [box({ closed: true })], joined: [] };
    render(<MailboxPanel />);
    expect(await screen.findByRole("button", { name: "링크 복사" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "보내는 사람 초대" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
    await waitFor(() => expect(api.setMailboxClosed).toHaveBeenCalledWith(expect.anything(), "m1", false));
  });

  it("다시 열다 한도에 걸리면 이유를 알린다", async () => {
    api.setMailboxClosed.mockResolvedValue({ ok: false, reason: "limit" });
    state.list = { owned: [box({ closed: true })], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "다시 열기" }));
    expect(await screen.findByRole("status")).toHaveTextContent("열려 있는 책장이 이미 3개");
  });

  it("닫은 책장은 바탕색이 달라 한눈에 구분된다 — 보내는 사람으로 들어간 것도 같다", async () => {
    state.list = {
      owned: [box({ id: "a", name: "열린 곳" }), box({ id: "b", name: "닫은 곳", closed: true })],
      joined: [box({ id: "j", ownerId: "sis", name: "닫은 남의 곳", closed: true })],
    };
    render(<MailboxPanel />);
    const open = await screen.findByRole("article", { name: "열린 곳" });
    const closed = screen.getByRole("article", { name: "닫은 곳" });
    expect(closed.className).toContain("bg-bg-subtle");
    expect(closed).toHaveAttribute("data-closed", "true");
    expect(open.className).not.toContain("bg-bg-subtle");
    expect(open).not.toHaveAttribute("data-closed");
    expect(screen.getByText("닫은 남의 곳").closest("li")).toHaveAttribute("data-closed", "true");
  });

  it("보낸 엽서: 어느 책장에서 열어 봤는지 보이고, 거두기는 한 번 더 묻는다", async () => {
    state.list = { owned: [box({ id: "m1", name: "엄마 아빠" }), box({ id: "m2", name: "장모님" })], joined: [] };
    postcards.sent = [
      {
        id: "pc1",
        tripId: "t1",
        title: "강릉 바다",
        startedOn: "2026-09-13",
        sentAt: "2026-10-02T00:00:00Z",
        deliveries: [
          { mailboxId: "m1", opened: true },
          { mailboxId: "m2", opened: false },
        ],
        replies: [],
        hearts: [], unread: 0,
      },
    ];
    render(<MailboxPanel />);
    expect(await screen.findByRole("heading", { name: "보낸 엽서 1장" })).toBeTruthy();
    expect(screen.getByText("열어 보셨어요")).toBeTruthy();
    expect(screen.getByText("아직 안 열어 보셨어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "엽서 거두기" }));
    expect(postcards.withdrawPostcard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "거두기" }));
    await waitFor(() => expect(postcards.withdrawPostcard).toHaveBeenCalledWith(expect.anything(), "pc1"));
  });

  it("부모님이 답장하면 '엄마가 좋구나 하셨어요'로 보이고, 새 답장은 표시되며, 봤다고 적는다", async () => {
    state.list = { owned: [box({ id: "m1", name: "엄마 아빠" }), box({ id: "m2", name: "장모님" })], joined: [] };
    postcards.sent = [
      {
        id: "pc1",
        tripId: "t1",
        title: "강릉 바다",
        startedOn: "2026-09-13",
        sentAt: "2026-10-02T00:00:00Z",
        deliveries: [
          { mailboxId: "m1", opened: true },
          { mailboxId: "m2", opened: true },
        ],
        replies: [
          { id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "2026-10-03T00:00:00Z", seen: true },
          { id: "r2", mailboxId: "m2", who: "장모님", reaction: "잘 다녀왔니", at: "2026-10-04T00:00:00Z", seen: false },
        ],
        hearts: [], unread: 1,
      },
    ];
    render(<MailboxPanel />);
    const list = await screen.findByRole("list", { name: "강릉 바다 답장" });
    expect(list).toHaveTextContent("엄마가 ‘좋구나’ 하셨어요");
    expect(list).toHaveTextContent("장모님이 ‘잘 다녀왔니’ 하셨어요");
    // 책장이 둘이면 어느 책장의 답장인지 알려 준다.
    expect(list).toHaveTextContent("장모님");
    // 못 본 답장만 '새 답장'.
    expect(screen.getAllByText("새 답장")).toHaveLength(1);
    await waitFor(() => expect(postcards.markRepliesSeen).toHaveBeenCalledWith(expect.anything(), ["r2"]));
  });

  it("이미 본 답장만 있으면 새 답장 표시도, 봤다는 표시 호출도 없다", async () => {
    postcards.sent = [
      {
        id: "pc1", tripId: "t1", title: "강릉 바다", startedOn: "", sentAt: "", deliveries: [{ mailboxId: "m1", opened: true }],
        replies: [{ id: "r1", mailboxId: "m1", who: "아빠", reaction: "좋구나", at: "", seen: true }], hearts: [], unread: 0,
      },
    ];
    render(<MailboxPanel />);
    expect(await screen.findByRole("list", { name: "강릉 바다 답장" })).toHaveTextContent("아빠가 ‘좋구나’ 하셨어요");
    expect(screen.queryByText("새 답장")).toBeNull();
    expect(postcards.markRepliesSeen).not.toHaveBeenCalled();
  });

  describe("하트", () => {
    const sentWith = (hearts: unknown[], deliveries = [{ mailboxId: "m1", opened: true }]) => [
      { id: "pc1", tripId: "t1", title: "강릉 바다", startedOn: "", sentAt: "", deliveries, replies: [], hearts, unread: 0 },
    ];

    it("부모님이 사진에 하트를 누르면 '엄마가 사진 2장에 하트를 눌렀어요'로 모아 보이고, 새 하트는 표시되며, 봤다고 적는다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" })], joined: [] };
      postcards.sent = sentWith([
        { id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: true },
        { id: "h2", mailboxId: "m1", who: "엄마", file: "b.webp", seen: false },
        { id: "h3", mailboxId: "m1", who: "아빠", file: "a.webp", seen: false },
      ]);
      render(<MailboxPanel />);
      const list = await screen.findByRole("list", { name: "강릉 바다 하트" });
      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
      expect(list).toHaveTextContent("엄마가 사진 2장에 하트를 눌렀어요");
      expect(list).toHaveTextContent("아빠가 사진 1장에 하트를 눌렀어요");
      // 못 본 하트가 든 줄에만 '새 하트'.
      expect(screen.getAllByText("새 하트")).toHaveLength(2);
      await waitFor(() => expect(postcards.markHeartsSeen).toHaveBeenCalledWith(expect.anything(), ["h2", "h3"]));
    });

    it("책 하트는 '이 여행에', 둘 다 있으면 '이 여행과 사진 N장에'", async () => {
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      postcards.sent = sentWith([
        { id: "h1", mailboxId: "m1", who: "엄마", file: "", seen: true },
        { id: "h2", mailboxId: "m1", who: "아빠", file: "", seen: true },
        { id: "h3", mailboxId: "m1", who: "아빠", file: "a.webp", seen: true },
      ]);
      render(<MailboxPanel />);
      const list = await screen.findByRole("list", { name: "강릉 바다 하트" });
      expect(list).toHaveTextContent("엄마가 이 여행에 하트를 눌렀어요");
      expect(list).toHaveTextContent("아빠가 이 여행과 사진 1장에 하트를 눌렀어요");
    });

    it("책장이 둘 이상이면 어느 책장의 하트인지 알려 준다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" }), box({ id: "m2", name: "장모님" })], joined: [] };
      postcards.sent = sentWith(
        [{ id: "h1", mailboxId: "m2", who: "장모님", file: "a.webp", seen: true }],
        [
          { mailboxId: "m1", opened: true },
          { mailboxId: "m2", opened: true },
        ],
      );
      render(<MailboxPanel />);
      const list = await screen.findByRole("list", { name: "강릉 바다 하트" });
      expect(list).toHaveTextContent("· 장모님");
    });

    it("이미 본 하트만 있으면 새 하트 표시도, 봤다는 표시 호출도 없다", async () => {
      postcards.sent = sentWith([{ id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: true }]);
      render(<MailboxPanel />);
      expect(await screen.findByRole("list", { name: "강릉 바다 하트" })).toHaveTextContent("엄마가 사진 1장에 하트를 눌렀어요");
      expect(screen.queryByText("새 하트")).toBeNull();
      expect(postcards.markHeartsSeen).not.toHaveBeenCalled();
    });

    it("하트가 없으면 하트 목록이 없다", async () => {
      postcards.sent = sentWith([]);
      render(<MailboxPanel />);
      await screen.findByRole("heading", { name: "보낸 엽서 1장" });
      expect(screen.queryByRole("list", { name: "강릉 바다 하트" })).toBeNull();
    });

    it("하트를 봤다고 적으면 위 띠의 새 소식 표시도 따라 사라지게 알린다", async () => {
      const seen = vi.fn();
      window.addEventListener("postcard-replies-seen", seen);
      postcards.sent = sentWith([{ id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: false }]);
      render(<MailboxPanel />);
      await waitFor(() => expect(seen).toHaveBeenCalled());
      window.removeEventListener("postcard-replies-seen", seen);
    });
  });

  it("엽서를 거두지 못하면 다시 누르라고 알린다", async () => {
    postcards.withdrawPostcard.mockResolvedValue(false);
    postcards.sent = [{ id: "pc1", tripId: "t1", title: null, startedOn: "", sentAt: "", deliveries: [], replies: [], hearts: [], unread: 0 }];
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "엽서 거두기" }));
    fireEvent.click(screen.getByRole("button", { name: "거두기" }));
    expect(await screen.findByRole("status")).toHaveTextContent("엽서를 거두지 못했어요");
  });

  it("보내는 사람 초대를 만들면 초대 링크가 보이고, 취소할 수 있다", async () => {
    state.invites = [{ token: "I".repeat(43), mailboxId: "m1", expiresAt: "2099-01-01T00:00:00Z" }];
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "보내는 사람 초대" }));
    await waitFor(() => expect(api.createMailboxInvite).toHaveBeenCalledWith(expect.anything(), "m1", "me"));
    expect(await screen.findByLabelText("보내는 사람 초대 링크")).toHaveValue(`${window.location.origin}/mailboxes/join/${"I".repeat(43)}`);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(api.cancelMailboxInvite).toHaveBeenCalledWith(expect.anything(), "I".repeat(43)));
  });

  it("고치기: 지금 값이 채워진 칸이 열리고, 저장하면 고친다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "고치기" }));
    expect(screen.getByPlaceholderText("우리 엄마 아빠")).toHaveValue("우리 엄마 아빠");
    expect(screen.getByPlaceholderText("엄마, 아빠")).toHaveValue("엄마, 아빠");
    fireEvent.change(screen.getByPlaceholderText("우리 엄마 아빠"), { target: { value: "엄마 아빠 집" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(api.updateMailbox).toHaveBeenCalledWith(expect.anything(), "m1", expect.objectContaining({ name: "엄마 아빠 집", tone: "casual" })),
    );
  });

  it("카드에 책 한 권 사진 수가 보이고, [설정]을 누르면 설정 칸이 열린다", async () => {
    state.list = { owned: [box({ settings: { ...RECOMMENDED, photos: 12 } })], joined: [] };
    render(<MailboxPanel />);
    const card = await screen.findByRole("article", { name: "우리 엄마 아빠" });
    expect(card.textContent).toContain("책 한 권 사진 12장");
    fireEvent.click(screen.getByRole("button", { name: "설정" }));
    expect(screen.getByRole("radio", { name: /12장/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "권장으로 되돌리기" })).toBeTruthy();
  });

  it("설정을 저장하면 그 책장에 저장하고 칸을 닫는다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "설정" }));
    fireEvent.click(screen.getByRole("radio", { name: /6장/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(api.updateMailboxSettings).toHaveBeenCalledWith(expect.anything(), "m1", expect.objectContaining({ photos: 6 })));
    await waitFor(() => expect(screen.queryByRole("button", { name: "권장으로 되돌리기" })).toBeNull());
  });

  it("설정을 저장하지 못하면 알린다", async () => {
    api.updateMailboxSettings.mockResolvedValue({ ok: false, reason: "failed" });
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "설정" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByRole("status")).toHaveTextContent("설정을 저장하지 못했어요");
  });

  it("보내는 사람으로 들어간 책장에는 [설정]이 없다 — 주인만 바꾼다", async () => {
    state.list = { owned: [], joined: [box({ id: "j1", ownerId: "sis", name: "장모님" })] };
    render(<MailboxPanel />);
    await screen.findByText("장모님");
    expect(screen.queryByRole("button", { name: "설정" })).toBeNull();
  });

  it("알림 문구는 스크롤해도 화면에 붙어 있다 — 아래쪽 카드의 단추를 눌렀을 때 맨 위에 떠서 안 보이면 '아무 일도 안 일어난 것'처럼 보인다", async () => {
    state.list = { owned: [box({ closed: true })], joined: [] };
    api.planMailboxDelete.mockResolvedValue(null);
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
    const status = await screen.findByRole("status");
    expect(status.className).toContain("sticky");
  });

  describe("가고 싶은 곳(부모님이 보낸)", () => {
    const wish = (id: string, mailboxId: string, who: string, spot: string, seen = true) => ({
      id,
      mailboxId,
      who,
      spot,
      at: "2026-10-03T00:00:00Z",
      seen,
    });

    it("책장 카드 안에 누가 어느 곳을 골랐는지 보인다 — 다른 책장의 것은 섞이지 않는다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" }), box({ id: "m2", name: "장모님" })], joined: [] };
      postcards.wishes = [wish("w1", "m1", "엄마", "경복궁"), wish("w2", "m2", "장모님", "경주")];
      render(<MailboxPanel />);
      const mine = await screen.findByRole("list", { name: "엄마 아빠 가고 싶은 곳" });
      expect(mine).toHaveTextContent("엄마: 경복궁");
      expect(mine).not.toHaveTextContent("경주");
      expect(screen.getByRole("list", { name: "장모님 가고 싶은 곳" })).toHaveTextContent("장모님: 경주");
    });

    it("처음 본 것은 '새' 표시가 붙고, 봤다고 적는다 — 이미 본 것만이면 적지 않는다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" })], joined: [] };
      postcards.wishes = [wish("w1", "m1", "엄마", "경복궁", true), wish("w2", "m1", "아빠", "경주", false)];
      render(<MailboxPanel />);
      await screen.findByRole("list", { name: "엄마 아빠 가고 싶은 곳" });
      await waitFor(() => expect(postcards.markWishesSeen).toHaveBeenCalledWith(expect.anything(), ["w2"]));
      const items = within(screen.getByRole("list", { name: "엄마 아빠 가고 싶은 곳" })).getAllByRole("listitem");
      expect(items[0]).not.toHaveTextContent("새");
      expect(items[1]).toHaveTextContent("새");
    });

    it("이미 본 것만 있으면 봤다는 표시 호출이 없다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" })], joined: [] };
      postcards.wishes = [wish("w1", "m1", "엄마", "경복궁", true)];
      render(<MailboxPanel />);
      await screen.findByRole("list", { name: "엄마 아빠 가고 싶은 곳" });
      expect(postcards.markWishesSeen).not.toHaveBeenCalled();
    });

    it("받은 것이 없으면 목록이 없다", async () => {
      state.list = { owned: [box({ id: "m1", name: "엄마 아빠" })], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "책장 닫기" });
      expect(screen.queryByRole("list", { name: /가고 싶은 곳/ })).toBeNull();
    });

    it("보내는 사람으로 들어간 책장에서도 보인다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳" })] };
      postcards.wishes = [wish("w1", "j1", "엄마", "경복궁")];
      render(<MailboxPanel />);
      expect(await screen.findByRole("list", { name: "남의 곳 가고 싶은 곳" })).toHaveTextContent("엄마: 경복궁");
    });
  });

  describe("오래된 책의 사진 줄이기", () => {
    const books = { books: [{ id: "a".repeat(43), drop: ["b.webp", "c.webp", "d.webp"] }, { id: "b".repeat(43), drop: ["b.webp", "c.webp"] }] };

    it("줄일 책이 없으면 아무 말도 없다", async () => {
      state.list = { owned: [box()], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "책장 닫기" });
      expect(screen.queryByRole("button", { name: "사진 줄이기" })).toBeNull();
    });

    it("보관 권수를 넘은 오래된 책이 있으면 몇 권·몇 장·얼마나 아끼는지 알리고 [사진 줄이기]를 준다", async () => {
      api.planMailboxTrim.mockResolvedValue(books);
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      render(<MailboxPanel />);
      expect(await screen.findByText(/오래된 책 2권의 사진 5장을 줄일 수 있어요/)).toBeTruthy();
      expect(screen.getByText(/약 0\.3~0\.4MB 절약/)).toBeTruthy();
      expect(api.planMailboxTrim).toHaveBeenCalledWith(expect.anything(), "m1");
      expect(screen.getByRole("button", { name: "사진 줄이기" })).toBeTruthy();
    });

    it("보관을 '전부'로 해 둔 책장은 계획을 묻지도 않는다", async () => {
      state.list = { owned: [box({ id: "m1", settings: { ...RECOMMENDED, keep: "all" } })], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "책장 닫기" });
      expect(api.planMailboxTrim).not.toHaveBeenCalled();
    });

    it("닫은 책장은 줄이지 않는다 — 계획도 묻지 않는다", async () => {
      state.list = { owned: [box({ closed: true })], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "다시 열기" });
      expect(api.planMailboxTrim).not.toHaveBeenCalled();
    });

    it("누르면 무엇이 지워지고 무엇이 남는지 숫자로 말하고 한 번 더 묻는다 — 아직 지우지 않는다", async () => {
      api.planMailboxTrim.mockResolvedValue(books);
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
      expect(await screen.findByText(/오래된 책 2권의 사진 5장을 지워요/)).toBeTruthy();
      expect(screen.getByText(/표지와 하트 받은 사진은 남고/)).toBeTruthy();
      expect(screen.getByText(/되돌릴 수 없어요/)).toBeTruthy();
      expect(api.trimMailbox).not.toHaveBeenCalled();
    });

    it("[그만두기]는 아무것도 지우지 않는다", async () => {
      api.planMailboxTrim.mockResolvedValue(books);
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
      fireEvent.click(await screen.findByRole("button", { name: "그만두기" }));
      expect(api.trimMailbox).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "사진 줄이기" })).toBeTruthy();
    });

    it("[줄이기]를 누르면 줄이고, 몇 권·몇 장을 줄였는지 말한다", async () => {
      api.planMailboxTrim.mockResolvedValue(books);
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
      fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
      await waitFor(() => expect(api.trimMailbox).toHaveBeenCalledWith(expect.anything(), "m1"));
      expect(await screen.findByRole("status")).toHaveTextContent("오래된 책 2권의 사진 5장을 줄였어요");
    });

    it("파일을 다 못 지웠으면 지운 만큼만 줄였다고 알리고, 그 밖의 실패도 말한다", async () => {
      api.planMailboxTrim.mockResolvedValue(books);
      state.list = { owned: [box({ id: "m1" })], joined: [] };
      render(<MailboxPanel />);
      api.trimMailbox.mockResolvedValue({ ok: false, reason: "files" });
      fireEvent.click(await screen.findByRole("button", { name: "사진 줄이기" }));
      fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
      expect(await screen.findByRole("status")).toHaveTextContent("사진을 모두 지우지 못했어요. 지운 만큼만 줄였어요");
      api.trimMailbox.mockResolvedValue({ ok: false, reason: "failed" });
      fireEvent.click(await screen.findByRole("button", { name: "줄이기" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("사진을 줄이지 못했어요"));
    });

    it("보내는 사람으로 들어간 책장에는 줄이기가 없다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳" })] };
      render(<MailboxPanel />);
      await screen.findByText("남의 곳");
      expect(api.planMailboxTrim).not.toHaveBeenCalled();
    });
  });

  describe("책장 지우기", () => {
    const closedBox = () => box({ id: "m1", name: "우리 엄마 아빠", closed: true });

    it("열려 있는 책장에는 지우기가 없다 — 먼저 닫아야 한다", async () => {
      state.list = { owned: [box()], joined: [] };
      render(<MailboxPanel />);
      await screen.findByRole("button", { name: "책장 닫기" });
      expect(screen.queryByRole("button", { name: "책장 지우기" })).toBeNull();
    });

    it("닫은 책장에는 '다시 열기'와 함께 '책장 지우기'가 있다", async () => {
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      expect(await screen.findByRole("button", { name: "다시 열기" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "책장 지우기" })).toBeTruthy();
    });

    it("누르면 무엇이 지워지는지 숫자로 말하고 한 번 더 묻는다 — 아직 지우지 않는다", async () => {
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      expect(await screen.findByText(/‘우리 엄마 아빠’ 책장을 지울까요\?/)).toBeTruthy();
      expect(screen.getByText(/이 책장에만 보낸 엽서 3장과 그 사진 복사본·답장·하트가 모두 지워지고 되돌릴 수 없어요/)).toBeTruthy();
      expect(screen.getByText(/다른 책장에도 보낸 엽서 2장은 그쪽에 그대로 남아요/)).toBeTruthy();
      expect(screen.getByText(/내 여행과 원본 사진은 그대로예요/)).toBeTruthy();
      expect(api.planMailboxDelete).toHaveBeenCalledWith(expect.anything(), "m1");
      expect(api.deleteMailbox).not.toHaveBeenCalled();
    });

    it("남는 엽서가 없으면 그 줄을 말하지 않고, 지울 엽서가 없으면 그렇게 말한다", async () => {
      api.planMailboxDelete.mockResolvedValue({ sole: [], kept: 0 });
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      expect(await screen.findByText(/이 책장에만 보낸 엽서는 없어요/)).toBeTruthy();
      expect(screen.queryByText(/그쪽에 그대로 남아요/)).toBeNull();
    });

    it("[그만두기]는 아무것도 지우지 않고 닫는다", async () => {
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      fireEvent.click(await screen.findByRole("button", { name: "그만두기" }));
      expect(screen.queryByText(/지울까요/)).toBeNull();
      expect(api.deleteMailbox).not.toHaveBeenCalled();
    });

    it("[지우기]를 누르면 지우고, 지웠다고 말한다", async () => {
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
      await waitFor(() => expect(api.deleteMailbox).toHaveBeenCalledWith(expect.anything(), "m1"));
      expect(await screen.findByRole("status")).toHaveTextContent("책장을 지웠어요");
    });

    it("사진 파일을 다 못 치웠으면 책장은 그대로라고 알리고 다시 하라고 한다", async () => {
      api.deleteMailbox.mockResolvedValue("files");
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
      expect(await screen.findByRole("status")).toHaveTextContent("사진을 모두 지우지 못했어요. 책장은 그대로 있어요");
    });

    it("그 밖의 실패도 말로 알린다", async () => {
      api.deleteMailbox.mockResolvedValue("failed");
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      fireEvent.click(await screen.findByRole("button", { name: "지우기" }));
      expect(await screen.findByRole("status")).toHaveTextContent("책장을 지우지 못했어요");
    });

    it("지울 내용을 못 읽으면 확인 창을 띄우지 않고 알린다 — 모르는 채로 지우게 하지 않는다", async () => {
      api.planMailboxDelete.mockResolvedValue(null);
      state.list = { owned: [closedBox()], joined: [] };
      render(<MailboxPanel />);
      fireEvent.click(await screen.findByRole("button", { name: "책장 지우기" }));
      const status = await screen.findByRole("status");
      expect(status).toHaveTextContent("지울 내용을 읽지 못했어요");
      // 서버 설정(mailbox.sql)을 아직 다시 실행하지 않은 때도 이 말로 알아챌 수 있게.
      expect(status).toHaveTextContent("mailbox.sql");
      expect(screen.queryByText(/지울까요/)).toBeNull();
    });

    it("보내는 사람으로 들어간 책장에는 지우기가 없다 — 나가기만", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳", closed: true })] };
      render(<MailboxPanel />);
      await screen.findByText("남의 곳");
      expect(screen.queryByRole("button", { name: "책장 지우기" })).toBeNull();
    });
  });

  describe("부모님 화면 보기(미리보기)", () => {
    it("책장마다 '부모님 화면 보기'가 있고, 새 탭에서 미리보기 주소로 열린다 — 책꽂이까지 보이게 모든 엽서를 열어 본 것처럼", async () => {
      state.list = { owned: [box({ id: "m1", token: "T".repeat(43) })], joined: [] };
      render(<MailboxPanel />);
      const link = await screen.findByRole("link", { name: "부모님 화면 보기" });
      expect(link).toHaveAttribute("href", `/m/${"T".repeat(43)}?preview=all`);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("닫힌 책장은 부모님께 아무것도 안 보이니 미리볼 것도 없다 — 막혀 있다", async () => {
      state.list = { owned: [box({ closed: true })], joined: [] };
      render(<MailboxPanel />);
      expect(await screen.findByRole("button", { name: "부모님 화면 보기" })).toBeDisabled();
      expect(screen.queryByRole("link", { name: "부모님 화면 보기" })).toBeNull();
    });

    it("보내는 사람으로 들어간 책장에서도 미리볼 수 있다", async () => {
      state.list = { owned: [], joined: [box({ id: "j1", ownerId: "other", name: "남의 곳", token: "J".repeat(43) })] };
      render(<MailboxPanel />);
      const link = await screen.findByRole("link", { name: "부모님 화면 보기" });
      expect(link).toHaveAttribute("href", `/m/${"J".repeat(43)}?preview=all`);
    });
  });

  it("보내는 사람으로 들어간 책장은 링크 복사와 나가기만 — 고치기·닫기는 없다", async () => {
    state.list = { owned: [], joined: [box({ id: "j1", ownerId: "sis", name: "장모님" })] };
    render(<MailboxPanel />);
    expect(await screen.findByText("장모님")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "고치기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "책장 닫기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(api.leaveMailbox).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "나가기" }).at(-1)!);
    await waitFor(() => expect(api.leaveMailbox).toHaveBeenCalledWith(expect.anything(), "j1", "me"));
  });
});
