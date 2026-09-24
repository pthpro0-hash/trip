import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";

/*
  목록에서 상세로 들어가는 길을 못 박는다.

  카드 전체를 링크로 감쌀 수 없다 — 안에 지우기 단추가 있기 때문이다.
  그래서 누를 곳을 눈에 보이게 세 군데 두었고, 셋 다 같은 곳으로 가야 한다.
*/

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "나" } } }) },
  }),
}));

const rows: SavedTrip[] = [
  {
    id: "t1",
    title: "민수랑 첫 휴가",
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: "민수",
    note: null,
    coverPath: "나/v1/cover.webp",
    visits: [
      {
        id: "v1",
        placeName: "안목해변",
        spotId: null,
        dong: "강릉시 송정동",
        lat: 37.7728,
        lng: 128.9474,
        startedAt: "2026-09-14 06:11:00",
        photoCount: 18,
      },
    ],
  },
  {
    id: "t2",
    title: null,
    startedOn: "2025-07-25",
    endedOn: "2025-07-25",
    companions: null,
    note: null,
    coverPath: null,
    visits: [
      {
        id: "v2",
        placeName: "대천해수욕장",
        spotId: "대천해수욕장",
        dong: "보령시 대천5동",
        lat: 36.3,
        lng: 126.5,
        startedAt: "2025-07-25 13:00:00",
        photoCount: 4,
      },
    ],
  },
];

vi.mock("@/lib/supabase/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/trips")>()),
  fetchTrips: async () => rows,
  deleteTrip: async () => true,
}));

/** 사진 주소는 목록보다 늦게 온다. 그 늦음을 손으로 잡아 둘 수 있게. */
let 주소도착: () => void = () => undefined;
let 주소늦추기 = false;

vi.mock("@/lib/supabase/photos", () => ({
  thumbUrls: async () => {
    if (주소늦추기) await new Promise<void>((resolve) => (주소도착 = resolve));
    return new Map([["나/v1/cover.webp", "https://예시/cover.webp"]]);
  },
  missingThumbs: async () => [],
  backfillThumbs: async () => ({ made: 0, failed: 0 }),
}));

async function 목록() {
  vi.resetModules();
  const { TripList } = await import("./TripList");
  const view = render(<TripList />);
  await screen.findByText("민수랑 첫 휴가");
  return view;
}

/** 그 카드 안에서 상세로 가는 링크들. */
function 링크들(view: Awaited<ReturnType<typeof 목록>>, id: string) {
  return [...view.container.querySelectorAll(`a[href="/trips/${id}"]`)];
}

describe("TripList", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("제목 옆에 상세보기를 둔다", async () => {
    await 목록();
    const buttons = screen.getAllByText("상세보기 →");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].closest("a")).toHaveAttribute("href", "/trips/t1");
  });

  it("제목을 눌러도 상세로 간다", async () => {
    await 목록();
    expect(screen.getByText("민수랑 첫 휴가").closest("a")).toHaveAttribute(
      "href",
      "/trips/t1",
    );
  });

  it("대표 사진을 눌러도 상세로 간다", async () => {
    const view = await 목록();
    const cover = await screen.findByRole("link", { name: "민수랑 첫 휴가 상세보기" });
    expect(cover).toHaveAttribute("href", "/trips/t1");
    // 그림이 링크 안에 들어 있어야 눌러진다.
    expect(within(cover).getByRole("presentation", { hidden: true })).toBeTruthy();
    expect(링크들(view, "t1").length).toBeGreaterThanOrEqual(3);
  });

  /*
    사진 주소가 오기 전에도 그림 자리는 잡혀 있어야 한다.

    주소가 온 다음에 자리를 내주면 목록이 그때 한 번 길어진다. 보던
    자리로 돌아온 사람은 이미 옮겨진 뒤라, 스물다섯 장이 한꺼번에
    끼어들면서 맨 위로 밀려 올라간다.
  */
  it("사진 주소가 오기 전에도 그림 자리를 잡아 둔다", async () => {
    주소늦추기 = true;
    try {
      await 목록();
      const cover = await screen.findByRole("link", { name: "민수랑 첫 휴가 상세보기" });
      // 그림은 아직 없지만 높이는 이미 잡혀 있다.
      expect(cover.querySelector("img")).toBeNull();
      expect(cover.className).toContain("aspect-[16/10]");
    } finally {
      주소도착();
      주소늦추기 = false;
    }
  });

  it("사진이 없는 여행에는 그림 링크가 없다", async () => {
    const view = await 목록();
    expect(screen.queryByRole("link", { name: /2025년 7월 25일 상세보기/ })).toBeNull();
    // 제목과 상세보기 둘은 그대로 있다.
    expect(링크들(view, "t2")).toHaveLength(2);
  });

  it("이름이 없으면 날짜가 제목 자리에 선다", async () => {
    await 목록();
    expect(screen.getByText("2025년 7월 25일").closest("a")).toHaveAttribute(
      "href",
      "/trips/t2",
    );
  });

  it("읽어 주는 이름이 겹치지 않는다 — 상세보기 단추는 보조기기에서 감춘다", async () => {
    await 목록();
    // 제목 링크와 같은 곳으로 가므로, 화면 낭독기에는 한 번만 들린다.
    const detail = screen.getAllByText("상세보기 →")[0].closest("a")!;
    expect(detail).toHaveAttribute("aria-hidden", "true");
  });
});

describe("작은 판 정리 권유", () => {
  it("정리할 것이 있으면 몇 장인지 밝히고 권한다", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/photos", () => ({
      thumbUrls: async () => new Map(),
      missingThumbs: async () => ["나/v1/a.webp", "나/v1/b.webp"],
      backfillThumbs: async () => ({ made: 2, failed: 0 }),
    }));
    const { TripList } = await import("./TripList");
    render(<TripList />);

    expect(await screen.findByText(/사진 2장을 더 빠르게 열리도록/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "정리하기" })).toBeTruthy();
    vi.doUnmock("@/lib/supabase/photos");
  });

  it("권유가 터져도 목록은 뜬다 — 곁다리가 본체를 막지 않게", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/photos", () => ({
      thumbUrls: async () => new Map(),
      missingThumbs: () => {
        throw new Error("망가짐");
      },
      backfillThumbs: async () => ({ made: 0, failed: 0 }),
    }));
    const { TripList } = await import("./TripList");
    render(<TripList />);

    // 여행 목록은 그대로 나온다.
    expect(await screen.findByText("민수랑 첫 휴가")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "정리하기" })).toBeNull();
    vi.doUnmock("@/lib/supabase/photos");
  });
});

describe("보던 자리로 돌아오기", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  /** 다음 프레임에 옮기므로, 그때까지 기다려 준다. */
  const 다음프레임 = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  it("상세에서 돌아오면 보던 자리로 데려간다", async () => {
    window.sessionStorage.setItem("trips:scroll", "1840");
    window.sessionStorage.setItem("trips:restore", "1");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    await 목록();
    await 다음프레임();

    expect(scrollTo).toHaveBeenCalledWith(0, 1840);
  });

  /*
    돌아오는 길에 목록은 반드시 한 번 맨 위로 튕긴다.

    새 화면은 아직 비어 있어 문서가 짧고, 브라우저는 갈 수 없는 자리에서
    사람을 끌어내린다. Next 도 새 화면을 그리면 맨 위로 올린다. 그 튕김이
    "보던 자리"로 적히면 1840 자리에 0 이 덮여, 돌아갈 자리 자체가 사라진다.
  */
  it("돌아오는 길에 맨 위로 튕겨도 자리를 잃지 않는다", async () => {
    window.sessionStorage.setItem("trips:scroll", "1840");
    window.sessionStorage.setItem("trips:restore", "1");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    vi.resetModules();
    const { TripList } = await import("./TripList");
    render(<TripList />);
    // 목록이 오기 전. 여기서 브라우저가 맨 위로 끌어내린다.
    window.dispatchEvent(new Event("scroll"));

    await screen.findByText("민수랑 첫 휴가");
    await 다음프레임();

    expect(scrollTo).toHaveBeenCalledWith(0, 1840);
  });

  it("되짚는 동안 튕긴 자리는 적어 두지 않는다", async () => {
    window.sessionStorage.setItem("trips:scroll", "1840");
    window.sessionStorage.setItem("trips:restore", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    vi.resetModules();
    const { TripList } = await import("./TripList");
    render(<TripList />);
    window.dispatchEvent(new Event("scroll"));
    await screen.findByText("민수랑 첫 휴가");
    await 다음프레임();
    window.dispatchEvent(new Event("scroll"));

    // 되짚는 중에 들리는 자리는 사람이 고른 자리가 아니다.
    expect(window.sessionStorage.getItem("trips:scroll")).toBe("1840");
  });

  it("사람이 손을 대면 그때부터 다시 적는다", async () => {
    window.sessionStorage.setItem("trips:scroll", "1840");
    window.sessionStorage.setItem("trips:restore", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    vi.resetModules();
    const { TripList } = await import("./TripList");
    render(<TripList />);
    await screen.findByText("민수랑 첫 휴가");
    await 다음프레임();

    // 사람이 굴렸다. 되짚기는 손을 떼고, 지금 자리가 곧 보던 자리가 된다.
    window.dispatchEvent(new Event("wheel"));
    window.dispatchEvent(new Event("scroll"));

    expect(window.sessionStorage.getItem("trips:scroll")).toBe("0");
  });

  it("그냥 들어온 사람은 맨 위에서 시작한다", async () => {
    // 위 띠의 "내 스케치"를 눌러 온 경우 — 돌아가 달라는 표시가 없다.
    window.sessionStorage.setItem("trips:scroll", "1840");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    await 목록();
    await 다음프레임();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("목록을 굴리면 그 자리를 적어 둔다", async () => {
    await 목록();
    Object.defineProperty(window, "scrollY", { value: 920, configurable: true });
    window.dispatchEvent(new Event("scroll"));

    expect(window.sessionStorage.getItem("trips:scroll")).toBe("920");
  });
});
