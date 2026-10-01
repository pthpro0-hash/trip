import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TripDetail as Detail } from "@/lib/supabase/tripDetail";

/*
  가족이 열어 준 여행을 볼 때: 그 주인의 자료를 읽고, 고치기·지우기·공유 단추는 내지 않는다.
  (이번 단계는 어느 권한이든 보기만. DB 는 권한대로 따로 막는다.)
*/

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "나" } } }) } }),
}));
vi.mock("@/components/course/CourseMap", () => ({ CourseMap: () => null }));
vi.mock("@/components/share/TripShareDialog", () => ({ TripShareDialog: () => null }));
vi.mock("@/lib/supabase/photos", () => ({
  thumbUrls: async (_c: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://예시/${path}`])),
  signedUrls: async () => new Map(),
  deletePhoto: async () => true,
  setCoverPhoto: async () => true,
}));

const fetched = vi.fn();
const trip: Detail = {
  id: "t1",
  title: "엄마의 제주",
  subtitle: null,
  startedOn: "2026-09-13",
  endedOn: "2026-09-14",
  companions: "아빠",
  note: "비가 왔다",
  visits: [
    {
      id: "v1",
      placeName: "성산일출봉",
      spotId: null,
      dong: null,
      lat: 33.46,
      lng: 126.94,
      startedAt: new Date("2026-09-13T09:21"),
      endedAt: new Date("2026-09-13T11:04"),
      photos: [{ id: "p1", storagePath: "엄마/v1/1.webp", takenAt: new Date("2026-09-13T09:30"), isCover: true }],
    },
  ],
};
vi.mock("@/lib/supabase/tripDetail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/tripDetail")>()),
  fetchTripDetail: async (...args: unknown[]) => {
    fetched(...args);
    return trip;
  },
  fetchUsedCompanions: async () => [],
}));

async function open() {
  vi.resetModules();
  const { TripDetail } = await import("./TripDetail");
  render(<TripDetail tripId="t1" />);
  return (await screen.findByLabelText("여행 제목")) as HTMLInputElement;
}

describe("TripDetail · 가족의 여행", () => {
  beforeEach(() => {
    fetched.mockReset();
    window.sessionStorage.clear();
  });

  it("내 여행이면 고치기·지우기·공유가 모두 보인다", async () => {
    await open();
    expect(fetched.mock.calls[0][1]).toBe("나");
    expect(screen.getByRole("button", { name: "링크 공유" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /이 여행 지우기/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "성산일출봉 이름 고치기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 사진 지우기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "적어두기" })).toBeTruthy();
  });

  it("가족의 여행이면 그 주인의 자료를 읽는다", async () => {
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
    await open();
    expect(fetched.mock.calls[0][1]).toBe("엄마");
  });

  it("가족의 여행이면 — 권한이 가장 높아도 이번 단계는 — 읽기만 된다", async () => {
    window.sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "full" }));
    const title = await open();
    expect(title.value).toBe("엄마의 제주");
    expect(title.readOnly).toBe(true);
    expect(screen.getByLabelText("부제")).toHaveProperty("readOnly", true);
    for (const name of ["링크 공유", /이 여행 지우기/, "성산일출봉 이름 고치기", "이 사진 지우기", "적어두기"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    // 읽는 것은 그대로 보인다.
    expect(screen.getByText("성산일출봉")).toBeTruthy();
    expect(screen.getByDisplayValue("비가 왔다")).toBeTruthy();
  });
});
