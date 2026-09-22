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
  thumbUrls: async () => new Map(),
  deletePhoto: async () => true,
  setCoverPhoto: async () => true,
}));

const saveTripTitle = vi.fn();
const saveTripSubtitle = vi.fn();
const saveVisitName = vi.fn();

function detail(title: string | null, subtitle: string | null = null): Detail {
  return {
    id: "t1",
    title,
    subtitle,
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: "민수",
    note: null,
    visits: [
      {
        id: "v1",
        placeName: "화진포해변",
        spotId: null,
        dong: "고성군 거진읍",
        lat: 38.4798,
        lng: 128.4391,
        startedAt: new Date("2026-09-13T09:21"),
        endedAt: new Date("2026-09-13T11:04"),
        photos: [],
      },
      {
        id: "v2",
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
  saveTripSubtitle: (...args: unknown[]) => saveTripSubtitle(...args),
  saveVisitName: (...args: unknown[]) => saveVisitName(...args),
}));

async function 상세(title: string | null = "화진포해변 외 2곳", subtitle: string | null = null) {
  current = detail(title, subtitle);
  vi.resetModules();
  const { TripDetail } = await import("./TripDetail");
  render(<TripDetail tripId="t1" />);
  return (await screen.findByLabelText("여행 제목")) as HTMLInputElement;
}

describe("TripDetail 이름 바꾸기", () => {
  beforeEach(() => {
    for (const spy of [saveTripTitle, saveTripSubtitle, saveVisitName]) {
      spy.mockReset();
      spy.mockResolvedValue(true);
    }
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
    expect(await screen.findByText(/바꿨어요/)).toBeTruthy();
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
    // 실제로 손가락이 올라간 상태여야 blur 가 뒤따른다. 포커스 없이
    // 누르면 blur 가 나지 않아 시험이 통과해 버린다.
    input.focus();
    fireEvent.change(input, { target: { value: "엉뚱한 이름" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(input.value).toBe("화진포해변 외 2곳"));
    expect(saveTripTitle).not.toHaveBeenCalled();
  });

  it("저장하지 못하면 그렇다고 말한다", async () => {
    saveTripTitle.mockResolvedValue(false);
    const input = await 상세();
    fireEvent.change(input, { target: { value: "민수랑 첫 휴가" } });
    fireEvent.blur(input);

    expect(await screen.findByText(/이름을 바꾸지 못했어요/)).toBeTruthy();
    expect(screen.queryByText(/바꿨어요/)).toBeNull();
  });
});

describe("부제", () => {
  beforeEach(() => {
    for (const spy of [saveTripTitle, saveTripSubtitle, saveVisitName]) {
      spy.mockReset();
      spy.mockResolvedValue(true);
    }
  });

  it("손대지 않았으면 장소 요약이 자동으로 선다", async () => {
    await 상세("민수랑 첫 휴가");
    const sub = screen.getByLabelText("부제") as HTMLInputElement;
    // 제목을 사람이 바꿔도 어디였는지를 잃지 않는다.
    expect(sub.value).toBe("");
    expect(sub.placeholder).toBe("화진포해변·안목해변");
  });

  it("직접 쓴 것이 있으면 그것을 보여준다", async () => {
    await 상세("민수랑 첫 휴가", "비 오는 이틀, 커피만 마셨다");
    expect((screen.getByLabelText("부제") as HTMLInputElement).value).toBe(
      "비 오는 이틀, 커피만 마셨다",
    );
  });

  it("손을 떼면 저장한다", async () => {
    await 상세("민수랑 첫 휴가");
    const sub = screen.getByLabelText("부제");
    fireEvent.change(sub, { target: { value: "비 오는 이틀" } });
    fireEvent.blur(sub);

    await waitFor(() => expect(saveTripSubtitle).toHaveBeenCalled());
    expect(saveTripSubtitle.mock.calls[0].at(-1)).toBe("비 오는 이틀");
  });

  it("바꾼 것이 없으면 저장하지 않는다", async () => {
    await 상세("민수랑 첫 휴가");
    fireEvent.blur(screen.getByLabelText("부제"));
    expect(saveTripSubtitle).not.toHaveBeenCalled();
  });

  it("날짜와 동행자는 그대로 남는다", async () => {
    await 상세("민수랑 첫 휴가");
    expect(screen.getByText(/2026년 9월 13일 ~ 9월 14일/)).toBeTruthy();
    expect(screen.getByText(/민수와/)).toBeTruthy();
  });
});

describe("장소 이름 고치기", () => {
  beforeEach(() => {
    for (const spy of [saveTripTitle, saveTripSubtitle, saveVisitName]) {
      spy.mockReset();
      spy.mockResolvedValue(true);
    }
  });

  it("고치기를 누르면 그 자리에서 고친다", async () => {
    await 상세();
    fireEvent.click(screen.getByRole("button", { name: "안목해변 이름 고치기" }));

    const input = screen.getByLabelText("안목해변 이름 고치기") as HTMLInputElement;
    expect(input.value).toBe("안목해변");

    fireEvent.change(input, { target: { value: "우리가 커피 마신 곳" } });
    fireEvent.blur(input);

    await waitFor(() => expect(saveVisitName).toHaveBeenCalled());
    expect(saveVisitName.mock.calls[0].slice(-2)).toEqual(["v2", "우리가 커피 마신 곳"]);
    expect(await screen.findByText("우리가 커피 마신 곳")).toBeTruthy();
  });

  it("비우면 되돌린다 — 이름 없는 곳은 다시 찾을 길이 없다", async () => {
    await 상세();
    fireEvent.click(screen.getByRole("button", { name: "안목해변 이름 고치기" }));
    const input = screen.getByLabelText("안목해변 이름 고치기");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByText("안목해변")).toBeTruthy());
    expect(saveVisitName).not.toHaveBeenCalled();
  });

  it("Escape 를 누르면 고치던 것을 버린다", async () => {
    await 상세();
    fireEvent.click(screen.getByRole("button", { name: "화진포해변 이름 고치기" }));
    const input = screen.getByLabelText("화진포해변 이름 고치기") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "엉뚱한 곳" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(screen.getByText("화진포해변")).toBeTruthy());
    expect(saveVisitName).not.toHaveBeenCalled();
  });

  it("부제도 Escape 로 버린다", async () => {
    await 상세("민수랑 첫 휴가", "비 오는 이틀");
    const sub = screen.getByLabelText("부제") as HTMLInputElement;
    sub.focus();
    fireEvent.change(sub, { target: { value: "엉뚱한 줄" } });
    fireEvent.keyDown(sub, { key: "Escape" });

    await waitFor(() => expect(sub.value).toBe("비 오는 이틀"));
    expect(saveTripSubtitle).not.toHaveBeenCalled();
  });

  it("저장하지 못하면 그렇다고 말한다", async () => {
    saveVisitName.mockResolvedValue(false);
    await 상세();
    fireEvent.click(screen.getByRole("button", { name: "안목해변 이름 고치기" }));
    const input = screen.getByLabelText("안목해변 이름 고치기");
    fireEvent.change(input, { target: { value: "다른 이름" } });
    fireEvent.blur(input);

    expect(await screen.findByText(/장소 이름을 바꾸지 못했어요/)).toBeTruthy();
  });

  it("한 번에 한 곳만 연다", async () => {
    await 상세();
    fireEvent.click(screen.getByRole("button", { name: "화진포해변 이름 고치기" }));
    expect(screen.getAllByRole("textbox").filter((el) => el.getAttribute("aria-label")?.includes("이름 고치기"))).toHaveLength(1);
  });
});

describe("그날의 실마리", () => {
  it("요일 앞에 날짜를 적는다", async () => {
    await 상세();
    // 요일만 있으면 어느 날인지 떠오르지 않는다.
    expect(screen.getByText(/2026년 9월 13일 일요일이었어요/)).toBeTruthy();
  });
});
