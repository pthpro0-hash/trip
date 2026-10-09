import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { TripDetail as Detail } from "@/lib/supabase/tripDetail";
import type { TripPostcardLine } from "@/lib/supabase/postcards";
import { REPLIES_SEEN } from "@/lib/mailboxEvents";

/*
  엽서를 보낸 여행이나 사진을 지우려 할 때는 "엽서도 함께 지워져요"를 미리 알린다 — 모르고 지워서
  부모님 책장에서 엽서가 사라지는 일을 막으려는 것이다. 가족 계정으로 남의 여행을 볼 때는 엽서
  보내기를 내지 않는다(엽서는 내 여행으로만 보낸다).
*/

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "나" } } }) } }),
}));
vi.mock("@/components/course/CourseMap", () => ({ CourseMap: () => null }));
vi.mock("@/components/share/TripShareDialog", () => ({ TripShareDialog: () => null }));
vi.mock("@/components/mailbox/SendPostcardDialog", () => ({
  SendPostcardDialog: ({ onClose }: { onClose: () => void }) => (
    <div>
      <p>엽서 창이 열렸어요</p>
      <button type="button" onClick={onClose}>
        엽서 창 닫기
      </button>
    </div>
  ),
}));
vi.mock("@/lib/supabase/photos", () => ({
  thumbUrls: async (_c: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://예시/${path}`])),
  signedUrls: async () => new Map(),
  deletePhoto: async () => true,
  setCoverPhoto: async () => true,
}));

const counts = vi.hoisted(() => ({
  trips: new Map<string, number>(),
  photos: new Set<string>(),
  lines: [] as TripPostcardLine[],
}));
/** 답장·하트를 '봤다'고 적는 호출(처음 본 id 만 와야 한다). */
const marks = vi.hoisted(() => ({
  replies: vi.fn<(client: unknown, ids: string[]) => Promise<boolean>>(async () => true),
  hearts: vi.fn<(client: unknown, ids: string[]) => Promise<boolean>>(async () => true),
}));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchPostcardCounts: async () => counts.trips,
  fetchPhotosInPostcards: async () => counts.photos,
  fetchTripPostcardLines: async () => counts.lines,
  markRepliesSeen: marks.replies,
  markHeartsSeen: marks.hearts,
}));

const trip: Detail = {
  id: "t1",
  title: "강릉 바다",
  subtitle: null,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  companions: null,
  note: null,
  visits: [
    {
      id: "v1",
      placeName: "안목해변",
      spotId: null,
      dong: null,
      lat: 37.77,
      lng: 128.94,
      startedAt: new Date("2026-09-13T09:21"),
      endedAt: new Date("2026-09-13T11:04"),
      photos: [
        { id: "p1", storagePath: "나/v1/1.webp", takenAt: new Date("2026-09-13T09:30"), isCover: true },
        { id: "p2", storagePath: "나/v1/2.webp", takenAt: new Date("2026-09-13T09:40"), isCover: false },
      ],
    },
  ],
};
vi.mock("@/lib/supabase/tripDetail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/tripDetail")>()),
  fetchTripDetail: async () => trip,
  fetchUsedCompanions: async () => [],
}));

async function open() {
  vi.resetModules();
  const { TripDetail } = await import("./TripDetail");
  render(<TripDetail tripId="t1" />);
  await screen.findByLabelText("여행 제목");
}

describe("TripDetail · 엽서", () => {
  beforeEach(() => {
    counts.trips = new Map();
    counts.photos = new Set();
    counts.lines = [];
    marks.replies.mockClear();
    marks.hearts.mockClear();
    window.sessionStorage.clear();
  });

  /** 지우기는 "⋯" 안에 있다. */
  const 지우기 = () => {
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    fireEvent.click(screen.getByRole("button", { name: /이 여행 지우기/ }));
  };

  it("내 여행에서 [공유] → [부모님께 엽서 보내기]를 고르면 엽서 창이 열린다", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "공유" }));
    fireEvent.click(await screen.findByRole("button", { name: /부모님께 엽서 보내기/ }));
    expect(await screen.findByText("엽서 창이 열렸어요")).toBeTruthy();
    // 고르는 시트는 닫히고, 창이 겹쳐 뜨지 않는다.
    expect(screen.queryByRole("dialog", { name: /공유하기/ })).toBeNull();
  });

  it("가족의 여행을 볼 때는 공유도 엽서도 없다", async () => {
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
    await open();
    expect(screen.queryByRole("button", { name: "공유" })).toBeNull();
    expect(screen.queryByRole("button", { name: "엽서 보내기" })).toBeNull();
  });

  describe("보낸 엽서 — 열어 보셨는지", () => {
    const sent = (over: Partial<TripPostcardLine> = {}): TripPostcardLine => ({
      mailboxId: "m1",
      name: "우리 엄마 아빠",
      greetingName: "엄마 아빠",
      opened: false,
      postcardId: "P".repeat(43),
      senderName: "김지민",
      greeting: "엄마 아빠, 바다 보고 왔어요",
      token: "T".repeat(43),
      replies: [],
      hearts: [],
      ...over,
    });
    const status = () => screen.queryByRole("list", { name: "보낸 엽서" });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

    it("엽서를 보낸 여행에는 공유 줄 아래에 받는 곳 상태가 나온다", async () => {
      counts.lines = [sent()];
      await open();
      expect(await screen.findByRole("list", { name: "보낸 엽서" })).toHaveTextContent(
        "엄마 아빠께 엽서를 보냈어요 · 아직 안 열어 보셨어요",
      );
    });

    it("열어 보셨으면 열어 보셨다고 나온다", async () => {
      counts.lines = [sent({ opened: true })];
      await open();
      expect(await screen.findByRole("list", { name: "보낸 엽서" })).toHaveTextContent("열어 보셨어요 ✓");
    });

    it("엽서를 안 보낸 여행에는 줄이 없다", async () => {
      await open();
      await settle();
      expect(status()).toBeNull();
    });

    it("가족의 여행을 볼 때는 줄이 없다 — 엽서는 내 여행으로만 보낸다", async () => {
      window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
      counts.lines = [sent()];
      await open();
      await settle();
      expect(status()).toBeNull();
    });

    it("안 열어 보셨으면 [다시 보내기] — 그 엽서의 링크로 공유창을 연다", async () => {
      const share = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "share", { value: share, configurable: true });
      counts.lines = [sent()];
      await open();
      fireEvent.click(await screen.findByRole("button", { name: "엄마 아빠께 엽서 다시 보내기" }));
      await waitFor(() =>
        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({ url: `${window.location.origin}/m/${"T".repeat(43)}/p/${"P".repeat(43)}`, text: "엄마 아빠, 바다 보고 왔어요" }),
        ),
      );
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });

    describe("부모님의 답장·하트", () => {
      const reply = (id: string, who: string, reaction: string, seen: boolean) => ({
        id,
        mailboxId: "m1",
        who,
        reaction,
        at: "2026-10-06T00:00:00Z",
        seen,
      });
      const heart = (id: string, who: string, file: string, seen: boolean) => ({ id, mailboxId: "m1", who, file, seen });

      it("답장과 하트가 그 줄 아래에 보이고, 처음 본 것에는 ‘새 답장’·‘새 하트’가 붙는다", async () => {
        counts.lines = [sent({ opened: true, replies: [reply("r1", "엄마", "좋구나", false)], hearts: [heart("h1", "아빠", "a.webp", false)] })];
        await open();
        const list = await screen.findByRole("list", { name: "보낸 엽서" });
        expect(within(list).getByText("엄마가 ‘좋구나’ 하셨어요")).toBeTruthy();
        expect(within(list).getByText("새 답장")).toBeTruthy();
        expect(within(list).getByText("아빠가 사진 1장에 하트를 눌렀어요")).toBeTruthy();
        expect(within(list).getByText("새 하트")).toBeTruthy();
      });

      it("보여 주는 순간 ‘봤다’고 적고 위 띠에 알린다 — 처음 본 것만", async () => {
        const heard = vi.fn();
        window.addEventListener(REPLIES_SEEN, heard);
        counts.lines = [
          sent({
            opened: true,
            replies: [reply("r1", "엄마", "좋구나", true), reply("r2", "아빠", "잘 다녀왔니", false)],
            hearts: [heart("h1", "엄마", "a.webp", false)],
          }),
        ];
        await open();
        await waitFor(() => expect(marks.replies).toHaveBeenCalled());
        expect(marks.replies.mock.calls[0][1]).toEqual(["r2"]);
        expect(marks.hearts.mock.calls[0][1]).toEqual(["h1"]);
        await waitFor(() => expect(heard).toHaveBeenCalled());
        window.removeEventListener(REPLIES_SEEN, heard);
      });

      it("이미 다 본 반응은 새 표시도, ‘봤다’는 기록도 없다", async () => {
        counts.lines = [sent({ opened: true, replies: [reply("r1", "엄마", "좋구나", true)], hearts: [heart("h1", "엄마", "a.webp", true)] })];
        await open();
        await screen.findByText("엄마가 ‘좋구나’ 하셨어요");
        await settle();
        expect(screen.queryByText("새 답장")).toBeNull();
        expect(screen.queryByText("새 하트")).toBeNull();
        expect(marks.replies).not.toHaveBeenCalled();
        expect(marks.hearts).not.toHaveBeenCalled();
      });

      it("엽서 창을 닫아 다시 읽어도(그새 ‘봤다’고 적혔어도) 이 화면에 머무는 동안은 ‘새 답장’이 남아 있다", async () => {
        counts.lines = [sent({ opened: true, replies: [reply("r1", "엄마", "좋구나", false)] })];
        await open();
        await screen.findByText("새 답장");
        // 두 번째로 읽을 때는 이미 봤다고 적혀 있다.
        counts.lines = [sent({ opened: true, replies: [reply("r1", "엄마", "좋구나", true)] })];
        fireEvent.click(screen.getByRole("button", { name: "공유" }));
        fireEvent.click(await screen.findByRole("button", { name: /부모님께 엽서 보내기/ }));
        await screen.findByText("엽서 창이 열렸어요");
        fireEvent.click(screen.getByRole("button", { name: "엽서 창 닫기" }));
        await settle();
        expect(screen.getByText("새 답장")).toBeTruthy();
      });

      it("가족의 여행을 볼 때는 읽지도, ‘봤다’고 적지도 않는다 — 남의 반응이다", async () => {
        window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
        counts.lines = [sent({ opened: true, replies: [reply("r1", "엄마", "좋구나", false)] })];
        await open();
        await settle();
        expect(status()).toBeNull();
        expect(marks.replies).not.toHaveBeenCalled();
      });
    });

    it("엽서를 보내고 창을 닫으면 줄이 새로 읽혀 바로 나온다", async () => {
      await open();
      await settle();
      expect(status()).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "공유" }));
      fireEvent.click(await screen.findByRole("button", { name: /부모님께 엽서 보내기/ }));
      await screen.findByText("엽서 창이 열렸어요");
      counts.lines = [sent()];
      fireEvent.click(screen.getByRole("button", { name: "엽서 창 닫기" }));
      expect(await screen.findByRole("list", { name: "보낸 엽서" })).toHaveTextContent("엄마 아빠께 엽서를 보냈어요");
    });
  });

  it("엽서를 안 보낸 여행은 지우기 확인이 전과 같다", async () => {
    await open();
    지우기();
    expect(screen.getByRole("button", { name: "정말 지울까요? 사진도 함께 사라져요" })).toBeTruthy();
  });

  it("엽서를 보낸 여행은 지우기 확인에 엽서 수가 나온다", async () => {
    counts.trips = new Map([["t1", 2]]);
    await open();
    await waitFor(() => expect(screen.getByRole("button", { name: "더 보기" })).toBeTruthy());
    // 숫자를 받아 올 때까지 기다렸다가 누른다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    지우기();
    expect(screen.getByRole("button", { name: "정말 지울까요? 사진과 보낸 엽서 2장이 함께 사라져요" })).toBeTruthy();
  });

  it("엽서에 쓴 사진을 지우려 하면 엽서에서도 사라진다고 알리고, 안 쓴 사진은 알리지 않는다", async () => {
    counts.photos = new Set(["p1"]);
    await open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const buttons = screen.getAllByRole("button", { name: "이 사진 지우기" });
    fireEvent.click(buttons[1]);
    expect(screen.queryByText(/엽서에 쓴 사진이에요/)).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "이 사진 지우기" })[0]);
    expect(await screen.findByText(/엽서에 쓴 사진이에요/)).toBeTruthy();
  });
});
