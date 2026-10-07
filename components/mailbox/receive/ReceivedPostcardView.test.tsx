import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReceivedPostcard } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";

const calls = vi.hoisted(() => ({ opened: vi.fn(async () => undefined), reply: vi.fn(), heart: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/mailboxPublic", async () => ({
  ...(await vi.importActual<object>("@/lib/supabase/mailboxPublic")),
  markPostcardOpened: calls.opened,
  replyToPostcard: calls.reply,
  toggleHeart: calls.heart,
}));
// 지도 그림은 시험 안에서 잴 것이 아니다.
vi.mock("@/components/sketch/FootprintPlayer", () => ({
  FootprintPlayer: ({ heading, showMonths, shared }: { heading: string; showMonths: boolean; shared: boolean }) => (
    <p>
      지도:{heading}:{String(showMonths)}:{String(shared)}
    </p>
  ),
}));

const { ReceivedPostcardView } = await import("./ReceivedPostcardView");

const TOKEN = "T".repeat(43);
const PID = "P".repeat(43);
const whoKey = `mailbox-who:${TOKEN.slice(0, 16)}`;
const card = (over: Partial<ReceivedPostcard> = {}): ReceivedPostcard => ({
  id: PID,
  senderName: "지민",
  snapshot: {
    v: 1,
    title: "강릉 바다",
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    visits: [{ placeName: "안목해변", lat: 37.77, lng: 128.95, day: "2026-09-13", photos: ["a.webp"] }],
    files: ["a.webp", "b.webp"],
  },
  greeting: "엄마 아빠, 바다 보고 왔어요",
  sentAt: "2026-10-02T00:00:00Z",
  tone: "casual",
  settings: RECOMMENDED,
  members: ["엄마", "아빠"],
  replies: [],
  hearts: [],
  ...over,
});

describe("ReceivedPostcardView · 부모님이 보는 엽서", () => {
  beforeEach(() => {
    window.localStorage.clear();
    calls.opened.mockClear();
    calls.reply.mockReset();
    calls.reply.mockResolvedValue({ ok: true });
    calls.heart.mockReset();
    calls.heart.mockResolvedValue({ ok: true });
  });

  it("누가 보낸 엽서인지, 제목·기간·인사말이 크게 보인다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByText("지민이(가) 보낸 여행 엽서")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "강릉 바다" })).toBeTruthy();
    expect(screen.getByText("9월 13일 ~ 14일")).toBeTruthy();
    expect(screen.getByText("엄마 아빠, 바다 보고 왔어요")).toBeTruthy();
  });

  it("사진은 앨범으로 한 장씩 — 첫 사진이 엽서 보관함의 공개 주소로 크게 보이고 몇 번째인지 알린다", () => {
    const { container } = render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    const sources = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatch(/\/postcards\/P+\/a\.webp$/);
    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  it("앨범은 넘겨 볼 수 있다 — 책 한 권이 사진 여러 장이라서", () => {
    const { container } = render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/b\.webp$/);
  });

  it("사진을 못 불러오면(보낸 분이 지웠으면) 그 쪽만 부드러운 안내로 바뀐다", () => {
    const { container } = render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("보낸 분이 이 사진을 지웠어요")).toBeTruthy();
  });

  it("사진이 없는 엽서도 글과 지도로 열린다", () => {
    const { container } = render(<ReceivedPostcardView token={TOKEN} card={card({ snapshot: { ...card().snapshot, files: [] } })} />);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1, name: "강릉 바다" })).toBeTruthy();
  });

  it("지도는 '다녀온 길'로, 달 막대 없이, 눌러도 갈 곳 없는 모드로 그린다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByText("지도:다녀온 길:false:true")).toBeTruthy();
  });

  it("화면이 열리면 열어 봤다고 적는다", async () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    await waitFor(() => expect(calls.opened).toHaveBeenCalledWith(expect.anything(), TOKEN, PID));
  });

  it("누구인지 모르면 먼저 '누가 보시나요?' — 답장 단추는 그다음", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByText("누가 보시나요?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "좋구나" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "아빠" }));
    expect(screen.getByRole("button", { name: "좋구나" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "잘 다녀왔니" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "다음엔 같이 가자" })).toBeTruthy();
  });

  it("답장을 누르면 고른 이름으로 보내고, 보냈다고 말하고, 목록에 더한다", async () => {
    window.localStorage.setItem(whoKey, "엄마");
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "좋구나" }));
    await waitFor(() => expect(calls.reply).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "엄마", "좋구나"));
    expect(await screen.findByText("답장을 보냈어요")).toBeTruthy();
    expect(screen.getByRole("list", { name: "보낸 답장" })).toHaveTextContent("엄마: 좋구나");
  });

  it("이미 있던 답장도 보인다(아빠가 먼저 답했으면 엄마도 본다)", () => {
    window.localStorage.setItem(whoKey, "엄마");
    render(<ReceivedPostcardView token={TOKEN} card={card({ replies: [{ who: "아빠", reaction: "잘 다녀왔니" }] })} />);
    expect(screen.getByRole("list", { name: "보낸 답장" })).toHaveTextContent("아빠: 잘 다녀왔니");
  });

  it("받는 분 이름이 없는 책장은 '가족'으로 바로 답한다", async () => {
    render(<ReceivedPostcardView token={TOKEN} card={card({ members: [] })} />);
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음엔 같이 가자" }));
    await waitFor(() => expect(calls.reply).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "가족", "다음엔 같이 가자"));
  });

  it.each([
    ["often", /너무 자주/],
    ["closed", /닫혀 있어요/],
    ["failed", /보내지 못했어요/],
  ])("답장이 안 되면(%s) 이유를 말로 알린다", async (reason, text) => {
    calls.reply.mockResolvedValue({ ok: false, reason });
    window.localStorage.setItem(whoKey, "엄마");
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "좋구나" }));
    expect(await screen.findByRole("status")).toHaveTextContent(text);
  });

  it("책장으로 돌아가는 길이 있다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByRole("link", { name: "책장으로 가기" })).toHaveAttribute("href", `/m/${TOKEN}`);
  });

  it("답장 단추 문구는 책장 설정의 것을 쓴다 — 집마다 말투가 다르다", () => {
    window.localStorage.setItem(whoKey, "엄마");
    render(<ReceivedPostcardView token={TOKEN} card={card({ settings: { ...RECOMMENDED, words: ["고맙다", "또 가자", "잘했다"] } })} />);
    expect(screen.getByRole("button", { name: "고맙다" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "또 가자" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "좋구나" })).toBeNull();
  });

  it("설정의 글씨 크기가 배율로 내려온다", () => {
    const { container } = render(<ReceivedPostcardView token={TOKEN} card={card({ settings: { ...RECOMMENDED, font: "xlarge" } })} />);
    expect((container.querySelector("main") as HTMLElement).style.getPropertyValue("--rs")).toBe("1.2");
  });
});

describe("ReceivedPostcardView · 하트", () => {
  beforeEach(() => {
    window.localStorage.clear();
    calls.heart.mockReset();
    calls.heart.mockResolvedValue({ ok: true });
  });

  const asMom = () => window.localStorage.setItem(whoKey, "엄마");

  it("사진마다 하트(권장) — 보이는 사진에 누르면 고른 이름으로 켜고, 바로 눌린 모양이 된다", async () => {
    asMom();
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    expect(screen.getByRole("button", { name: "이 사진 하트 빼기" })).toBeTruthy();
    await waitFor(() => expect(calls.heart).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "엄마", "a.webp", true));
  });

  it("다시 누르면 하트를 끈다", async () => {
    asMom();
    render(<ReceivedPostcardView token={TOKEN} card={card({ hearts: [{ who: "엄마", file: "a.webp" }] })} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진 하트 빼기" }));
    expect(screen.getByRole("button", { name: "이 사진에 하트" })).toBeTruthy();
    await waitFor(() => expect(calls.heart).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "엄마", "a.webp", false));
  });

  it("이미 달린 하트가 보인다 — 아빠가 단 것은 숫자로, 내 것은 눌린 모양으로", () => {
    asMom();
    render(
      <ReceivedPostcardView
        token={TOKEN}
        card={card({ hearts: [{ who: "엄마", file: "a.webp" }, { who: "아빠", file: "a.webp" }, { who: "아빠", file: "b.webp" }] })}
      />,
    );
    expect(screen.getByRole("button", { name: "이 사진 하트 빼기" })).toBeTruthy();
    expect(screen.getByTestId("heart-count").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(screen.getByRole("button", { name: "이 사진에 하트" })).toBeTruthy();
    expect(screen.getByTestId("heart-count").textContent).toBe("1");
  });

  it("누구인지 모르면 하트를 보내지 않고, 먼저 고르라고 말한다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    expect(calls.heart).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("누구신지");
    expect(screen.getByText("누가 보시나요?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 사진에 하트" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("받는 분 이름이 없는 책장은 '가족'으로 바로 하트를 단다", async () => {
    render(<ReceivedPostcardView token={TOKEN} card={card({ members: [] })} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    await waitFor(() => expect(calls.heart).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "가족", "a.webp", true));
  });

  it.each([
    ["often", /너무 자주/],
    ["closed", /닫혀 있어요/],
    ["changed", /방식이 바뀌었어요/],
    ["failed", /보내지 못했어요/],
  ])("하트가 안 되면(%s) 눌린 모양을 되돌리고 이유를 말로 알린다", async (reason, text) => {
    asMom();
    calls.heart.mockResolvedValue({ ok: false, reason });
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    expect(await screen.findByRole("status")).toHaveTextContent(text);
    expect(screen.getByRole("button", { name: "이 사진에 하트" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("끄다가 안 되면 켜진 모양으로 되돌린다", async () => {
    asMom();
    calls.heart.mockResolvedValue({ ok: false, reason: "failed" });
    render(<ReceivedPostcardView token={TOKEN} card={card({ hearts: [{ who: "엄마", file: "a.webp" }] })} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진 하트 빼기" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 사진 하트 빼기" })).toBeTruthy();
  });

  it("보내는 중에 같은 사진을 또 눌러도 한 번만 보낸다", async () => {
    asMom();
    let finish: (value: { ok: true }) => void = () => undefined;
    calls.heart.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    fireEvent.click(screen.getByRole("button", { name: "이 사진 하트 빼기" }));
    expect(calls.heart).toHaveBeenCalledTimes(1);
    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "이 사진 하트 빼기" })).toBeTruthy());
  });

  it("책마다 하트(설정)면 사진에는 하트가 없고, 책 하나에 한 번 단다", async () => {
    asMom();
    render(<ReceivedPostcardView token={TOKEN} card={card({ settings: { ...RECOMMENDED, heart: "book" } })} />);
    expect(screen.queryByRole("button", { name: "이 사진에 하트" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이 여행에 하트" }));
    expect(screen.getByRole("button", { name: "이 여행 하트 빼기" })).toBeTruthy();
    await waitFor(() => expect(calls.heart).toHaveBeenCalledWith(expect.anything(), TOKEN, PID, "엄마", "", true));
  });

  it("책 하트는 누가 눌렀는지 이름으로 보인다", () => {
    asMom();
    render(
      <ReceivedPostcardView
        token={TOKEN}
        card={card({ settings: { ...RECOMMENDED, heart: "book" }, hearts: [{ who: "아빠", file: "" }, { who: "엄마", file: "" }] })}
      />,
    );
    expect(screen.getByRole("button", { name: "이 여행 하트 빼기" })).toBeTruthy();
    expect(screen.getByText("아빠, 엄마")).toBeTruthy();
  });

  it("사진이 없는 엽서에는 사진 하트가 없다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card({ snapshot: { ...card().snapshot, files: [] } })} />);
    expect(screen.queryByRole("button", { name: /하트/ })).toBeNull();
  });
});

describe("ReceivedPostcardView · 미리보기", () => {
  beforeEach(() => {
    window.localStorage.clear();
    calls.opened.mockClear();
    calls.reply.mockReset();
    calls.heart.mockReset();
  });

  const preview = () => render(<ReceivedPostcardView token={TOKEN} card={card()} preview />);

  it("맨 위에 미리보기라고 알린다", () => {
    preview();
    const note = screen.getByRole("note", { name: "미리보기" });
    expect(note).toHaveTextContent("부모님께는 아무 표시도 가지 않아요");
  });

  it("평소에는 미리보기 띠가 없다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.queryByRole("note", { name: "미리보기" })).toBeNull();
  });

  it("열어 봤다고 적지 않는다 — 부모님이 안 보셨는데 '열어 보셨어요'가 찍히면 안 된다", async () => {
    preview();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.opened).not.toHaveBeenCalled();
  });

  it("'누가 보시나요?'를 묻지 않고, 답장 단추를 그대로 보여 준다 — 부모님 화면 그대로", () => {
    preview();
    expect(screen.queryByText("누가 보시나요?")).toBeNull();
    expect(screen.getByRole("button", { name: "좋구나" })).toBeTruthy();
    expect(screen.queryByText(/\(으\)로 답장해요/)).toBeNull();
  });

  it("답장 단추를 눌러도 보내지 않고, 미리보기라서 안 보낸다고 말한다", async () => {
    preview();
    fireEvent.click(screen.getByRole("button", { name: "좋구나" }));
    expect(await screen.findByRole("status")).toHaveTextContent("미리보기라서 답장은 보내지 않아요");
    expect(calls.reply).not.toHaveBeenCalled();
    expect(screen.queryByRole("list", { name: "보낸 답장" })).toBeNull();
  });

  it("하트를 눌러도 보내지 않고, 눌린 모양도 되지 않는다 — 미리보기라서 안 보낸다고 말한다", async () => {
    preview();
    fireEvent.click(screen.getByRole("button", { name: "이 사진에 하트" }));
    expect(await screen.findByRole("status")).toHaveTextContent("미리보기라서 하트는 보내지 않아요");
    expect(calls.heart).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "이 사진에 하트" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("책마다 하트(설정)여도 마찬가지로 보내지 않는다", async () => {
    render(<ReceivedPostcardView token={TOKEN} card={card({ settings: { ...RECOMMENDED, heart: "book" } })} preview />);
    fireEvent.click(screen.getByRole("button", { name: "이 여행에 하트" }));
    expect(await screen.findByRole("status")).toHaveTextContent("미리보기라서 하트는 보내지 않아요");
    expect(calls.heart).not.toHaveBeenCalled();
  });

  it("책장으로 돌아가는 길도 미리보기로 이어진다", () => {
    preview();
    expect(screen.getByRole("link", { name: "책장으로 가기" })).toHaveAttribute("href", `/m/${TOKEN}?preview=1`);
  });

  it("평소 화면의 돌아가는 길에는 표시가 붙지 않는다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByRole("link", { name: "책장으로 가기" })).toHaveAttribute("href", `/m/${TOKEN}`);
  });
});
