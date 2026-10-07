import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";
import { LIST_HREF } from "@/lib/nav";
import { tripFocus } from "@/lib/scrollMemory";

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

const 기본: SavedTrip[] = [
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
let rows: SavedTrip[] = 기본;

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

/** 이 시험 파일 맨 위의 가짜 사진 모듈을 다시 건다. doUnmock 으로 지우면 뒤 시험이 진짜 모듈을 불러 터진다. */
function 복원() {
  vi.doMock("@/lib/supabase/photos", () => ({
    thumbUrls: async () => new Map(),
    missingThumbs: async () => [],
    backfillThumbs: async () => ({ made: 0, failed: 0 }),
  }));
}

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
    복원();
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
    복원();
  });
});

describe("표지 그림", () => {
  it("표지 그림 주소를 못 받아도 목록은 뜬다 — 그림은 곁다리다", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/photos", () => ({
      thumbUrls: async () => {
        throw new Error("연결이 끊겼다");
      },
      missingThumbs: async () => [],
      backfillThumbs: async () => ({ made: 0, failed: 0 }),
    }));
    const { TripList } = await import("./TripList");
    render(<TripList />);
    expect(await screen.findByText("민수랑 첫 휴가")).toBeTruthy();
    복원();
  });
});

describe("보던 여행으로 돌아오기", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  /** 다음 프레임에 옮기므로, 그때까지 기다려 준다. */
  const 다음프레임 = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

  /*
    돌아오면 그 여행 카드 앞에 선다.

    픽셀이 아니라 여행을 적어 둔다. 상세로 오는 길은 목록 말고도
    여럿이고(한장 요약의 점, 권역 목록, 주소 직접 열기), 돌아오는
    동안 목록은 한 번 튕기고 사진과 권유 띠가 뒤늦게 끼어들며 높이가
    바뀐다. 카드는 그 모든 것을 견딘다.
  */
  it("돌아오면 그 여행 카드 앞에 선다", async () => {
    window.sessionStorage.setItem("trip:focus", "t2");
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    await 목록();
    await 다음프레임();

    expect(document.getElementById("trip-t2")).toBeTruthy();
    expect(scrollTo).toHaveBeenCalled();
  });

  it("돌아와 선 카드에 테를 둘러 어디인지 알린다", async () => {
    window.sessionStorage.setItem("trip:focus", "t2");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    await 목록();

    expect(document.getElementById("trip-t2")?.className).toContain("ring-accent");
    expect(document.getElementById("trip-t1")?.className).not.toContain("ring-accent");
  });

  it("그냥 들어온 사람은 맨 위에서 시작한다", async () => {
    // 위 띠의 "내 여행"을 눌러 온 경우 — 적어 둔 여행이 없다.
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    await 목록();
    await 다음프레임();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("카드마다 찾을 이름표를 단다", async () => {
    await 목록();
    expect(document.getElementById("trip-t1")).toBeTruthy();
    expect(document.getElementById("trip-t2")).toBeTruthy();
  });
});

/*
  목록은 이제 내 여행 화면의 한 모습이다(/?v=sketch&view=list). 상세로 갔다가
  "← 내 여행"을 누르면 이 목록 모습으로 돌아와야 하고, 옛 /trips 주소를 거치지
  않아야 한다.
*/
describe("내 여행 목록의 길", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    rows = 기본;
  });

  it("상세로 갈 때 돌아올 곳을 목록 모습으로 적어 둔다", async () => {
    await 목록();
    const link = screen.getByText("민수랑 첫 휴가").closest("a")!;
    // 실제로 이동하지는 않는다.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(tripFocus.from()).toBe(LIST_HREF);
  });

  it("기록이 없으면 '사진 고르기'로 부른다 — 사진을 넣는 길은 어디서나 같은 말", async () => {
    rows = [];
    vi.resetModules();
    const { TripList } = await import("./TripList");
    render(<TripList />);
    expect(await screen.findByRole("link", { name: "사진 고르기" })).toHaveAttribute("href", "/trips/new");
    expect(screen.queryByText("사진에서 찾기")).toBeNull();
  });
});
