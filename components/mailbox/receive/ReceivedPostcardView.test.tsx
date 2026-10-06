import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReceivedPostcard } from "@/lib/supabase/mailboxPublic";
import { RECOMMENDED } from "@/lib/mailboxSettings";

const calls = vi.hoisted(() => ({ opened: vi.fn(async () => undefined), reply: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => ({}) }));
vi.mock("@/lib/supabase/mailboxPublic", async () => ({
  ...(await vi.importActual<object>("@/lib/supabase/mailboxPublic")),
  markPostcardOpened: calls.opened,
  replyToPostcard: calls.reply,
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
  ...over,
});

describe("ReceivedPostcardView · 부모님이 보는 엽서", () => {
  beforeEach(() => {
    window.localStorage.clear();
    calls.opened.mockClear();
    calls.reply.mockReset();
    calls.reply.mockResolvedValue({ ok: true });
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

  it("받는 분 이름이 없는 우편함은 '가족'으로 바로 답한다", async () => {
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

  it("우편함으로 돌아가는 길이 있다", () => {
    render(<ReceivedPostcardView token={TOKEN} card={card()} />);
    expect(screen.getByRole("link", { name: "우편함으로 가기" })).toHaveAttribute("href", `/m/${TOKEN}`);
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
