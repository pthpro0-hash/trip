import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TripDetail as Detail } from "@/lib/supabase/tripDetail";

/*
  이름은 한참 뒤에 다시 짓게 된다. "화진포해변 외 2곳"으로 남겨 뒀다가
  나중에 "민수랑 첫 휴가"가 떠오르는 식이다. 상세에서 고칠 수 있어야 한다.
*/

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "나" } } }) },
  }),
}));

vi.mock("@/components/course/CourseMap", () => ({ CourseMap: () => null }));

vi.mock("@/lib/supabase/photos", () => ({
  signedUrls: async () => new Map(),
  deletePhoto: async () => true,
  setCoverPhoto: async () => true,
}));

const saveTripTitle = vi.fn();

function detail(title: string | null): Detail {
  return {
    id: "t1",
    title,
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: "민수",
    note: null,
    visits: [
      {
        id: "v1",
        placeName: "안목해변",
        spotId: null,
        dong: "강릉시 송정동",
        lat: 37.7728,
        lng: 128.9474,
        startedAt: new Date("2026-09-14T06:11"),
        endedAt: new Date("2026-09-14T08:41"),
        photos: [],
      },
    ],
  };
}

let current: Detail = detail("화진포해변 외 2곳");

vi.mock("@/lib/supabase/tripDetail", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/tripDetail")>()),
  fetchTripDetail: async () => current,
  saveTripNote: async () => true,
  saveTripTitle: (...args: unknown[]) => saveTripTitle(...args),
}));

async function 상세(title: string | null = "화진포해변 외 2곳") {
  current = detail(title);
  vi.resetModules();
  const { TripDetail } = await import("./TripDetail");
  render(<TripDetail tripId="t1" />);
  return (await screen.findByLabelText("여행 제목")) as HTMLInputElement;
}

describe("TripDetail 이름 바꾸기", () => {
  beforeEach(() => {
    saveTripTitle.mockReset();
    saveTripTitle.mockResolvedValue(true);
  });

  it("지금 이름이 제목칸에 들어 있다", async () => {
    const input = await 상세();
    expect(input.value).toBe("화진포해변 외 2곳");
  });

  it("손을 떼면 저장한다", async () => {
    const input = await 상세();
    fireEvent.change(input, { target: { value: "민수랑 첫 휴가" } });
    fireEvent.blur(input);

    await waitFor(() => expect(saveTripTitle).toHaveBeenCalled());
    expect(saveTripTitle.mock.calls[0].at(-1)).toBe("민수랑 첫 휴가");
    expect(await screen.findByText(/이름을 바꿨어요/)).toBeTruthy();
  });

  it("바꾼 것이 없으면 저장하지 않는다", async () => {
    const input = await 상세();
    fireEvent.blur(input);
    expect(saveTripTitle).not.toHaveBeenCalled();
  });

  it("비우면 날짜가 안내 글로 선다 — 날짜가 이름이 되지 않게", async () => {
    // 값으로 날짜를 넣어 두면 손만 대도 날짜 문구가 제목으로 굳는다.
    const input = await 상세(null);
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("2026년 9월 13일 ~ 9월 14일");

    fireEvent.blur(input);
    expect(saveTripTitle).not.toHaveBeenCalled();
  });

  it("Escape 를 누르면 고치던 것을 버린다", async () => {
    const input = await 상세();
    fireEvent.change(input, { target: { value: "엉뚱한 이름" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.value).toBe("화진포해변 외 2곳");
    await waitFor(() => expect(saveTripTitle).not.toHaveBeenCalled());
  });

  it("저장하지 못하면 그렇다고 말한다", async () => {
    saveTripTitle.mockResolvedValue(false);
    const input = await 상세();
    fireEvent.change(input, { target: { value: "민수랑 첫 휴가" } });
    fireEvent.blur(input);

    expect(await screen.findByText(/이름을 바꾸지 못했어요/)).toBeTruthy();
    expect(screen.queryByText(/이름을 바꿨어요/)).toBeNull();
  });
});
