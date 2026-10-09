import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ReadResult } from "@/lib/photo/readShots";
import type { DateRange } from "@/lib/supabase/trips";
import { MAP_HREF, SKETCH_HREF } from "@/lib/nav";
import { readStart } from "@/lib/start";
import type { StashMeta } from "@/lib/photo/stash";
import { groupIntoTrips } from "@/lib/photo/grouping";
import { toStashed } from "@/lib/photo/stashTrips";

/*
  사진을 고른 뒤의 화면을 본다.

  묶기 규칙 자체는 순수 함수 쪽에서 재고, 여기서는 사람이 손대는 부분만
  본다 — 제목을 짓는 것, 잘못 묶인 것을 나누는 것, 도로 합치는 것.
  실제 파일 대신 읽어낸 결과를 바로 끼워 넣는다.

  길은 세 걸음이다 — 고르기 · 확인 · 기록. 확인 화면의 여행 카드는 곳 목록 · 동행 · 나누기 · 합치기를
  "다듬기" 안에 접어 두고, 아래에는 기록 막대가 붙는다.
*/

const 고성 = { lat: 38.4798, lng: 128.4391 };
const 강릉 = { lat: 37.7728, lng: 128.9474 };
const 송정 = { lat: 37.7863, lng: 128.9303 };
/** 안목에서 1km 남짓 떨어진 곳. 방문은 나뉘지만 불리는 이름은 같다. */
const 안목위쪽 = { lat: 37.7828, lng: 128.9474 };

const shot = (id: string, iso: string, at: { lat: number; lng: number }) => ({
  id,
  takenAt: new Date(iso),
  ...at,
});

// 09-13 고성 → 하루 자고 90km 떨어진 09-14 강릉. 한 여행일 수도, 아닐 수도 있다.
const 이틀 = [
  shot("a.jpg", "2026-09-13T09:21", 고성),
  shot("b.jpg", "2026-09-13T09:27", 고성),
  shot("c.jpg", "2026-09-14T06:11", 강릉),
  shot("d.jpg", "2026-09-14T08:41", 강릉),
  shot("e.jpg", "2026-09-14T10:02", 송정),
];

// 석 달 떨어진 두 나들이 — 합칠 수 있는 사이가 아니다.
const 두여행 = [shot("a.jpg", "2026-06-13T09:00", 고성), shot("b.jpg", "2026-09-14T09:00", 강릉)];

const readShots = vi.fn<(files: File[]) => Promise<ReadResult>>();
const saveTrip = vi.fn();
const uploadPhotos = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const uploadPrepared = vi.fn<(...args: unknown[]) => Promise<unknown>>();

/*
  로그인하러 떠나기 전에 사진을 이 브라우저에 맡기고(lib/photo/prepare · stash), 돌아오면 꺼낸다. jsdom 에는 저장소가 없으니 가짜를 끼운다.
  기본은 '맡을 수 없는 브라우저'다 — 그러면 예전과 똑같이 동작해야 한다.
*/
const stashed = {
  /** 이 브라우저가 사진을 맡아 둘 수 있는가(probe). */
  available: false,
  /** 맡아 둔 것(돌아와서 읽는다). */
  meta: null as StashMeta | null,
  /** 맡겨 둔 것을 지운 횟수. */
  clears: 0,
  /** 읽기를 이것이 풀릴 때까지 늦춘다(읽어 오는 사이 사람이 먼저 손대는 경우를 만든다). */
  gate: Promise.resolve() as Promise<void>,
};
type PrepareInput = {
  shots: { id: string }[];
  meta: Record<string, unknown>;
  onProgress?: (done: number, total: number, elapsedMs: number) => void;
};
const prepareForLogin = vi.fn<(input: PrepareInput) => Promise<boolean>>();
/** 로그인으로 떠나는 일(창의 location 은 시험에서 바꿀 수 없다). */
const goTo = vi.fn<(href: string) => void>();

vi.mock("@/lib/photo/stash", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photo/stash")>()),
  probeStash: async () => stashed.available,
  readStash: async () => {
    await stashed.gate;
    return stashed.meta;
  },
  loadStashedPhoto: async (id: string) => ({ full: new Blob([id]), thumb: new Blob([`thumb:${id}`], { type: "image/webp" }), marker: new Blob([id]) }),
  clearStash: async () => {
    stashed.clears += 1;
    stashed.meta = null;
  },
}));
vi.mock("@/lib/photo/prepare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photo/prepare")>()),
  prepareForLogin: (input: PrepareInput) => prepareForLogin(input),
}));
vi.mock("@/lib/goTo", () => ({ goTo: (href: string) => goTo(href) }));

let currentUser: { id: string } | null = { id: "나" };
let savedRanges: DateRange[] = [];

vi.mock("@/lib/photo/readShots", () => ({ readShots: (files: File[]) => readShots(files) }));

vi.mock("@/lib/supabase/photos", () => ({
  uploadPhotos: (...args: unknown[]) => uploadPhotos(...args),
  uploadPrepared: (...args: unknown[]) => uploadPrepared(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

vi.mock("@/lib/supabase/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/trips")>()),
  fetchSavedRanges: async () => savedRanges,
  saveTrip: (...args: unknown[]) => saveTrip(...args),
}));

// 작은 그림은 따로 시험한다. 여기서는 카드마다 어떤 사진을 건넸는지만 본다.
vi.mock("./photoImport/TripThumbs", () => ({
  TripThumbs: ({ files }: { files: File[] }) => <div data-testid="thumbs">{files.map((file) => file.name).join(",")}</div>,
}));

/** 좌표가 몇 개 오든 이름을 지어 돌려주는 가짜 /api/place. */
const 이름표: Record<string, string> = {
  "38.480,128.439": "화진포해변",
  "37.773,128.947": "안목해변",
  "37.783,128.947": "안목해변",
  "37.786,128.930": "송정해변",
};

function 장소응답(points: { lat: number; lng: number }[]) {
  return {
    places: points.map((point) => ({
      title: 이름표[`${point.lat.toFixed(3)},${point.lng.toFixed(3)}`] ?? "어딘가",
      isCuratedSpot: false,
      spotId: null,
      dong: null,
    })),
  };
}

async function 화면열기() {
  const { PhotoImport } = await import("./PhotoImport");
  return render(<PhotoImport />);
}

async function 사진넣기(shots = 이틀) {
  readShots.mockResolvedValue({
    shots,
    withoutLocation: [],
    screenshots: [],
    unreadable: [],
  });

  const view = await 화면열기();

  const input = view.container.querySelector('input[type="file"]')!;
  const files = shots.map((s) => new File(["x"], s.id, { type: "image/jpeg" }));
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);

  await screen.findByText(/여행 \d건을 찾았어요/);
  return view;
}

const 제목칸 = () => screen.getAllByLabelText("여행 제목") as HTMLInputElement[];

/** 접혀 있는 카드의 "다듬기"를 모두 연다. */
function 다듬기열기() {
  for (const button of screen.getAllByRole("button", { name: /^(다듬기|방문한 곳 보기)/ })) {
    if (button.getAttribute("aria-expanded") === "false") fireEvent.click(button);
  }
}

const 지금걸음 = () =>
  screen.getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "step")?.textContent;

const 기록단추 = (건수 = 1) => screen.findByRole("button", { name: new RegExp(`여행 ${건수}건 기록하기`) });

/**
 * 링크를 눌러 보고, 앱이 이동(기본 동작)을 막았는지 알려 준다. 막지 않은 클릭은 jsdom 이 실제로 이동하려 들어 소리를 내므로,
 * 앱의 처리가 모두 끝난 맨 마지막에 우리가 막는다.
 */
function 링크누름(link: HTMLElement): boolean {
  let 막음 = false;
  const 마지막 = (event: Event) => {
    막음 = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", 마지막);
  fireEvent.click(link);
  document.removeEventListener("click", 마지막);
  return 막음;
}

describe("PhotoImport", () => {
  beforeEach(() => {
    vi.resetModules();
    readShots.mockReset();
    saveTrip.mockReset();
    saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: [] });
    uploadPhotos.mockReset();
    uploadPhotos.mockResolvedValue({ uploaded: 0, unsupported: [], overLimit: 0, failed: 0 });
    uploadPrepared.mockReset();
    uploadPrepared.mockResolvedValue({ uploaded: 0, unsupported: [], overLimit: 0, failed: 0 });
    prepareForLogin.mockReset();
    prepareForLogin.mockResolvedValue(true);
    goTo.mockReset();
    stashed.available = false;
    stashed.meta = null;
    stashed.clears = 0;
    stashed.gate = Promise.resolve();
    window.history.replaceState({}, "", "/");
    currentUser = { id: "나" };
    savedRanges = [];
    sessionStorage.clear();
    // 완료 화면이 맨 위로 올린다. 시험이 끝난 뒤 늦게 도착하는 저장에도 jsdom 의 "구현되지 않음" 소리가 나지 않게,
    // 되돌리지 않는 가짜를 둔다(창은 파일마다 따로 만들어진다).
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => ({
      ok: true,
      json: async () => 장소응답(JSON.parse(String(init.body)).points),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("장소에서 제목을 지어 미리 넣어 둔다", async () => {
    await 사진넣기();
    // 화진포 2장 · 안목 2장 · 송정 1장. 많이 찍은 곳이 앞에 서고
    // (같으면 먼저 들른 곳이) 나머지는 수로 적힌다.
    await waitFor(() => expect(제목칸()[0].value).toBe("화진포해변 외 2곳"));
  });

  it("고쳐 쓴 제목 그대로 기록한다", async () => {
    await 사진넣기();
    await waitFor(() => expect(제목칸()[0].value).not.toBe(""));

    fireEvent.change(제목칸()[0], { target: { value: "민수랑 첫 휴가" } });
    fireEvent.click(await 기록단추());

    await waitFor(() => expect(saveTrip).toHaveBeenCalled());
    expect(saveTrip.mock.calls[0].at(-1)).toBe("민수랑 첫 휴가");
  });

  describe("걸음 표시", () => {
    it("처음에는 1 고르기", async () => {
      await 화면열기();
      expect(지금걸음()).toBe("1고르기");
    });

    it("사진을 읽고 나면 2 확인", async () => {
      await 사진넣기();
      expect(지금걸음()).toBe("2확인");
    });

    it("기록하고 나면 3 기록", async () => {
      await 사진넣기();
      fireEvent.click(await 기록단추());
      await screen.findByText("여행 1건을 기록했어요");
      expect(지금걸음()).toBe("3기록");
    });
  });

  describe("고르기 화면", () => {
    it("사진 고르기 단추가 하나, 크게 있다", async () => {
      await 화면열기();
      const button = screen.getByRole("button", { name: "사진 고르기" });
      expect(button.className).toContain("w-full");
    });

    it("약속은 정확하다 — 고르는 동안은 기기 밖으로 나가지 않는다, 올린다는 말은 기록할 때 한다", async () => {
      const { container } = await 화면열기();
      expect(screen.getByText("고르는 동안 사진은 이 기기 밖으로 나가지 않아요")).toBeTruthy();
      // 예전 문구는 기록할 때 사진을 올릴 수 있어서 틀린 약속이었다.
      expect(container.textContent).not.toMatch(/올라가지 않아요\.?$/);
      expect(container.textContent).not.toContain("읽기는 이 브라우저 안에서만");
    });

    it("로그인하지 않은 사람에게는 기록할 때 로그인한다는 것을 미리 말한다", async () => {
      currentUser = null;
      await 화면열기();
      expect(await screen.findByText("기록으로 남길 때 로그인해요")).toBeTruthy();
    });

    it("로그인한 사람에게는 로그인 이야기를 하지 않는다", async () => {
      await 화면열기();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.queryByText("기록으로 남길 때 로그인해요")).toBeNull();
    });

    it("반복되는 설명 줄(부제)이 없다", async () => {
      const { container } = await 화면열기();
      expect(container.textContent).not.toContain("기억나지 않는 사진도");
    });
  });

  describe("확인 화면 · 카드", () => {
    it("카드마다 그 여행의 사진 몇 장을 건넨다 — 처음 · 가운데 · 끝에서", async () => {
      await 사진넣기();
      // 사진 다섯 장(a~e) 중 처음·가운데·끝.
      expect(screen.getByTestId("thumbs")).toHaveTextContent("a.jpg,c.jpg,e.jpg");
    });

    it("곳 목록 · 동행은 접혀 있다", async () => {
      await 사진넣기();
      expect(screen.queryByLabelText("누구와 가셨나요?")).toBeNull();
      expect(screen.queryByText("송정해변")).toBeNull();
    });

    it("나눌 자리가 있으면 접힌 단추에 제안으로 알린다", async () => {
      await 사진넣기();
      expect(screen.getByRole("button", { name: /^다듬기/ })).toHaveTextContent("제안 1");
    });

    it("기간은 사람이 읽는 말로 적는다", async () => {
      await 사진넣기();
      expect(screen.getByText(/2026년 9월 13일 ~ 14일 · 사진 5장 · 방문 3곳/)).toBeTruthy();
    });
  });

  /*
    첫 여행을 기록한 사람은 다음부터 "내 여행"으로 열려야 한다. 그 사람에게 첫
    화면의 여행 100선은 문 앞에서 한 번 돌아가는 일이다. 다만 갈래를 눌러서
    100선을 고른 사람의 선택은 뒤집지 않는다.
  */
  describe("기록하고 나면 다음에 열 갈래", () => {
    const clear = () => {
      document.cookie = "start=; path=/; max-age=0";
    };
    const 기록하기 = async () => {
      await 사진넣기();
      await waitFor(() => expect(제목칸()[0].value).not.toBe(""));
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(saveTrip).toHaveBeenCalled());
    };

    beforeEach(clear);

    it("아직 고른 적이 없으면 내 여행으로 기억한다", async () => {
      await 기록하기();
      await waitFor(() => expect(readStart()).toBe("sketch"));
    });

    it("이미 100선을 고른 사람의 선택은 뒤집지 않는다", async () => {
      document.cookie = "start=spots; path=/";
      await 기록하기();
      // 기록이 끝난 뒤(화면이 바뀐 뒤)에도 그대로다.
      await screen.findByText("여행 1건을 기록했어요");
      expect(readStart()).toBe("spots");
    });

    it("하나도 기록하지 못했으면 기억하지 않는다", async () => {
      saveTrip.mockResolvedValue({ ok: false });
      await 기록하기();
      await waitFor(() => expect(saveTrip).toHaveBeenCalledTimes(1));
      expect(readStart()).toBeNull();
    });
  });

  describe("다듬기 · 나누기와 합치기", () => {
    it("멀리 떨어진 날 경계에서만 나누기를 묻는다", async () => {
      await 사진넣기();
      다듬기열기();
      expect(screen.getByText(/여기서 날이 바뀌고 9\dkm 떨어져요/)).toBeTruthy();

      // 같은 날 안에서 장소만 옮긴 자리에는 묻지 않는다.
      expect(screen.getAllByRole("button", { name: "따로 기록하기" })).toHaveLength(1);
    });

    it("가까운 데서 잤으면 나누기를 묻지 않는다", async () => {
      await 사진넣기([
        shot("a.jpg", "2026-09-13T18:00", 강릉),
        shot("b.jpg", "2026-09-14T08:00", 송정),
      ]);
      다듬기열기();
      expect(screen.queryByRole("button", { name: "따로 기록하기" })).toBeNull();
      // 제안도 없다.
      expect(screen.getByRole("button", { name: /^다듬기/ })).not.toHaveTextContent("제안");
    });

    it("나누면 두 건이 되고, 앞 여행의 제목은 그대로 남는다", async () => {
      await 사진넣기();
      await waitFor(() => expect(제목칸()[0].value).not.toBe(""));
      fireEvent.change(제목칸()[0], { target: { value: "고성 나들이" } });

      다듬기열기();
      fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));

      await screen.findByText(/여행 2건을 찾았어요/);
      await waitFor(() => expect(제목칸()[0].value).toBe("고성 나들이"));
      // 갈라져 나온 쪽은 제 장소로 새 이름을 받는다.
      expect(제목칸()[1].value).toBe("안목해변·송정해변");
    });

    it("나눈 뒤 아래 여행에는 합치기 제안이 붙는다", async () => {
      await 사진넣기();
      다듬기열기();
      fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));
      await screen.findByText(/여행 2건을 찾았어요/);

      const [, 둘째] = screen.getAllByRole("button", { name: /^다듬기/ });
      expect(둘째).toHaveTextContent("제안 1");
    });

    it("합치면 처음 지어 둔 제목이 되살아난다", async () => {
      await 사진넣기();
      await waitFor(() => expect(제목칸()[0].value).not.toBe(""));
      fireEvent.change(제목칸()[0], { target: { value: "강릉 1박 2일" } });

      다듬기열기();
      fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));
      await screen.findByText(/여행 2건을 찾았어요/);

      다듬기열기();
      fireEvent.click(screen.getByRole("button", { name: /위 여행과 한 여행이었어요/ }));
      await screen.findByText(/여행 1건을 찾았어요/);
      await waitFor(() => expect(제목칸()[0].value).toBe("강릉 1박 2일"));
    });

    it("한참 떨어진 여행에는 합치기를 달지 않는다", async () => {
      await 사진넣기(두여행);
      expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
      다듬기열기();
      expect(screen.queryByRole("button", { name: /한 여행이었어요/ })).toBeNull();
    });

    it("같은 이름이 연달아 나오면 한 줄로 합쳐 보여준다", async () => {
      // 안목에서 1km 넘게 걸었다 돌아온 셈이다. 규칙대로면 방문이 둘이지만
      // "안목해변 → 안목해변"으로 늘어놓으면 읽는 사람만 어지럽다.
      await 사진넣기([
        shot("a.jpg", "2026-09-14T09:00", 강릉),
        shot("b.jpg", "2026-09-14T10:00", 안목위쪽),
        shot("c.jpg", "2026-09-14T11:00", 송정),
      ]);
      다듬기열기();
      await waitFor(() => expect(screen.getAllByText("안목해변")).toHaveLength(1));
      expect(screen.getByText(/사진 3장 · 방문 2곳/)).toBeTruthy();
      expect(screen.getByText("송정해변")).toBeTruthy();
    });

    it("함께 간 사람은 다듬기 안에서 적고, 기록에 담긴다", async () => {
      await 사진넣기();
      다듬기열기();
      fireEvent.change(screen.getByLabelText("누구와 가셨나요?"), { target: { value: "민수" } });
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(saveTrip).toHaveBeenCalled());
      expect(saveTrip.mock.calls[0][4]).toBe("민수");
    });
  });

  describe("여행 아님", () => {
    it("뺀 자리에 얇은 줄이 남고, 되돌릴 수 있다", async () => {
      await 사진넣기(두여행);
      expect(screen.getByText("여행 2건을 찾았어요")).toBeTruthy();

      fireEvent.click(screen.getAllByRole("button", { name: "여행 아님" })[0]);
      expect(screen.getByText("여행 1건을 찾았어요")).toBeTruthy();
      expect(screen.getByText(/을 뺐어요/)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
      expect(screen.getByText("여행 2건을 찾았어요")).toBeTruthy();
      expect(screen.queryByText(/을 뺐어요/)).toBeNull();
    });

    it("뺀 여행은 기록하지 않는다 — 기록할 건수도 줄어든다", async () => {
      await 사진넣기(두여행);
      fireEvent.click(screen.getAllByRole("button", { name: "여행 아님" })[0]);
      fireEvent.click(await 기록단추(1));
      await waitFor(() => expect(saveTrip).toHaveBeenCalledTimes(1));
    });

    it("모두 빼면 그렇게 말하고, 기록 막대는 거둔다", async () => {
      await 사진넣기();
      fireEvent.click(screen.getByRole("button", { name: "여행 아님" }));
      expect(screen.getByText("여행을 모두 뺐어요")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /기록하기/ })).toBeNull();
      // 되돌릴 길은 남는다.
      expect(screen.getByRole("button", { name: "되돌리기" })).toBeTruthy();
    });

    it("'일상이에요' 라는 옛 이름은 없다", async () => {
      const { container } = await 사진넣기();
      expect(container.textContent).not.toContain("일상이에요");
    });
  });

  describe("기록 막대", () => {
    it("로그인했으면 사진도 함께 올릴지 고르고 기록한다", async () => {
      await 사진넣기();
      const bar = (await 기록단추()).closest("div")!.parentElement!;
      expect(within(bar).getByRole("checkbox", { name: /사진도 함께 올리기/ })).toBeChecked();
    });

    it("사진도 함께 올리기를 켜 두면 사진을 올린다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      await 사진넣기();
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(uploadPhotos).toHaveBeenCalled());
    });

    it("끄면 사진을 올리지 않는다 — 언제 어디를 다녀왔는지만 기록한다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      await 사진넣기();
      fireEvent.click(screen.getByRole("checkbox", { name: /사진도 함께 올리기/ }));
      fireEvent.click(await 기록단추());
      await screen.findByText("여행 1건을 기록했어요");
      expect(uploadPhotos).not.toHaveBeenCalled();
    });

    it("로그인 전에는 로그인하고 기록하게 한다 — 기록 단추도 올릴 사진 칸도 없다", async () => {
      currentUser = null;
      await 사진넣기();
      const link = await screen.findByRole("link", { name: "로그인하고 기록하기" });
      expect(link).toHaveAttribute("href", "/login?next=%2Ftrips%2Fnew");
      expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /기록하기/ })).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
    });

    it("로그인 전에는 제목을 고칠 수 없다 — 기록할 수 없는 결과를 다듬게 하지 않는다", async () => {
      currentUser = null;
      await 사진넣기();
      expect(screen.queryByLabelText("여행 제목")).toBeNull();
    });

    it("이미 기록한 날짜와 겹치면 알리고, 기록할 것이 없다고 말한다", async () => {
      savedRanges = [{ start: "2026-09-13", end: "2026-09-14" }];
      await 사진넣기();
      await waitFor(() => expect(screen.getByText("이미 기록한 날짜와 겹쳐요.")).toBeTruthy());
      expect(await screen.findByRole("button", { name: "모두 이미 기록했어요" })).toBeDisabled();
      // 이미 기록한 여행은 제목을 고치는 칸이 아니다.
      expect(screen.queryByLabelText("여행 제목")).toBeNull();
    });
  });

  describe("가족의 여행을 보는 중", () => {
    const 가족보기 = (role: "view" | "edit" | "full") =>
      sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role }));

    it("더할 권한이 없으면 안내만 하고 기록 막대는 없다", async () => {
      가족보기("view");
      await 사진넣기();
      expect(screen.getByText(/mom@example.com 님의 여행에는 사진을 더할 수 없어요/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /기록하기/ })).toBeNull();
      expect(screen.queryByRole("link", { name: "로그인하고 기록하기" })).toBeNull();
    });

    it("더할 수 있으면 그 사람의 여행에 더해진다고 알리고, 그 사람의 여행으로 기록한다", async () => {
      가족보기("full");
      await 사진넣기();
      expect(screen.getByText("mom@example.com")).toBeTruthy();
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(saveTrip).toHaveBeenCalled());
      expect(saveTrip.mock.calls[0][1]).toBe("엄마");
    });
  });

  describe("기록이 끝난 뒤", () => {
    it("끝났다고 크게 말하고, 방금 기록한 카드들은 거둔다", async () => {
      await 사진넣기();
      fireEvent.click(await 기록단추());
      expect(await screen.findByRole("heading", { name: "여행 1건을 기록했어요" })).toBeTruthy();
      expect(screen.queryByLabelText("여행 제목")).toBeNull();
      expect(screen.queryByRole("button", { name: /기록하기/ })).toBeNull();
    });

    it("다음에 갈 곳 둘을 건넨다 — 지도에서 보기, 한장 요약 보기", async () => {
      await 사진넣기();
      fireEvent.click(await 기록단추());
      expect(await screen.findByRole("link", { name: "지도에서 보기" })).toHaveAttribute("href", MAP_HREF);
      expect(screen.getByRole("link", { name: "한장 요약 보기" })).toHaveAttribute("href", SKETCH_HREF);
    });

    it("올라간 사진과 못 올린 사진을 알린다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      uploadPhotos.mockResolvedValue({ uploaded: 4, unsupported: ["x.heic"], overLimit: 0, failed: 0 });
      await 사진넣기();
      fireEvent.click(await 기록단추());
      expect(await screen.findByText("사진 4장을 함께 올렸어요")).toBeTruthy();
      expect(screen.getByText(/1장은 이 브라우저가 열지 못하는 형식이라 올리지 못했어요/)).toBeTruthy();
    });

    it("사진 더 고르기 — 처음 화면으로 돌아가 곧바로 고르는 창을 연다", async () => {
      const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
      await 사진넣기();
      fireEvent.click(await 기록단추());
      await screen.findByRole("heading", { name: "여행 1건을 기록했어요" });

      fireEvent.click(screen.getByRole("button", { name: "사진 더 고르기" }));
      expect(click).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "사진 고르기" })).toBeTruthy();
      expect(지금걸음()).toBe("1고르기");
      // 지난 결과가 남아 있지 않다.
      expect(screen.queryByText(/여행 \d건을 찾았어요/)).toBeNull();
    });

    it("저장하지 못한 여행이 있으면 말하고, 다시 기록해 볼 수 있다", async () => {
      saveTrip.mockResolvedValue({ ok: false });
      await 사진넣기();
      fireEvent.click(await 기록단추());
      expect(await screen.findByRole("heading", { name: "새로 기록한 여행이 없어요" })).toBeTruthy();
      expect(screen.getByText("1건은 저장하지 못했어요")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "다시 기록해 보기" }));
      // 찾은 결과가 그대로 있어서 다시 누를 수 있다.
      expect(await 기록단추()).toBeEnabled();
      expect(지금걸음()).toBe("2확인");
    });
  });

  /*
    로그인은 카카오 같은 곳으로 갔다 오는 길이라 화면이 새로 열리고, 찾은 여행과 고른 사진이 사라졌다 — 같은 사진을 사진첩에서 처음부터
    다시 골라야 했다. 그래서 [로그인하고 기록하기]를 누르면 떠나기 전에 올릴 크기로 줄인 사진과 찾은 여행을 이 브라우저에 맡겨 두고
    (lib/photo/prepare · stash), 로그인하고 돌아오면 그 자리에서 이어 기록한다. 맡아 둘 수 없는 브라우저는 예전 길 그대로다.
  */
  describe("로그인 전 — 사진을 맡아 두고 떠나기", () => {
    const 로그인링크 = () => screen.findByRole("link", { name: "로그인하고 기록하기" });
    const 맡을수있음 = () => {
      currentUser = null;
      stashed.available = true;
    };

    it("맡아 둘 수 있는 브라우저면 로그인한 뒤 그대로 이어서 기록한다고 말한다", async () => {
      맡을수있음();
      await 사진넣기();
      expect(await screen.findByText("로그인한 뒤 이 여행들을 그대로 이어서 기록해요")).toBeTruthy();
      expect(screen.queryByText(/한 번 더 골라/)).toBeNull();
    });

    it("맡아 둘 수 없는 브라우저면 예전 그대로 — 곧바로 로그인으로 가고, 같은 사진을 다시 골라야 한다고 말한다", async () => {
      currentUser = null;
      stashed.available = false;
      await 사진넣기();
      const link = await 로그인링크();
      expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();
      // 기본 동작을 막지 않는다 — 링크가 그대로 로그인으로 간다.
      expect(링크누름(link)).toBe(false);
      expect(prepareForLogin).not.toHaveBeenCalled();
    });

    it("누르면 사진을 준비하고(몇 장째인지 알리며) 끝나면 로그인으로 보낸다", async () => {
      맡을수있음();
      let finish!: (ok: boolean) => void;
      prepareForLogin.mockImplementation(async (input) => {
        input.onProgress?.(37, 120, 8000);
        return new Promise<boolean>((resolve) => {
          finish = resolve;
        });
      });
      await 사진넣기();
      fireEvent.click(await 로그인링크());

      expect(await screen.findByText("로그인 전에 사진을 준비하고 있어요")).toBeTruthy();
      expect(screen.getByText(/37장 \/ 120장/)).toBeTruthy();
      expect(screen.getByText(/사진은 이 기기 안에만 있어요/)).toBeTruthy();
      // 준비가 끝나기 전에는 떠나지 않는다.
      expect(goTo).not.toHaveBeenCalled();

      finish(true);
      await waitFor(() => expect(goTo).toHaveBeenCalledWith("/login?next=%2Ftrips%2Fnew%3Fresume%3D1"));
      expect(screen.queryByText("로그인 전에 사진을 준비하고 있어요")).toBeNull();
    });

    it("맡기는 것은 찾은 여행 전부다 — 사진은 방문에 든 것을 차례로, 곳 이름과 함께", async () => {
      맡을수있음();
      await 사진넣기();
      fireEvent.click(await 로그인링크());
      await waitFor(() => expect(prepareForLogin).toHaveBeenCalledTimes(1));

      const input = prepareForLogin.mock.calls[0][0];
      expect(input.shots.map((shot) => shot.id)).toEqual(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]);
      const meta = input.meta as { trips: unknown[]; places: [string, { title: string }][]; titles: object; companions: object };
      expect(meta.trips).toEqual(toStashed(groupIntoTrips(이틀)));
      expect(meta.places.map(([, place]) => place.title).sort()).toEqual(["송정해변", "안목해변", "화진포해변"]);
      expect(meta.titles).toEqual({});
      expect(meta.companions).toEqual({});
    });

    it("누른 단추를 또 눌러도 한 번만 준비한다", async () => {
      맡을수있음();
      prepareForLogin.mockImplementation(() => new Promise<boolean>(() => undefined));
      await 사진넣기();
      const link = await 로그인링크();
      fireEvent.click(link);
      fireEvent.click(link);
      await waitFor(() => expect(prepareForLogin).toHaveBeenCalled());
      expect(prepareForLogin).toHaveBeenCalledTimes(1);
    });

    describe("준비하지 못하면(저장소가 막힘 · 공간 부족)", () => {
      it("떠나지 않고 이유를 말한다 — 같은 사진을 다시 골라야 한다고", async () => {
        맡을수있음();
        prepareForLogin.mockResolvedValue(false);
        await 사진넣기();
        fireEvent.click(await 로그인링크());

        expect(await screen.findByText(/이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요/)).toBeTruthy();
        expect(goTo).not.toHaveBeenCalled();
        expect(screen.queryByText("로그인 전에 사진을 준비하고 있어요")).toBeNull();
      });

      it("그다음부터는 예전 길이다 — 문구도, 링크도(곧바로 로그인으로 간다)", async () => {
        맡을수있음();
        prepareForLogin.mockResolvedValue(false);
        await 사진넣기();
        fireEvent.click(await 로그인링크());
        await screen.findByText(/이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요/);

        expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();
        expect(screen.queryByText("로그인한 뒤 이 여행들을 그대로 이어서 기록해요")).toBeNull();
        expect(링크누름(screen.getByRole("link", { name: "로그인하고 기록하기" }))).toBe(false);
        expect(prepareForLogin).toHaveBeenCalledTimes(1);
      });
    });

    it("사진이 너무 많으면(500장 넘게) 맡지 않고 예전 길로 간다 — 준비에만 몇 분이 걸린다", async () => {
      맡을수있음();
      const many = Array.from({ length: 501 }, (_, i) => shot(`p${i}.jpg`, `2026-09-13T09:${String(i % 60).padStart(2, "0")}`, 고성));
      await 사진넣기(many);
      expect(await 로그인링크()).toBeTruthy();
      expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();
      expect(링크누름(screen.getByRole("link", { name: "로그인하고 기록하기" }))).toBe(false);
      expect(prepareForLogin).not.toHaveBeenCalled();
    });

    it("‘여행 아님’으로 뺀 여행은 맡지 않는다 — 그 사진까지 줄이느라 시간을 쓰지 않는다", async () => {
      맡을수있음();
      await 사진넣기(두여행);
      fireEvent.click(screen.getAllByRole("button", { name: "여행 아님" })[0]);
      fireEvent.click(await 로그인링크());
      await waitFor(() => expect(prepareForLogin).toHaveBeenCalledTimes(1));

      const input = prepareForLogin.mock.calls[0][0];
      expect(input.shots.map((shot) => shot.id)).toEqual(["b.jpg"]);
      const meta = input.meta as { trips: { shots: { id: string }[] }[]; places: [string, { title: string }][] };
      expect(meta.trips.map((trip) => trip.shots.map((shot) => shot.id))).toEqual([["b.jpg"]]);
      // 곳 이름도 맡는 여행의 것만.
      expect(meta.places.map(([, place]) => place.title)).toEqual(["안목해변"]);
    });

    it("준비하는 사이 이 화면을 떠났으면 로그인으로 끌고 가지 않는다", async () => {
      맡을수있음();
      let finish!: (ok: boolean) => void;
      prepareForLogin.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      );
      const view = await 사진넣기();
      fireEvent.click(await 로그인링크());
      await waitFor(() => expect(prepareForLogin).toHaveBeenCalled());

      view.unmount();
      finish(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(goTo).not.toHaveBeenCalled();
    });

    it("사진을 새로 고르면 다시 맡아 보려 한다 — 한 번 못 했다고 계속 못 하는 것은 아니다", async () => {
      맡을수있음();
      prepareForLogin.mockResolvedValueOnce(false);
      const view = await 사진넣기();
      fireEvent.click(await 로그인링크());
      await screen.findByText(/이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요/);
      expect(screen.getByText("로그인한 뒤 같은 사진을 한 번 더 골라 주세요")).toBeTruthy();

      readShots.mockResolvedValue({ shots: 이틀, withoutLocation: [], screenshots: [], unreadable: [] });
      const input = view.container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: 이틀.map((s) => new File(["x"], s.id, { type: "image/jpeg" })), configurable: true });
      fireEvent.change(input);

      expect(await screen.findByText("로그인한 뒤 이 여행들을 그대로 이어서 기록해요")).toBeTruthy();
      expect(screen.queryByText(/이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요/)).toBeNull();
    });

    it("이미 로그인한 사람에게는 아무 일도 없다 — 맡기지도, 안내하지도 않는다", async () => {
      stashed.available = true;
      await 사진넣기();
      await 기록단추();
      expect(screen.queryByText(/그대로 이어서 기록해요/)).toBeNull();
      expect(prepareForLogin).not.toHaveBeenCalled();
    });
  });

  describe("로그인하고 돌아왔을 때 — 맡겨 둔 여행을 그 자리에서 이어서", () => {
    // 우리가 로그인으로 보낼 때 달아 둔 표시가 로그인을 거쳐 돌아온 주소에 붙어 있다(lib/photo/resume).
    beforeEach(() => {
      window.history.pushState({}, "", "/trips/new?resume=1");
    });

    const 곳 = (key: string, title: string): [string, { title: string; isCuratedSpot: boolean; spotId: null; dong: null }] => [
      key,
      { title, isCuratedSpot: false, spotId: null, dong: null },
    ];
    /** 로그인하러 떠날 때 맡긴 모습 — 이틀 치 사진이 한 여행, 세 곳. */
    const 맡겨둔것 = (over: Partial<StashMeta> = {}): StashMeta => ({
      v: 1,
      savedAt: Date.now(),
      trips: toStashed(groupIntoTrips(이틀)),
      titles: {},
      companions: {},
      places: [곳("38.480,128.439", "화진포해변"), 곳("37.773,128.947", "안목해변"), 곳("37.786,128.930", "송정해변")],
      unsupported: [],
      photoIds: ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"],
      ...over,
    });
    const 되살린화면 = async (meta: StashMeta = 맡겨둔것()) => {
      stashed.meta = meta;
      const view = await 화면열기();
      await screen.findByText("방금 고르신 여행이에요");
      return view;
    };

    it("사진을 다시 고르지 않아도 여행 카드가 그대로 나온다 — 이름·곳까지", async () => {
      await 되살린화면();
      expect(screen.getByText("여행 1건을 찾았어요")).toBeTruthy();
      await waitFor(() => expect(제목칸()[0].value).toBe("화진포해변 외 2곳"));
      expect(지금걸음()).toBe("2확인");
      expect(await 기록단추()).toBeEnabled();
    });

    it("떠나기 전에 고쳐 둔 제목과 동행을 그대로 기록한다", async () => {
      await 되살린화면(맡겨둔것({ titles: { "a.jpg": "민수랑 첫 휴가" }, companions: { "a.jpg": "민수" } }));
      expect(제목칸()[0].value).toBe("민수랑 첫 휴가");
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(saveTrip).toHaveBeenCalled());
      expect(saveTrip.mock.calls[0][4]).toBe("민수");
      expect(saveTrip.mock.calls[0].at(-1)).toBe("민수랑 첫 휴가");
    });

    it("카드의 작은 그림은 맡겨 둔 목록 판으로 만든다 — 고른 파일은 이미 사라졌다", async () => {
      await 되살린화면();
      await waitFor(() => expect(screen.getByTestId("thumbs").textContent).toBe("a.jpg,c.jpg,e.jpg"));
    });

    it("기록하면 맡겨 둔 사진을 바로 올린다 — 파일을 다시 줄이지 않는다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      uploadPrepared.mockResolvedValue({ uploaded: 5, unsupported: [], overLimit: 0, failed: 0 });
      await 되살린화면();
      fireEvent.click(await 기록단추());

      await waitFor(() => expect(uploadPrepared).toHaveBeenCalled());
      expect(uploadPhotos).not.toHaveBeenCalled();
      const targets = uploadPrepared.mock.calls[0][2] as { visitId: string; shotId: string; isCover: boolean }[];
      expect(targets.map((target) => [target.shotId, target.visitId])).toEqual([
        ["a.jpg", "v1"],
        ["b.jpg", "v1"],
        ["c.jpg", "v2"],
        ["d.jpg", "v2"],
        ["e.jpg", "v3"],
      ]);
      // 여행마다 첫 장이 대표다.
      expect(targets.map((target) => target.isCover)).toEqual([true, false, false, false, false]);
      expect(typeof uploadPrepared.mock.calls[0][3]).toBe("function");
      expect(await screen.findByText("사진 5장을 함께 올렸어요")).toBeTruthy();
    });

    it("다 기록하면 맡겨 둔 것을 지운다 — 기기에 사진 조각이 남지 않게", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      await 되살린화면();
      fireEvent.click(await 기록단추());
      await screen.findByRole("heading", { name: "여행 1건을 기록했어요" });
      expect(stashed.meta).toBeNull();
      expect(stashed.clears).toBeGreaterThan(0);
    });

    it("저장하지 못한 여행이 있으면 맡겨 둔 것을 남겨 둔다 — 다시 기록해 볼 수 있게", async () => {
      saveTrip.mockResolvedValueOnce({ ok: false });
      await 되살린화면();
      fireEvent.click(await 기록단추());
      expect(await screen.findByRole("heading", { name: "새로 기록한 여행이 없어요" })).toBeTruthy();
      expect(stashed.meta).not.toBeNull();

      // 다시 기록해 보면 맡겨 둔 사진이 아직 있어 올라간다.
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      fireEvent.click(screen.getByRole("button", { name: "다시 기록해 보기" }));
      fireEvent.click(await 기록단추());
      await waitFor(() => expect(uploadPrepared).toHaveBeenCalled());
      await waitFor(() => expect(stashed.meta).toBeNull());
    });

    it("줄이지 못했던 사진(아이폰 HEIC 등)은 올리지 않고 올리지 못한 사진으로 알린다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      uploadPrepared.mockResolvedValue({ uploaded: 4, unsupported: [], overLimit: 0, failed: 0 });
      await 되살린화면(맡겨둔것({ unsupported: ["c.jpg"], photoIds: ["a.jpg", "b.jpg", "d.jpg", "e.jpg"] }));
      fireEvent.click(await 기록단추());

      await waitFor(() => expect(uploadPrepared).toHaveBeenCalled());
      const targets = uploadPrepared.mock.calls[0][2] as { shotId: string }[];
      expect(targets.map((target) => target.shotId)).toEqual(["a.jpg", "b.jpg", "d.jpg", "e.jpg"]);
      expect(await screen.findByText("사진 4장을 함께 올렸어요")).toBeTruthy();
      expect(screen.getByText(/1장은 이 브라우저가 열지 못하는 형식이라 올리지 못했어요/)).toBeTruthy();
    });

    it("‘사진도 함께 올리기’를 끄면 사진 없이 기록하고, 맡겨 둔 것도 지운다", async () => {
      saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: ["v1", "v2", "v3"] });
      await 되살린화면();
      fireEvent.click(screen.getByRole("checkbox", { name: /사진도 함께 올리기/ }));
      fireEvent.click(await 기록단추());
      await screen.findByRole("heading", { name: "여행 1건을 기록했어요" });
      expect(uploadPrepared).not.toHaveBeenCalled();
      expect(stashed.meta).toBeNull();
    });

    it("[버리기]를 누르면 맡겨 둔 것을 지우고 처음 화면으로 돌아간다", async () => {
      await 되살린화면();
      fireEvent.click(screen.getByRole("button", { name: "버리기" }));
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
      expect(screen.queryByText(/여행 \d건을 찾았어요/)).toBeNull();
      expect(stashed.meta).toBeNull();
      expect(지금걸음()).toBe("1고르기");
    });

    it("사진을 다시 고르면 맡겨 둔 것은 버리고 새로 고른 것을 보여 준다", async () => {
      const view = await 되살린화면();
      readShots.mockResolvedValue({ shots: 두여행, withoutLocation: [], screenshots: [], unreadable: [] });
      const input = view.container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: 두여행.map((s) => new File(["x"], s.id, { type: "image/jpeg" })), configurable: true });
      fireEvent.change(input);

      await screen.findByText("여행 2건을 찾았어요");
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
      expect(stashed.meta).toBeNull();
    });

    it("맡긴 지 한 시간이 넘었으면 ‘방금’이라 하지 않는다", async () => {
      stashed.meta = 맡겨둔것({ savedAt: Date.now() - 2 * 60 * 60 * 1000 });
      await 화면열기();
      expect(await screen.findByText("전에 고르신 여행이에요")).toBeTruthy();
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
    });

    it("맡길 때 곳 이름을 못 붙였으면 돌아와서 다시 묻는다", async () => {
      await 되살린화면(맡겨둔것({ places: [] }));
      await waitFor(() => expect(제목칸()[0].value).toBe("화진포해변 외 2곳"));
    });

    it("맡겨 둔 것을 읽어 오는 사이 사람이 먼저 사진을 골랐으면, 늦게 온 맡겨 둔 것이 그 위를 덮지 않는다", async () => {
      let open!: () => void;
      stashed.gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      stashed.meta = 맡겨둔것();
      readShots.mockResolvedValue({ shots: 두여행, withoutLocation: [], screenshots: [], unreadable: [] });
      const view = await 화면열기();
      const input = view.container.querySelector('input[type="file"]')!;
      Object.defineProperty(input, "files", { value: 두여행.map((s) => new File(["x"], s.id, { type: "image/jpeg" })), configurable: true });
      fireEvent.change(input);
      await screen.findByText("여행 2건을 찾았어요");

      open();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(screen.getByText("여행 2건을 찾았어요")).toBeTruthy();
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
    });

    it("기록하지 못한 채 ‘사진 더 고르기’를 누르면 맡겨 둔 것도 접는다 — 이 묶음은 거기서 끝이다", async () => {
      saveTrip.mockResolvedValueOnce({ ok: false });
      await 되살린화면();
      fireEvent.click(await 기록단추());
      await screen.findByRole("heading", { name: "새로 기록한 여행이 없어요" });
      expect(stashed.meta).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "사진 더 고르기" }));
      expect(stashed.meta).toBeNull();
    });

    it("나누면 새로 생긴 카드의 작은 그림도 맡겨 둔 사진으로 채운다", async () => {
      await 되살린화면();
      await waitFor(() => expect(screen.getByTestId("thumbs").textContent).toBe("a.jpg,c.jpg,e.jpg"));

      다듬기열기();
      fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));
      await screen.findByText(/여행 2건을 찾았어요/);

      await waitFor(() =>
        expect(screen.getAllByTestId("thumbs").map((node) => node.textContent)).toEqual(["a.jpg,b.jpg", "c.jpg,d.jpg,e.jpg"]),
      );
    });

    // 맡겨 둔 여행은 '우리가 로그인으로 보냈다가 돌아온 때'(주소의 ?resume=1)에만 연다. 같은 브라우저에서 다른 사람이 로그인했을 때,
    // 앞사람이 로그인을 마치지 않고 남긴 사진이 그 사람에게 뜨지 않게.
    it("돌아왔다는 표시가 없으면 맡겨 둔 것이 있어도 되살리지 않는다 — 다른 사람이 같은 브라우저에서 로그인했을 수 있다", async () => {
      window.history.replaceState({}, "", "/trips/new");
      stashed.meta = 맡겨둔것();
      await 화면열기();
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
      expect(screen.queryByText(/여행 \d건을 찾았어요/)).toBeNull();
      // 앞사람의 것을 지우지도 않는다 — 그 사람이 돌아올 수도 있다(하루가 지나면 알아서 사라진다).
      expect(stashed.meta).not.toBeNull();
    });

    it("되살리는 동안은 기다린다고 말한다 — 사진 고르기 화면이 번쩍였다 바뀌지 않게", async () => {
      let open!: () => void;
      stashed.gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      stashed.meta = 맡겨둔것();
      await 화면열기();

      expect(await screen.findByText("고르신 여행을 이어서 열고 있어요")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "사진 고르기" })).toBeNull();

      open();
      expect(await screen.findByText("방금 고르신 여행이에요")).toBeTruthy();
      expect(screen.queryByText("고르신 여행을 이어서 열고 있어요")).toBeNull();
    });

    it("로그인하지 않은 채 표시만 있는 주소로 열었으면 기다리지 않고 평소 화면이다", async () => {
      currentUser = null;
      stashed.meta = 맡겨둔것();
      await 화면열기();
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      expect(screen.queryByText("고르신 여행을 이어서 열고 있어요")).toBeNull();
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
    });

    it("맡겨 둔 것이 없었으면 기다림을 거두고 평소 화면이다", async () => {
      await 화면열기();
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      expect(screen.queryByText("고르신 여행을 이어서 열고 있어요")).toBeNull();
    });

    it("읽을 수 없는 모양의 맡겨 둔 것은 치우고 평소 화면이다 — 깨진 것 하나가 화면을 깨지 않는다", async () => {
      stashed.meta = 맡겨둔것({ trips: "깨짐" as unknown as StashMeta["trips"] });
      await 화면열기();
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      await waitFor(() => expect(stashed.meta).toBeNull());
    });

    it("일부만 저장됐으면 남은 여행만, 맡겨 둔 사진으로 다시 기록한다 — 이미 기록한 여행은 건너뛴다", async () => {
      // 두 여행: a(고성, 6월) · b(강릉, 9월). 첫째는 저장되고 둘째는 저장되지 못한다.
      saveTrip
        .mockResolvedValueOnce({ ok: true, id: "t1", visitIds: ["v1"] })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValue({ ok: true, id: "t2", visitIds: ["v2"] });
      await 되살린화면(
        맡겨둔것({
          trips: toStashed(groupIntoTrips(두여행)),
          places: [곳("38.480,128.439", "화진포해변"), 곳("37.773,128.947", "안목해변")],
          photoIds: ["a.jpg", "b.jpg"],
        }),
      );
      fireEvent.click(await 기록단추(2));

      // 첫 여행의 사진만 올라갔고, 맡겨 둔 것은 남아 있다.
      await screen.findByRole("heading", { name: "여행 1건을 기록했어요" });
      expect(screen.getByText(/1건은 저장하지 못했어요/)).toBeTruthy();
      expect(uploadPrepared).toHaveBeenCalledTimes(1);
      expect((uploadPrepared.mock.calls[0][2] as { shotId: string }[]).map((target) => target.shotId)).toEqual(["a.jpg"]);
      expect(stashed.meta).not.toBeNull();

      // 다시 기록하면 이미 기록한 첫 여행은 건너뛰고 둘째만 — 맡겨 둔 사진 b 로.
      fireEvent.click(screen.getByRole("button", { name: "다시 기록해 보기" }));
      fireEvent.click(await 기록단추(1));
      await screen.findByRole("heading", { name: "여행 1건을 기록했어요" });
      expect(saveTrip).toHaveBeenCalledTimes(3);
      expect(uploadPrepared).toHaveBeenCalledTimes(2);
      expect((uploadPrepared.mock.calls[1][2] as { shotId: string }[]).map((target) => target.shotId)).toEqual(["b.jpg"]);
      await waitFor(() => expect(stashed.meta).toBeNull());
    });

    it("맡겨 둔 것이 없으면 평소 그대로다", async () => {
      await 화면열기();
      expect(await screen.findByRole("button", { name: "사진 고르기" })).toBeTruthy();
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
    });

    it("가족의 여행에 더할 권한이 없을 때는 되살리지 않는다 — 올릴 곳이 남의 여행이다", async () => {
      sessionStorage.setItem("family-view", JSON.stringify({ ownerId: "엄마", label: "mom@example.com", role: "view" }));
      stashed.meta = 맡겨둔것();
      await 화면열기();
      await screen.findByRole("button", { name: "사진 고르기" });
      expect(screen.queryByText("방금 고르신 여행이에요")).toBeNull();
      expect(stashed.meta).not.toBeNull();
    });

    it("이미 기록한 날짜와 겹치면 ‘이미 기록했어요’로 보인다", async () => {
      savedRanges = [{ start: "2026-09-13", end: "2026-09-14" }];
      await 되살린화면();
      expect(await screen.findByRole("button", { name: "모두 이미 기록했어요" })).toBeDisabled();
    });
  });

  /*
    고르기 창을 닫고 나서 파일이 도착할 때까지의 틈.

    수백 장이면 여기서 몇 초가 그냥 흐른다. 그동안 화면이 그대로면
    사람은 안 눌렸다고 보고 다시 누르므로, 처음부터 다시 시작한다.
  */
  describe("고르기 창을 닫은 뒤", () => {
    async function 창열기() {
      const view = await 화면열기();
      fireEvent.click(screen.getByRole("button", { name: "사진 고르기" }));
      // 창이 닫히면 초점이 돌아온다. 화면이 안내를 내미는 건 그때부터다.
      fireEvent.focus(window);
      return view;
    }

    it("파일을 기다리는 동안 기다려 달라고 말한다", async () => {
      await 창열기();
      await screen.findByText("고르신 사진을 불러오고 있어요");
      expect(screen.getByText("잠시만 기다려 주세요.")).toBeTruthy();
    });

    it("창이 떠 있는 동안에는 말하지 않는다", async () => {
      await 화면열기();
      fireEvent.click(screen.getByRole("button", { name: "사진 고르기" }));
      // 아직 초점이 돌아오지 않았다 — 창은 열려 있다.
      expect(screen.queryByText("고르신 사진을 불러오고 있어요")).toBeNull();
    });

    it("기다리는 동안에도 걸음 표시는 1 고르기다", async () => {
      await 창열기();
      await screen.findByText("고르신 사진을 불러오고 있어요");
      expect(지금걸음()).toBe("1고르기");
    });

    it("고르지 않고 닫으면 안내를 거둔다", async () => {
      const view = await 창열기();
      await screen.findByText("고르신 사진을 불러오고 있어요");

      const input = view.container.querySelector('input[type="file"]')!;
      fireEvent(input, new Event("cancel"));

      await waitFor(() =>
        expect(screen.queryByText("고르신 사진을 불러오고 있어요")).toBeNull(),
      );
      expect(screen.getByRole("button", { name: "사진 고르기" })).toBeTruthy();
    });
  });
});
