import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TripDetail } from "@/lib/supabase/tripDetail";
import type { MailboxItem } from "@/lib/supabase/mailbox";
import { RECOMMENDED } from "@/lib/mailboxSettings";

const state = vi.hoisted(() => ({ boxes: [] as MailboxItem[] }));
const send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "me", user_metadata: { full_name: "김지민" } } } }) },
  }),
}));
vi.mock("@/lib/supabase/mailbox", () => ({
  fetchMailboxes: async () => ({ owned: state.boxes, joined: [] }),
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

const open = () => render(<SendPostcardDialog userId="me" trip={trip} photoUrls={photoUrls} onClose={vi.fn()} />);

describe("SendPostcardDialog", () => {
  beforeEach(() => {
    state.boxes = [box({ id: "m1" }), box({ id: "m2", name: "장인 장모님 우편함", greetingName: "장모님", tone: "polite", token: "U".repeat(43) })];
    send.mockReset();
    send.mockResolvedValue({ ok: true, postcardId: "P".repeat(43) });
    window.localStorage.clear();
  });

  it("우편함이 없으면 만들러 가는 안내", async () => {
    state.boxes = [];
    open();
    expect(await screen.findByRole("link", { name: "우편함을 만들어" })).toHaveAttribute("href", "/mailboxes");
  });

  it("닫은 우편함은 고를 수 없다", async () => {
    state.boxes = [box({ id: "m1" }), box({ id: "m2", name: "닫은 곳", closed: true })];
    open();
    expect(await screen.findByText("우리 엄마 아빠")).toBeTruthy();
    expect(screen.queryByText("닫은 곳")).toBeNull();
  });

  it("사진을 책장 설정만큼(기본 20장) 곳별로 자동으로 골라 둔다 — 8장짜리 여행은 8장 모두", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    expect(screen.getByText("8/20")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "엽서에서 빼기" })).toHaveLength(8);
    expect(screen.queryAllByRole("button", { name: "엽서에 넣기" })).toHaveLength(0);
  });

  it("책장 설정이 6장이면 6장까지만 골라지고, 가득 차면 나머지는 막힌다", async () => {
    state.boxes = [box({ id: "m1", settings: { ...RECOMMENDED, photos: 6 } })];
    open();
    await screen.findByText("우리 엄마 아빠");
    expect(screen.getByText("6/6")).toBeTruthy();
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
      box({ id: "m2", name: "장인 장모님 우편함", greetingName: "장모님", tone: "polite", token: "U".repeat(43), settings: { ...RECOMMENDED, photos: 6 } }),
    ];
    open();
    await screen.findByText("우리 엄마 아빠");
    expect(screen.getByText("6/6")).toBeTruthy();
    expect(screen.getByText(/장인 장모님 우편함은 6장까지라/)).toBeTruthy();
    // 그 책장을 풀면 한도가 20장으로 돌아온다.
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 우편함/ }));
    expect(screen.getByText("8/20")).toBeTruthy();
  });

  it("직접 고른 뒤 [추천으로 고르기]를 누르면 자동 선택으로 돌아간다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "엽서에서 빼기" })[0]);
    expect(screen.getByText("6/20")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "추천으로 고르기" }));
    expect(screen.getByText("8/20")).toBeTruthy();
  });

  it("사진 그림은 필요할 때만 받는다(lazy) — 사진이 많은 여행도 창이 가볍게 열린다", async () => {
    const { container } = open();
    await screen.findByText("우리 엄마 아빠");
    const images = [...container.ownerDocument.querySelectorAll("[role=dialog] img")];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) expect(image.getAttribute("loading")).toBe("lazy");
  });

  it("한 줄을 쓰면 우편함마다 호칭만 다르게 복사된다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "바다 보고 왔어요!" } });
    expect(screen.getByText(/“엄마 아빠, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(screen.getByText(/“장모님, 바다 보고 왔어요!”/)).toBeTruthy();
    expect(screen.getAllByText("자동으로 채웠어요")).toHaveLength(2);
  });

  it("한 우편함 인사말을 직접 고치면 그것만 따로 가고, 원래대로로 되돌린다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "바다 보고 왔어요!" } });
    fireEvent.change(screen.getByLabelText("장인 장모님 우편함 인사말"), { target: { value: "건강하시죠? 바다에 다녀왔습니다." } });
    expect(screen.getByText("직접 고쳤어요")).toBeTruthy();
    expect(screen.getByText(/“장모님, 건강하시죠\? 바다에 다녀왔습니다\.”/)).toBeTruthy();
    // 위 글을 고치면 고치지 않은 우편함만 따라간다.
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "산 보고 왔어요" } });
    expect(screen.getByText(/“엄마 아빠, 산 보고 왔어요”/)).toBeTruthy();
    expect(screen.getByText(/“장모님, 건강하시죠\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "원래대로" }));
    expect(screen.getByText(/“장모님, 산 보고 왔어요”/)).toBeTruthy();
  });

  it("존댓말 우편함에는 추천 문구가 뜨고, 누르면 덧붙는다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "다녀왔습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "건강하시죠?" }));
    expect((screen.getByLabelText("장인 장모님 우편함 인사말") as HTMLTextAreaElement).value).toBe("다녀왔습니다. 건강하시죠?");
  });

  it("한 줄이 비어 있으면 보내지 않고, 눌렀을 때 무엇이 빠졌는지 말로 알려 준다 — 단추를 흐리게 막지 않는다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    const button = screen.getByRole("button", { name: "2곳에 엽서 보내기" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("한 줄을 적어 주세요");
    expect(send).not.toHaveBeenCalled();
  });

  it("보내는 이름이 비어 있어도(계정에 이름이 없을 때) 눌러서 이유를 알 수 있다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "" } });
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("보내는 이름을 적어 주세요");
    expect(send).not.toHaveBeenCalled();
  });

  it("받을 우편함을 모두 풀고 누르면 우편함을 고르라고 알려 준다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /우리 엄마 아빠/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 우편함/ }));
    fireEvent.click(screen.getByRole("button", { name: "엽서 보내기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("받을 우편함을 골라 주세요");
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
    await screen.findByText("우리 엄마 아빠");
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
    await screen.findByText("우리 엄마 아빠");
    await waitFor(() => expect((screen.getByLabelText("보내는 이름") as HTMLInputElement).value).toBe("jimin"));
    vi.doUnmock("@/lib/supabase/client");
  });

  it("보내면 고른 사진·우편함별 인사말·보내는 이름(계정 이름의 첫 말)으로 보낸다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "바다 보고 왔어요!" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
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

  it("책장 설정의 사진 크기·한도를 보내기에 넘긴다 — 선명(960)이 한 곳이라도 있으면 선명", async () => {
    state.boxes = [
      box({ id: "m1", settings: { ...RECOMMENDED, photos: 12, size: 640 } }),
      box({ id: "m2", name: "장인 장모님 우편함", token: "U".repeat(43), settings: { ...RECOMMENDED, photos: 20, size: 960 } }),
    ];
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1]).toMatchObject({ maxPhotos: 12, size: 960 });
  });

  it("우편함 체크를 풀면 그곳에는 보내지 않는다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /장인 장모님 우편함/ }));
    fireEvent.click(screen.getByRole("button", { name: "엽서 보내기" }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][1].deliveries.map((d: { mailboxId: string }) => d.mailboxId)).toEqual(["m1"]);
  });

  it("보낸 뒤에는 우편함마다 링크를 복사·공유할 수 있고, 엽서는 그 우편함 링크로 연다", async () => {
    const share = vi.fn(async () => undefined);
    const copied = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
    expect(await screen.findByText("엽서를 만들었어요")).toBeTruthy();
    const second = screen.getByText("장인 장모님 우편함").closest("li")!;
    fireEvent.click(within(second).getByRole("button", { name: "카카오톡 등으로 보내기" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/m/${"U".repeat(43)}/p/${"P".repeat(43)}`, text: "장모님, 안녕" })),
    );
    fireEvent.click(within(second).getByRole("button", { name: "링크 복사" }));
    await waitFor(() => expect(copied).toHaveBeenCalledWith(`${window.location.origin}/m/${"U".repeat(43)}/p/${"P".repeat(43)}`));
  });

  it("보내는 이름은 기억해 둔다", async () => {
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByLabelText("보내는 이름"), { target: { value: "지민이" } });
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
    await screen.findByText("엽서를 만들었어요");
    expect(window.localStorage.getItem("postcard-sender-name")).toBe("지민이");
  });

  it.each([
    ["photos", /사진을 옮기지 못했어요/],
    ["failed", /보내지 못했어요/],
  ])("실패(%s)하면 엽서가 나가지 않았다고 알린다", async (reason, text) => {
    send.mockResolvedValue({ ok: false, reason });
    open();
    await screen.findByText("우리 엄마 아빠");
    fireEvent.change(screen.getByPlaceholderText(/강릉 바다 보고 왔어요/), { target: { value: "안녕" } });
    fireEvent.click(screen.getByRole("button", { name: "2곳에 엽서 보내기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("alert")).toHaveTextContent("엽서는 나가지 않았어요");
  });
});
