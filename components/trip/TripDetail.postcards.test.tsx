import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TripDetail as Detail } from "@/lib/supabase/tripDetail";

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
  lines: [] as { mailboxId: string; name: string; greetingName: string | null; opened: boolean }[],
}));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchPostcardCounts: async () => counts.trips,
  fetchPhotosInPostcards: async () => counts.photos,
  fetchTripPostcardLines: async () => counts.lines,
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
    const sent = (over: Partial<(typeof counts.lines)[number]> = {}) => ({
      mailboxId: "m1",
      name: "우리 엄마 아빠",
      greetingName: "엄마 아빠",
      opened: false,
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
