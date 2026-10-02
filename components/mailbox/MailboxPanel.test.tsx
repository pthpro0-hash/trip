import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { MailboxItem, MailboxList, PendingMailboxInvite } from "@/lib/supabase/mailbox";

const state = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  list: { owned: [], joined: [] } as MailboxList,
  invites: [] as PendingMailboxInvite[],
  token: "T".repeat(43),
}));
const api = vi.hoisted(() => ({
  createMailbox: vi.fn(),
  updateMailbox: vi.fn(),
  rotateMailboxToken: vi.fn(),
  setMailboxClosed: vi.fn(),
  createMailboxInvite: vi.fn(),
  cancelMailboxInvite: vi.fn(),
  leaveMailbox: vi.fn(),
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
    api.rotateMailboxToken.mockResolvedValue("R".repeat(43));
    api.setMailboxClosed.mockResolvedValue({ ok: true });
    api.createMailboxInvite.mockResolvedValue("I".repeat(43));
    api.cancelMailboxInvite.mockResolvedValue(true);
    api.leaveMailbox.mockResolvedValue(true);
    copied.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
  });

  it("로그인하지 않았으면 로그인으로 안내한다", async () => {
    state.user = null;
    render(<MailboxPanel />);
    expect(await screen.findByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/login?next=/mailboxes");
  });

  it("우편함이 없으면 '아직 없어요'와 만들기 단추", async () => {
    render(<MailboxPanel />);
    expect(await screen.findByText("아직 없어요.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "내 우편함 0/3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "우편함 만들기" })).toBeTruthy();
  });

  it("이름·부르는 말·받는 분·말투로 만든다", async () => {
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "우편함 만들기" }));
    fireEvent.change(screen.getByPlaceholderText("우리 엄마 아빠"), { target: { value: "장인 장모님" } });
    fireEvent.change(screen.getByPlaceholderText("엄마 아빠"), { target: { value: "장모님" } });
    fireEvent.click(screen.getByRole("radio", { name: "존댓말" }));
    // 받는 분 이름을 비워 두면 부르는 말에서 미리보기가 나온다.
    expect(within(screen.getByLabelText("받는 분 미리보기")).getByText("장모님")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "우편함 만들기" }).at(-1)!);
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
    fireEvent.click(await screen.findByRole("button", { name: "우편함 만들기" }));
    expect(screen.getAllByRole("button", { name: "우편함 만들기" }).at(-1)).toBeDisabled();
  });

  it("우편함이 3개 열려 있으면 만들기 대신 안내", async () => {
    state.list = { owned: [box({ id: "a" }), box({ id: "b", name: "장모님" }), box({ id: "c", name: "고모" })], joined: [] };
    render(<MailboxPanel />);
    await screen.findByText("장모님");
    expect(screen.queryByRole("button", { name: "우편함 만들기" })).toBeNull();
    expect(screen.getByText(/3개까지 열어 둘 수 있어요/)).toBeTruthy();
  });

  it("닫은 우편함은 열린 수에 세지 않는다", async () => {
    state.list = { owned: [box({ id: "a" }), box({ id: "b", closed: true }), box({ id: "c", closed: true })], joined: [] };
    render(<MailboxPanel />);
    expect(await screen.findByRole("heading", { name: "내 우편함 1/3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "우편함 만들기" })).toBeTruthy();
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

  it("닫기는 한 번 더 묻고, 닫은 우편함은 링크 복사가 막히고 다시 열 수 있다", async () => {
    state.list = { owned: [box()], joined: [] };
    render(<MailboxPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "우편함 닫기" }));
    expect(api.setMailboxClosed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(api.setMailboxClosed).toHaveBeenCalledWith(expect.anything(), "m1", true));
  });

  it("닫힌 우편함: 링크 복사·초대가 막히고 [다시 열기]가 있다", async () => {
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
    expect(await screen.findByRole("status")).toHaveTextContent("열려 있는 우편함이 이미 3개");
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

  it("보내는 사람으로 들어간 우편함은 링크 복사와 나가기만 — 고치기·닫기는 없다", async () => {
    state.list = { owned: [], joined: [box({ id: "j1", ownerId: "sis", name: "장모님" })] };
    render(<MailboxPanel />);
    expect(await screen.findByText("장모님")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "고치기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "우편함 닫기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(api.leaveMailbox).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "나가기" }).at(-1)!);
    await waitFor(() => expect(api.leaveMailbox).toHaveBeenCalledWith(expect.anything(), "j1", "me"));
  });
});
