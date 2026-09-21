import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReadResult } from "@/lib/photo/readShots";

/*
  사진을 고른 뒤의 화면을 본다.

  묶기 규칙 자체는 순수 함수 쪽에서 재고, 여기서는 사람이 손대는 부분만
  본다 — 제목을 짓는 것, 잘못 묶인 것을 나누는 것, 도로 합치는 것.
  실제 파일 대신 읽어낸 결과를 바로 끼워 넣는다.
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

const readShots = vi.fn<(files: File[]) => Promise<ReadResult>>();
const saveTrip = vi.fn();

vi.mock("@/lib/photo/readShots", () => ({ readShots: (files: File[]) => readShots(files) }));

vi.mock("@/lib/supabase/photos", () => ({
  uploadPhotos: async () => ({ uploaded: 0, unsupported: [], overLimit: 0 }),
}));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "나" } } }) },
  }),
}));

vi.mock("@/lib/supabase/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/trips")>()),
  fetchSavedRanges: async () => [],
  saveTrip: (...args: unknown[]) => saveTrip(...args),
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

async function 사진넣기(shots = 이틀) {
  readShots.mockResolvedValue({
    shots,
    withoutLocation: [],
    screenshots: [],
    unreadable: [],
  });

  const { PhotoImport } = await import("./PhotoImport");
  const view = render(<PhotoImport />);

  const input = view.container.querySelector('input[type="file"]')!;
  const files = shots.map((s) => new File(["x"], s.id, { type: "image/jpeg" }));
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);

  await screen.findByText(/여행 \d건을 찾았어요/);
  return view;
}

const 제목칸 = () => screen.getAllByLabelText("여행 제목") as HTMLInputElement[];

describe("PhotoImport", () => {
  beforeEach(() => {
    vi.resetModules();
    readShots.mockReset();
    saveTrip.mockReset();
    saveTrip.mockResolvedValue({ ok: true, id: "t1", visitIds: [] });

    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => ({
      ok: true,
      json: async () => 장소응답(JSON.parse(String(init.body)).points),
    }));
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
    fireEvent.click(screen.getByRole("button", { name: /여행 1건 기록하기/ }));

    await waitFor(() => expect(saveTrip).toHaveBeenCalled());
    expect(saveTrip.mock.calls[0].at(-1)).toBe("민수랑 첫 휴가");
  });

  it("멀리 떨어진 날 경계에서만 나누기를 묻는다", async () => {
    await 사진넣기();
    expect(screen.getByText(/여기서 날이 바뀌고 9\dkm 떨어져요/)).toBeTruthy();

    // 같은 날 안에서 장소만 옮긴 자리에는 묻지 않는다.
    expect(screen.getAllByRole("button", { name: "따로 기록하기" })).toHaveLength(1);
  });

  it("가까운 데서 잤으면 나누기를 묻지 않는다", async () => {
    await 사진넣기([
      shot("a.jpg", "2026-09-13T18:00", 강릉),
      shot("b.jpg", "2026-09-14T08:00", 송정),
    ]);
    expect(screen.queryByRole("button", { name: "따로 기록하기" })).toBeNull();
  });

  it("나누면 두 건이 되고, 앞 여행의 제목은 그대로 남는다", async () => {
    await 사진넣기();
    await waitFor(() => expect(제목칸()[0].value).not.toBe(""));
    fireEvent.change(제목칸()[0], { target: { value: "고성 나들이" } });

    fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));

    await screen.findByText(/여행 2건을 찾았어요/);
    await waitFor(() => expect(제목칸()[0].value).toBe("고성 나들이"));
    // 갈라져 나온 쪽은 제 장소로 새 이름을 받는다.
    expect(제목칸()[1].value).toBe("안목해변·송정해변");
  });

  it("합치면 처음 지어 둔 제목이 되살아난다", async () => {
    await 사진넣기();
    await waitFor(() => expect(제목칸()[0].value).not.toBe(""));
    fireEvent.change(제목칸()[0], { target: { value: "강릉 1박 2일" } });

    fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));
    await screen.findByText(/여행 2건을 찾았어요/);

    fireEvent.click(screen.getByRole("button", { name: /위 여행과 한 여행이었어요/ }));
    await screen.findByText(/여행 1건을 찾았어요/);
    await waitFor(() => expect(제목칸()[0].value).toBe("강릉 1박 2일"));
  });

  it("한참 떨어진 여행에는 합치기를 달지 않는다", async () => {
    await 사진넣기([
      shot("a.jpg", "2026-06-13T09:00", 고성),
      shot("b.jpg", "2026-09-14T09:00", 강릉),
    ]);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
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
    await waitFor(() => expect(screen.getAllByText("안목해변")).toHaveLength(1));
    expect(screen.getByText(/사진 3장 · 방문 2곳/)).toBeTruthy();
    expect(screen.getByText("송정해변")).toBeTruthy();
  });
});
