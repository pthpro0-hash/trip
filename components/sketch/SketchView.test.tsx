import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";
import { tripFocus } from "@/lib/scrollMemory";

const { trips } = vi.hoisted(() => {
  const visit = (id: string, startedAt: string, photoCount: number) => ({
    id,
    placeName: "안목해변",
    spotId: null,
    dong: null,
    lat: 37.77,
    lng: 128.95,
    startedAt,
    photoCount,
  });
  return {
    trips: [
      {
        id: "t26",
        title: null,
        // 여행은 13일에 시작했고, 안목해변에는 사흘째인 15일에 갔다.
        startedOn: "2026-08-13",
        endedOn: "2026-08-15",
        companions: null,
        note: null,
        coverPath: null,
        visits: [visit("v26", "2026-08-15T10:20:00", 18)],
      },
      {
        id: "t25",
        title: null,
        startedOn: "2025-07-02",
        endedOn: "2025-07-02",
        companions: null,
        note: null,
        coverPath: null,
        visits: [visit("v25", "2025-07-02T09:00:00", 12)],
      },
    ] as SavedTrip[],
  };
});

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}));
vi.mock("@/lib/supabase/trips", () => ({ fetchTrips: async () => trips }));
vi.mock("@/lib/supabase/sketchYears", () => ({ fetchHeadlines: async () => new Map(), saveHeadline: async () => true }));
vi.mock("@/lib/supabase/photos", () => ({
  visitCovers: async () => new Map(),
  markerUrls: async () => new Map(),
  thumbUrls: async () => new Map(),
}));
vi.mock("@/lib/photo/inlinePhoto", () => ({ inlinePhoto: async () => null, inlinePhotos: async () => new Map() }));
vi.mock("@/lib/sido", () => ({ sidoOf: () => null }));
vi.mock("@/lib/sidoShapes", () => ({ sidoShapes: () => ({ list: [], points: [] }) }));
const { SketchView } = await import("./SketchView");

const selectedYear = async () => {
  const tabs = await screen.findAllByRole("tab");
  return tabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent;
};

describe("SketchView · 상세에서 돌아왔을 때", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/sketch");
  });

  it("주소에 해가 없으면 가장 최근 해", async () => {
    render(<SketchView />);
    expect(await selectedYear()).toBe("2026");
  });

  it("주소의 ?y= 로 그 해를 연다 — 2025년을 보다 나온 사람이 2025년으로 돌아온다", async () => {
    window.history.replaceState(null, "", "/sketch?y=2025");
    render(<SketchView />);
    expect(await selectedYear()).toBe("2025");
  });

  it("?y=all 이면 전체", async () => {
    window.history.replaceState(null, "", "/sketch?y=all");
    render(<SketchView />);
    expect(await selectedYear()).toBe("전체");
  });

  it("기록에 없는 해면 무시하고 가장 최근 해 — 빈 그림을 열지 않는다", async () => {
    window.history.replaceState(null, "", "/sketch?y=1999");
    render(<SketchView />);
    expect(await selectedYear()).toBe("2026");
  });

  it("목록에 남긴 '이 여행 앞에 세워 달라'는 적어 둠은 여기서 지운다 — 아무도 읽지 않는다", async () => {
    tripFocus.remember("t26");
    render(<SketchView />);
    await waitFor(() => expect(tripFocus.peek()).toBeNull());
  });
});

/*
  폰의 첫 화면에서 제목·부제·해 탭이 세 줄을 차지했다. 부제("한 해를 한 장의 그림과 이야기로")는 제목이 이미
  하는 말이라 없애고, 제목과 해 탭을 한 줄에 둔다. 제목은 불러오는 중에도 보여야 한다.
*/
describe("SketchView · 윗부분", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/sketch");
  });

  it("제목과 해 탭이 한 줄(같은 상자)에 있다", async () => {
    render(<SketchView />);
    const tabs = await screen.findByRole("tablist", { name: "해 고르기" });
    const title = screen.getByRole("heading", { level: 1, name: "한장 요약" });
    expect(title.parentElement).toBe(tabs.parentElement);
  });

  it("부제는 없다", async () => {
    render(<SketchView />);
    await screen.findByRole("tablist", { name: "해 고르기" });
    expect(screen.queryByText(/한 해를 한 장의 그림과 이야기로/)).toBeNull();
  });

  it("제목은 불러오는 중에도 보인다", () => {
    render(<SketchView />);
    expect(screen.getByRole("heading", { level: 1, name: "한장 요약" })).toBeTruthy();
  });
});

describe("SketchView · 곳의 날짜", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/sketch");
  });

  it("여행 시작일이 아니라 그곳에 간 날을 적는다", async () => {
    render(<SketchView />);
    // 여행은 8월 13일에 시작했지만 안목해변에는 15일에 갔다.
    expect(await screen.findByText("8월 15일 · 사진 18장")).toBeTruthy();
    expect(screen.queryByText("8월 13일 · 사진 18장")).toBeNull();
  });
});
