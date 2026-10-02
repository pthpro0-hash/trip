import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TripDetail as Detail } from "@/lib/supabase/tripDetail";

/*
  엽서를 보낸 여행이나 사진을 지우려 할 때는 "엽서도 함께 지워져요"를 미리 알린다 — 모르고 지워서
  부모님 우편함에서 엽서가 사라지는 일을 막으려는 것이다. 가족 계정으로 남의 여행을 볼 때는 엽서
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
  SendPostcardDialog: () => <p>엽서 창이 열렸어요</p>,
}));
vi.mock("@/lib/supabase/photos", () => ({
  thumbUrls: async (_c: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://예시/${path}`])),
  signedUrls: async () => new Map(),
  deletePhoto: async () => true,
  setCoverPhoto: async () => true,
}));

const counts = vi.hoisted(() => ({ trips: new Map<string, number>(), photos: new Set<string>() }));
vi.mock("@/lib/supabase/postcards", () => ({
  fetchPostcardCounts: async () => counts.trips,
  fetchPhotosInPostcards: async () => counts.photos,
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
    window.sessionStorage.clear();
  });

  it("내 여행에는 [엽서 보내기]가 있고, 누르면 엽서 창이 열린다", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "엽서 보내기" }));
    expect(await screen.findByText("엽서 창이 열렸어요")).toBeTruthy();
  });

  it("가족의 여행을 볼 때는 [엽서 보내기]가 없다", async () => {
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
    await open();
    expect(screen.queryByRole("button", { name: "엽서 보내기" })).toBeNull();
  });

  it("엽서를 안 보낸 여행은 지우기 확인이 전과 같다", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /이 여행 지우기/ }));
    expect(screen.getByRole("button", { name: "정말 지울까요? 사진도 함께 사라져요" })).toBeTruthy();
  });

  it("엽서를 보낸 여행은 지우기 확인에 엽서 수가 나온다", async () => {
    counts.trips = new Map([["t1", 2]]);
    await open();
    await waitFor(() => expect(screen.getByRole("button", { name: /이 여행 지우기/ })).toBeTruthy());
    // 숫자를 받아 올 때까지 기다렸다가 누른다.
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.click(screen.getByRole("button", { name: /이 여행 지우기/ }));
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
