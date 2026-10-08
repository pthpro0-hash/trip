import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TripDetail } from "@/lib/supabase/tripDetail";
import type { MailboxItem } from "@/lib/supabase/mailbox";
import { RECOMMENDED } from "@/lib/mailboxSettings";

const state = vi.hoisted(() => ({ boxes: [] as MailboxItem[], joined: [] as MailboxItem[], failed: false }));
const send = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "me", user_metadata: { full_name: "김지민" } } } }) },
  }),
}));
vi.mock("@/lib/supabase/mailbox", () => ({
  fetchMailboxes: async () => (state.failed ? "failed" : { owned: state.boxes, joined: state.joined }),
  createMailbox: create,
}));
vi.mock("@/lib/supabase/postcards", () => ({ sendPostcard: send }));

const { SendPostcardDialog } = await import("./SendPostcardDialog");

const box = (over: Partial<MailboxItem>): MailboxItem => ({
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
  senderCount: 1,
  ...over,
});
const 장모님 = (over: Partial<MailboxItem> = {}) =>
  box({ id: "m2", name: "장인 장모님 책장", greetingName: "장모님", tone: "polite", token: "U".repeat(43), ...over });

const photo = (id: string, at: string, isCover = false) => ({ id, storagePath: `u/${id}.webp`, takenAt: new Date(at), isCover });
const trip: TripDetail = {
  id: "t1",
  title: "강릉 바다",
  subtitle: null,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  companions: null,
  note: null,
  visits: ["A", "B", "C", "D"].map((letter, i) => ({
    id: `v${letter}`,
    placeName: letter,
    spotId: null,
    dong: null,
    lat: 37 + i,
    lng: 128,
    startedAt: new Date(`2026-09-1${3 + (i > 1 ? 1 : 0)}T0${i}:00`),
    endedAt: new Date(`2026-09-1${3 + (i > 1 ? 1 : 0)}T0${i}:30`),
    photos: [photo(`${letter}1`, `2026-09-13T0${i}:00`, true), photo(`${letter}2`, `2026-09-13T0${i}:10`)],
  })),
};
const photoUrls = new Map(trip.visits.flatMap((visit) => visit.photos.map((p) => [p.storagePath, `https://x/${p.id}`] as const)));

const open = () => {
  const onClose = vi.fn();
  const view = render(<SendPostcardDialog userId="me" trip={trip} photoUrls={photoUrls} onClose={onClose} />);
  return { ...view, onClose };
};

const LINE = /강릉 바다 보고 왔어요/;
/** 창이 열려 책장을 읽어 온 뒤. */
const ready = () => screen.findByPlaceholderText(LINE);
const writeLine = (text: string) => fireEvent.change(screen.getByPlaceholderText(LINE), { target: { value: text } });
const openPhotos = () => fireEvent.click(screen.getByRole("button", { name: "사진 바꾸기" }));
const openShelves = () => fireEvent.click(screen.getByRole("button", { name: /받는 곳 바꾸기|인사말 고치기/ }));
const preview = () => within(screen.getByRole("group", { name: "엽서 미리보기" }));
const shelf = (name: string) => within(screen.getByRole("group", { name }));

beforeEach(() => {
  state.boxes = [box({ id: "m1" }), 장모님()];
  state.joined = [];
  state.failed = false;
  send.mockReset();
  send.mockResolvedValue({ ok: true, postcardId: "P".repeat(43) });
  create.mockReset();
  window.localStorage.clear();
});

describe("SendPostcardDialog · 책장이 하나일 때 (가장 흔한 길)", () => {
  beforeEach(() => {
    state.boxes = [box({ id: "m1" })];
  });

  it("창 이름이 받는 분을 부른다", async () => {
    open();
    await ready();
    expect(screen.getByRole("heading", { name: "엄마 아빠께 엽서 보내기" })).toBeTruthy();
  });

  it("한 줄과 보내는 이름 말고는 물어볼 것이 없다 — 사진과 인사말은 접혀 있다", async () => {
    open();
    await ready();
    expect(screen.getByText("사진 8장을 골라 뒀어요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "엽서에서 빼기" })).toBeNull();
    expect(screen.queryByLabelText("우리 엄마 아빠 인사말")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect((screen.getByLabelText("보내는 이름") as HTMLInputElement).value).toBe("김지민");
    expect(screen.getByRole("button", { name: "엽서 만들기" })).toBeEnabled();
  });

  describe("엽서 미리보기", () => {
    it("쓰기 전에는 안내가, 쓰면 받는 분께 보일 글이 바로 나온다", async () => {
      open();
      await ready();
      expect(preview().getByText("한 줄을 쓰면 여기에 이렇게 보여요")).toBeTruthy();
      writeLine("바다 보고 왔어요!");
      expect(preview().getByText("“엄마 아빠, 바다 보고 왔어요!”")).toBeTruthy();
      expect(preview().queryByText("한 줄을 쓰면 여기에 이렇게 보여요")).toBeNull();
    });

    it("보내는 이름이 부모님 화면의 제목과 같은 말(‘○○이 보낸 여행 엽서’)로 보인다", async () => {
      open();
      await ready();
      expect(preview().getByText(/김지민이 보낸 여행 엽서/)).toBeTruthy();
      fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "수아" } });
      expect(preview().getByText(/수아가 보낸 여행 엽서/)).toBeTruthy();
      fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "" } });
      expect(preview().getByText("보내는 이름을 적어 주세요")).toBeTruthy();
    });

    it("엽서에 맨 먼저 실릴 사진이 보이고, 그 사진을 빼면 다음 사진으로 바뀐다", async () => {
      const { container } = open();
      await ready();
      const hero = () => container.ownerDocument.querySelector<HTMLImageElement>("[aria-label='엽서 미리보기'] img");
      expect(hero()?.getAttribute("src")).toBe("https://x/A1");
      openPhotos();
      fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
      expect(hero()?.getAttribute("src")).toBe("https://x/A2");
    });

    it("사진을 빼고 다시 넣어도 미리보기는 엽서에 맨 먼저 실리는(여행 차례) 사진이다 — 눌러 넣은 사진이 뒤로 가지 않는다", async () => {
      const { container } = open();
      await ready();
      const hero = () => container.ownerDocument.querySelector<HTMLImageElement>("[aria-label='엽서 미리보기'] img");
      openPhotos();
      const first = () => screen.getAllByRole("button", { name: /엽서에서 빼기|엽서에 넣기/ })[0];
      fireEvent.click(first()); // A1 빼기
      expect(hero()?.getAttribute("src")).toBe("https://x/A2");
      fireEvent.click(first()); // A1 다시 넣기 — 고른 목록에서는 맨 뒤지만 엽서에는 여행 차례로 실린다
      expect(hero()?.getAttribute("src")).toBe("https://x/A1");
      expect(first()).toHaveTextContent("1");
    });

    it("사진이 하나도 없는 여행이어도 미리보기와 보내기는 된다 — 글과 지도만 간다", async () => {
      const bare: TripDetail = { ...trip, visits: trip.visits.map((visit) => ({ ...visit, photos: [] })) };
      render(<SendPostcardDialog userId="me" trip={bare} photoUrls={new Map()} onClose={vi.fn()} />);
      await ready();
      expect(screen.getByText("이 여행에는 사진이 없어요. 글과 지도만 가요.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "사진 바꾸기" })).toBeNull();
      writeLine("안녕");
      fireEvent.click(screen.getByRole("button", { name: "엽서 만들기" }));
      await waitFor(() => expect(send).toHaveBeenCalled());
      expect(send.mock.calls[0][1].photoIds).toEqual([]);
    });
  });

  it("추천 문구를 누르면 한 줄에 덧붙는다 — 말투에 맞는 것으로", async () => {
    open();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "보고 싶어요" }));
    expect((screen.getByPlaceholderText(LINE) as HTMLTextAreaElement).value).toBe("보고 싶어요");
    writeLine("바다 보고 왔어요!");
    fireEvent.click(screen.getByRole("button", { name: "다음엔 같이 가요" }));
    expect((screen.getByPlaceholderText(LINE) as HTMLTextAreaElement).value).toBe("바다 보고 왔어요! 다음엔 같이 가요");
    expect(preview().getByText("“엄마 아빠, 바다 보고 왔어요! 다음엔 같이 가요”")).toBeTruthy();
  });

  it("존댓말 책장이면 존댓말 추천이 뜬다", async () => {
    state.boxes = [장모님()];
    open();
    await ready();
    expect(screen.getByRole("heading", { name: "장모님께 엽서 보내기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "건강하시죠?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "보고 싶어요" })).toBeNull();
  });

  it("[인사말 고치기]를 열면 이 책장 인사말 칸이 나온다 — 책장을 고르는 체크는 없다", async () => {
    open();
    await ready();
    writeLine("바다 보고 왔어요!");
    openShelves();
    expect((screen.getByLabelText("우리 엄마 아빠 인사말") as HTMLTextAreaElement).value).toBe("바다 보고 왔어요!");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("만들면 사진 · 인사말 · 보내는 이름으로 보내고, 링크를 보내라는 화면이 나온다", async () => {
    open();
    await ready();
    writeLine("바다 보고 왔어요!");
    fireEvent.click(screen.getByRole("button", { name: "엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    const input = send.mock.calls[0][1];
    expect(input).toMatchObject({ senderId: "me", senderName: "김지민", maxPhotos: 20, size: 640 });
    expect(input.photoIds).toHaveLength(8);
    expect(input.deliveries).toEqual([{ mailboxId: "m1", greeting: "엄마 아빠, 바다 보고 왔어요!" }]);
    expect(await screen.findByText("엽서를 만들었어요")).toBeTruthy();
    expect(screen.getByText(/엄마 아빠가 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
  });
});

describe("SendPostcardDialog · 처음 보내는 사람 (책장이 하나도 없을 때)", () => {
  beforeEach(() => {
    state.boxes = [];
    create.mockResolvedValue({ ok: true, id: "new1", token: "N".repeat(43) });
  });

  const answer = (who: string) => fireEvent.change(screen.getByLabelText("누구에게 보내나요?"), { target: { value: who } });
  const next = () => fireEvent.click(screen.getByRole("button", { name: "다음" }));

  it("책장 만들기 화면으로 보내지 않고, 같은 창에서 누구에게 보내는지만 묻는다", async () => {
    open();
    expect(await screen.findByLabelText("누구에게 보내나요?")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByPlaceholderText(LINE)).toBeNull();
  });

  it("답하면 책장을 만들고, 같은 창에서 엽서 쓰기로 이어진다", async () => {
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    expect(await ready()).toBeTruthy();
    expect(create).toHaveBeenCalledWith(expect.anything(), "me", {
      name: "우리 엄마 아빠",
      greetingName: "엄마 아빠",
      useGreeting: true,
      tone: "casual",
      members: "엄마, 아빠",
    });
    expect(screen.getByRole("heading", { name: "엄마 아빠께 엽서 보내기" })).toBeTruthy();
  });

  it("답하면 새 걸음의 제목으로 초점이 온다 — 눌렀던 단추가 사라져도 초점이 갈 곳을 잃지 않는다", async () => {
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    await ready();
    expect(screen.getByRole("heading", { name: "엄마 아빠께 엽서 보내기" })).toHaveFocus();
  });

  it("고른 말투가 책장에 간다 — 존댓말이면 존댓말 추천이 뜬다", async () => {
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("장모님");
    fireEvent.click(screen.getByRole("radio", { name: "존댓말" }));
    next();
    expect(await screen.findByRole("button", { name: "건강하시죠?" })).toBeTruthy();
    expect(create.mock.calls[0][2]).toMatchObject({ tone: "polite", greetingName: "장모님" });
  });

  it("만든 책장으로 곧바로 엽서를 보낸다 — 인사말에 호칭이 붙고, 링크는 방금 만든 책장 것이다", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    await ready();
    writeLine("바다 보고 왔어요!");
    fireEvent.click(screen.getByRole("button", { name: "엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1].deliveries).toEqual([{ mailboxId: "new1", greeting: "엄마 아빠, 바다 보고 왔어요!" }]);
    fireEvent.click(await screen.findByRole("button", { name: "카카오톡 등으로 보내기" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${window.location.origin}/m/${"N".repeat(43)}/p/${"P".repeat(43)}` }),
      ),
    );
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("만드는 중에 엔터를 한 번 더 쳐도 두 번 만들지 않는다", async () => {
    create.mockReturnValue(new Promise(() => undefined));
    const { container } = open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    fireEvent.submit(container.ownerDocument.querySelector("[role=dialog] form")!);
    fireEvent.submit(container.ownerDocument.querySelector("[role=dialog] form")!);
    expect(create).toHaveBeenCalledTimes(1);
  });

  // 서버에는 들어갔는데 답이 오다 끊기면 '저장하지 못했어요'가 뜬다. 그때 다시 누르면 같은 책장이 또 만들어져 둘 다
  // 받는 곳으로 골라지고 부모님께 링크가 두 개 간다.
  it("저장하지 못했다고 떴는데 사실은 서버에 만들어져 있었다면, 다시 눌러도 같은 책장이 또 만들어지지 않는다", async () => {
    create.mockImplementationOnce(async () => {
      state.boxes = [box({ id: "m9", token: "Z".repeat(43) })];
      return { ok: false, reason: "failed" };
    });
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    expect(await screen.findByRole("alert")).toHaveTextContent(/저장하지 못했어요/);
    next();
    expect(await ready()).toBeTruthy(); // 같은 창에서 엽서 쓰기로 이어진다
    expect(create).toHaveBeenCalledTimes(1); // 두 번째에는 만들지 않고 이미 있는 책장을 쓴다
    expect(screen.getByRole("heading", { name: "엄마 아빠께 엽서 보내기" })).toBeTruthy();
  });

  it("만드는 도중 통신이 끊겨 오류가 터져도 단추가 영영 잠기지 않는다", async () => {
    create.mockRejectedValueOnce(new Error("끊김"));
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    expect(await screen.findByRole("alert")).toHaveTextContent(/저장하지 못했어요/);
    expect(screen.getByRole("button", { name: "다음" })).toBeEnabled();
  });

  it("비워 두고 누르면 만들지 않고 무엇이 빠졌는지 알려 준다", async () => {
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    next();
    expect(await screen.findByRole("alert")).toHaveTextContent("받는 분을 적어 주세요");
    expect(create).not.toHaveBeenCalled();
  });

  it("만드는 동안에는 단추가 잠기고 ‘만드는 중…’이라고 말한다", async () => {
    create.mockReturnValue(new Promise(() => undefined));
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마");
    next();
    const button = await screen.findByRole("button", { name: "만드는 중…" });
    expect(button).toBeDisabled();
  });

  it.each([
    ["failed", /저장하지 못했어요/],
    ["limit", /더 만들 수 없어요/],
    ["invalid", /다시 적어 주세요/],
  ])("만들지 못하면(%s) 까닭을 알리고 같은 화면에 머문다 — 답은 그대로 두어 다시 누르면 된다", async (reason, text) => {
    create.mockResolvedValueOnce({ ok: false, reason });
    open();
    await screen.findByLabelText("누구에게 보내나요?");
    answer("엄마, 아빠");
    next();
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect((screen.getByLabelText("누구에게 보내나요?") as HTMLInputElement).value).toBe("엄마, 아빠");
    expect(screen.queryByPlaceholderText(LINE)).toBeNull();
    // 다시 누르면 된다.
    next();
    expect(await ready()).toBeTruthy();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("닫은 책장만 있는 사람도 처음처럼 새로 만든다", async () => {
    state.boxes = [box({ id: "old", name: "닫은 곳", closed: true })];
    open();
    expect(await screen.findByLabelText("누구에게 보내나요?")).toBeTruthy();
  });
});

describe("SendPostcardDialog · 불러오기", () => {
  it("닫은 책장은 고를 수 없다", async () => {
    state.boxes = [box({ id: "m1" }), box({ id: "m2", name: "닫은 곳", closed: true })];
    open();
    await ready();
    openShelves();
    expect(screen.getByLabelText("우리 엄마 아빠 인사말")).toBeTruthy();
    expect(screen.queryByText("닫은 곳")).toBeNull();
    expect(screen.queryByLabelText("닫은 곳 인사말")).toBeNull();
  });

  it("내가 만든 책장과 보내는 사람으로 들어간 책장이 모두 받는 곳이다", async () => {
    state.boxes = [box({ id: "m1" })];
    state.joined = [장모님({ ownerId: "other" })];
    open();
    await ready();
    expect(screen.getByRole("button", { name: "2곳에 엽서 만들기" })).toBeTruthy();
    expect(screen.getByText("우리 엄마 아빠, 장인 장모님 책장")).toBeTruthy();
  });

  it("책장을 못 읽으면 다시 열어 달라고 한다", async () => {
    state.failed = true;
    open();
    expect(await screen.findByText(/책장을 불러오지 못했어요/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(LINE)).toBeNull();
  });

  it("카카오처럼 이름 칸이 nickname 뿐인 계정도 이름이 채워진다", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getBrowserClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: "me", email: "jimin@kakao.com", user_metadata: { nickname: "지민이" } } } }) },
      }),
    }));
    const { SendPostcardDialog: Fresh } = await import("./SendPostcardDialog");
    render(<Fresh userId="me" trip={trip} photoUrls={photoUrls} onClose={vi.fn()} />);
    await ready();
    await waitFor(() => expect((screen.getByLabelText("보내는 이름") as HTMLInputElement).value).toBe("지민이"));
    vi.doUnmock("@/lib/supabase/client");
  });

  it("이름 칸도 없으면 이메일 앞부분을 쓴다", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({
      getBrowserClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: "me", email: "jimin@example.com", user_metadata: {} } } }) },
      }),
    }));
    const { SendPostcardDialog: Fresh } = await import("./SendPostcardDialog");
    render(<Fresh userId="me" trip={trip} photoUrls={photoUrls} onClose={vi.fn()} />);
    await ready();
    await waitFor(() => expect((screen.getByLabelText("보내는 이름") as HTMLInputElement).value).toBe("jimin"));
    vi.doUnmock("@/lib/supabase/client");
  });

  it("지난번에 쓴 보내는 이름을 기억해 채운다", async () => {
    window.localStorage.setItem("postcard-sender-name", "수아");
    open();
    await ready();
    await waitFor(() => expect((screen.getByLabelText("보내는 이름") as HTMLInputElement).value).toBe("수아"));
  });
});

describe("SendPostcardDialog · 사진", () => {
  it("사진을 책장 설정만큼(기본 20장) 곳별로 자동으로 골라 둔다 — 8장짜리 여행은 8장 모두", async () => {
    open();
    await ready();
    expect(screen.getByText("사진 8장을 골라 뒀어요")).toBeTruthy();
    openPhotos();
    expect(screen.getByText("8/20")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "엽서에서 빼기" })).toHaveLength(8);
    expect(screen.queryAllByRole("button", { name: "엽서에 넣기" })).toHaveLength(0);
  });

  it("책장 설정이 6장이면 6장까지만 골라지고, 가득 차면 나머지는 막힌다", async () => {
    state.boxes = [box({ id: "m1", settings: { ...RECOMMENDED, photos: 6 } })];
    open();
    await ready();
    expect(screen.getByText("사진 6장을 골라 뒀어요")).toBeTruthy();
    openPhotos();
    expect(screen.getByText("6/6")).toBeTruthy();
    expect(screen.getByText("책장 설정에 따라 6장까지 고를 수 있어요.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "엽서에서 빼기" })).toHaveLength(6);
    const add = screen.getAllByRole("button", { name: "엽서에 넣기" });
    expect(add).toHaveLength(2);
    for (const button of add) expect(button).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    expect(screen.getByText("5/6")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "엽서에 넣기" })[0]).toBeEnabled();
  });

  it("책장이 여럿이면 가장 적은 쪽에 맞추고, 왜 그런지 알려 준다", async () => {
    state.boxes = [
      box({ id: "m1", settings: { ...RECOMMENDED, photos: 20 } }),
      장모님({ settings: { ...RECOMMENDED, photos: 6 } }),
    ];
    open();
    await ready();
    openPhotos();
    expect(screen.getByText("6/6")).toBeTruthy();
    expect(screen.getByText(/장인 장모님 책장은 6장까지라/)).toBeTruthy();
    // 그 책장을 풀면 한도가 20장으로 돌아온다.
    openShelves();
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 책장/ }));
    expect(screen.getByText("8/20")).toBeTruthy();
  });

  it("직접 고른 뒤 [추천으로 고르기]를 누르면 자동 선택으로 돌아간다", async () => {
    open();
    await ready();
    openPhotos();
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    expect(screen.getByText("6/20")).toBeTruthy();
    expect(screen.getByText("사진 6장을 골라 뒀어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "추천으로 고르기" }));
    expect(screen.getByText("8/20")).toBeTruthy();
  });

  it("사진 격자는 펼칠 때만 그려진다 — 사진이 많은 여행도 창이 가볍게 열린다", async () => {
    const { container } = open();
    await ready();
    const images = () => [...container.ownerDocument.querySelectorAll("[role=dialog] img")];
    expect(images()).toHaveLength(1); // 위 엽서 미리보기의 한 장뿐
    openPhotos();
    const grid = images().filter((image) => !image.closest("[aria-label='엽서 미리보기']"));
    expect(grid).toHaveLength(8);
    for (const image of grid) expect(image.getAttribute("loading")).toBe("lazy");
  });
});

describe("SendPostcardDialog · 받는 곳과 인사말 (책장이 여럿일 때)", () => {
  it("창 이름은 부모님께, 단추는 곳 수를 말한다", async () => {
    open();
    await ready();
    expect(screen.getByRole("heading", { name: "부모님께 엽서 보내기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2곳에 엽서 만들기" })).toBeTruthy();
    expect(screen.getByText("우리 엄마 아빠, 장인 장모님 책장")).toBeTruthy();
  });

  it("한 곳만 남기면 그분께 보내는 창이 된다", async () => {
    open();
    await ready();
    openShelves();
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 책장/ }));
    expect(screen.getByRole("heading", { name: "엄마 아빠께 엽서 보내기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "엽서 만들기" })).toBeTruthy();
  });

  it("한 줄을 쓰면 책장마다 호칭만 다르게 복사된다", async () => {
    open();
    await ready();
    writeLine("바다 보고 왔어요!");
    openShelves();
    expect(shelf("우리 엄마 아빠").getByText(/“엄마 아빠, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(shelf("장인 장모님 책장").getByText(/“장모님, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(screen.getAllByText("자동으로 채웠어요")).toHaveLength(2);
  });

  it("한 책장 인사말을 직접 고치면 그것만 따로 가고, 원래대로로 되돌린다", async () => {
    open();
    await ready();
    writeLine("바다 보고 왔어요!");
    openShelves();
    fireEvent.change(screen.getByLabelText("장인 장모님 책장 인사말"), { target: { value: "건강하시죠? 바다에 다녀왔습니다." } });
    expect(shelf("장인 장모님 책장").getByText("직접 고쳤어요")).toBeTruthy();
    expect(shelf("장인 장모님 책장").getByText(/“장모님, 건강하시죠\? 바다에 다녀왔습니다\.”/)).toBeTruthy();
    // 위 글을 고치면 고치지 않은 책장만 따라간다.
    writeLine("산 보고 왔어요");
    expect(shelf("우리 엄마 아빠").getByText(/“엄마 아빠, 산 보고 왔어요”/)).toBeTruthy();
    expect(shelf("장인 장모님 책장").getByText(/“장모님, 건강하시죠\?/)).toBeTruthy();
    fireEvent.click(shelf("장인 장모님 책장").getByRole("button", { name: "원래대로" }));
    expect(shelf("장인 장모님 책장").getByText(/“장모님, 산 보고 왔어요”/)).toBeTruthy();
  });

  it("존댓말 책장에는 그 말투의 추천 문구가 뜨고, 누르면 그 책장 인사말에만 덧붙는다", async () => {
    open();
    await ready();
    writeLine("다녀왔습니다.");
    openShelves();
    fireEvent.click(shelf("장인 장모님 책장").getByRole("button", { name: "건강하시죠?" }));
    expect((screen.getByLabelText("장인 장모님 책장 인사말") as HTMLTextAreaElement).value).toBe("다녀왔습니다. 건강하시죠?");
    expect((screen.getByLabelText("우리 엄마 아빠 인사말") as HTMLTextAreaElement).value).toBe("다녀왔습니다.");
  });
});

describe("SendPostcardDialog · 빠진 것 알려 주기", () => {
  it("한 줄이 비어 있으면 보내지 않고, 눌렀을 때 무엇이 빠졌는지 말로 알려 준다 — 단추를 흐리게 막지 않는다", async () => {
    open();
    await ready();
    const button = screen.getByRole("button", { name: "2곳에 엽서 만들기" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("한 줄을 적어 주세요");
    expect(send).not.toHaveBeenCalled();
  });

  it("보내는 이름이 비어 있어도(계정에 이름이 없을 때) 눌러서 이유를 알 수 있다", async () => {
    open();
    await ready();
    fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "" } });
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("보내는 이름을 적어 주세요");
    expect(send).not.toHaveBeenCalled();
  });

  it("받을 책장을 모두 풀고 누르면 책장을 고르라고 알려 준다", async () => {
    open();
    await ready();
    writeLine("안녕");
    openShelves();
    fireEvent.click(screen.getByRole("checkbox", { name: /우리 엄마 아빠/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 책장/ }));
    fireEvent.click(screen.getByRole("button", { name: "엽서 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("받을 책장을 골라 주세요");
    expect(send).not.toHaveBeenCalled();
  });
});

/*
  만들기 단추와 빠진 것 알림은 창 아래의 한 띠에 붙어 있다. 그래서 알림이 안 사라지면 계속 눈에 걸리고, 일이 도는 동안 창이
  닫히면 결과(링크)를 받을 길이 없다.
*/
describe("SendPostcardDialog · 알림과 잠금", () => {
  it("빠졌다는 알림은 채우는 순간 사라진다 — 아래 띠에 붙어 있어 안 사라지면 계속 눈에 걸린다", async () => {
    open();
    await ready();
    expect(screen.queryByRole("alert")).toBeNull(); // 눌러 보기 전에는 말하지 않는다
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("한 줄을 적어 주세요");
    writeLine("안녕");
    expect(screen.queryByRole("alert")).toBeNull();
    // 이미 눌러 본 뒤라, 다시 비우면 바로 알려 준다.
    fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("보내는 이름을 적어 주세요");
  });

  it("보내다 통신이 끊겨 오류가 터져도 대기 화면이 걷히고, 나가지 않았다고 알린다", async () => {
    send.mockRejectedValue(new Error("끊김"));
    open();
    await ready();
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("엽서는 나가지 않았어요");
    expect(screen.queryByText("엽서를 만들고 있어요")).toBeNull();
    expect(screen.getByRole("button", { name: "2곳에 엽서 만들기" })).toBeEnabled();
  });

  it("엽서를 만드는 동안에는 ‘엽서를 만들고 있어요’가 뜨고 Esc 로도 닫히지 않는다 — 끝나면 닫힌다", async () => {
    let finish!: (value: unknown) => void;
    send.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = open();
    await ready();
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByText("엽서를 만들고 있어요")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    finish({ ok: true, postcardId: "P".repeat(43) });
    await screen.findByText("엽서를 만들었어요");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("책장을 만드는 동안에도 Esc 로 닫히지 않는다", async () => {
    state.boxes = [];
    create.mockReturnValue(new Promise(() => undefined));
    const { onClose } = open();
    fireEvent.change(await screen.findByLabelText("누구에게 보내나요?"), { target: { value: "엄마" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await screen.findByRole("button", { name: "만드는 중…" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  // 호칭이 붙으면 본문 한도(300)만 지켜서는 부족하다 — DB 는 인사말 전체를 300자로 막아, 넘으면 사진을 올린 뒤에야 저장이 거부되고
  // 다시 눌러도 영영 안 나간다.
  it("긴 글에 호칭이 붙어도 책장마다의 인사말은 서버 한도(300자)를 넘지 않는다", async () => {
    open();
    await ready();
    writeLine("가".repeat(300));
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    const greetings = send.mock.calls[0][1].deliveries.map((delivery: { greeting: string }) => delivery.greeting);
    expect(greetings).toHaveLength(2);
    for (const greeting of greetings) expect(greeting.length).toBeLessThanOrEqual(300);
  });
});

describe("SendPostcardDialog · 만들기", () => {
  it("만들면 고른 사진·책장별 인사말·보내는 이름(계정 이름의 첫 말)으로 보낸다", async () => {
    open();
    await ready();
    writeLine("바다 보고 왔어요!");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    const input = send.mock.calls[0][1];
    expect(input.senderId).toBe("me");
    expect(input.senderName).toBe("김지민");
    expect(input.photoIds).toHaveLength(8);
    expect(input.maxPhotos).toBe(20);
    expect(input.size).toBe(640);
    expect(input.deliveries).toEqual([
      { mailboxId: "m1", greeting: "엄마 아빠, 바다 보고 왔어요!" },
      { mailboxId: "m2", greeting: "장모님, 바다 보고 왔어요!" },
    ]);
  });

  it("직접 빼고 넣은 사진 그대로 보낸다", async () => {
    open();
    await ready();
    writeLine("안녕");
    openPhotos();
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1].photoIds).toHaveLength(7);
    expect(send.mock.calls[0][1].photoIds).not.toContain("A1");
  });

  it("책장 설정의 사진 크기·한도를 보내기에 넘긴다 — 선명(960)이 한 곳이라도 있으면 선명", async () => {
    state.boxes = [
      box({ id: "m1", settings: { ...RECOMMENDED, photos: 12, size: 640 } }),
      장모님({ greetingName: null, tone: "casual", settings: { ...RECOMMENDED, photos: 20, size: 960 } }),
    ];
    open();
    await ready();
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1]).toMatchObject({ maxPhotos: 12, size: 960 });
  });

  it("책장 체크를 풀면 그곳에는 보내지 않는다", async () => {
    open();
    await ready();
    writeLine("안녕");
    openShelves();
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 책장/ }));
    fireEvent.click(screen.getByRole("button", { name: "엽서 만들기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1].deliveries.map((d: { mailboxId: string }) => d.mailboxId)).toEqual(["m1"]);
  });

  it("보낸 뒤에는 책장마다 링크를 복사·공유할 수 있고, 엽서는 그 책장 링크로 연다", async () => {
    const share = vi.fn(async () => undefined);
    const copied = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    open();
    await ready();
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByText("엽서를 만들었어요")).toBeTruthy();
    expect(screen.getByText(/받는 분들이 열어 보시면 여행 상세에서 알려 드려요/)).toBeTruthy();
    const second = screen.getByText("장인 장모님 책장").closest("li")!;
    fireEvent.click(within(second).getByRole("button", { name: "카카오톡 등으로 보내기" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: `${window.location.origin}/m/${"U".repeat(43)}/p/${"P".repeat(43)}`, text: "장모님, 안녕" }),
      ),
    );
    fireEvent.click(within(second).getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"U".repeat(43)}/p/${"P".repeat(43)}`));
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("보내는 이름은 기억해 둔다", async () => {
    open();
    await ready();
    fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "지민이" } });
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    await screen.findByText("엽서를 만들었어요");
    expect(window.localStorage.getItem("postcard-sender-name")).toBe("지민이");
  });

  it.each([
    ["photos", /사진을 옮기지 못했어요/],
    ["failed", /보내지 못했어요/],
  ])("실패(%s)하면 엽서가 나가지 않았다고 알리고, 쓴 글은 그대로 둔다", async (reason, text) => {
    send.mockResolvedValue({ ok: false, reason });
    open();
    await ready();
    writeLine("안녕");
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 만들기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("alert")).toHaveTextContent("엽서는 나가지 않았어요");
    expect((screen.getByPlaceholderText(LINE) as HTMLTextAreaElement).value).toBe("안녕");
  });
});
