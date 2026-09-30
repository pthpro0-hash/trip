import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";
import { readStart } from "@/lib/start";

/*
  첫 화면의 띠는 그 사람의 형편을 보고 달라진다.

  기록이 없는 사람에게 "내 여행"을 들이밀면 빈 벽이다. 그 경우에는
  그런 것이 있다고 알려 주기만 해야 한다.
*/

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: true }));

let user: { id: string } | null = { id: "나" };
let rows: SavedTrip[] = [];

vi.mock("@/lib/supabase/client", () => ({
  getBrowserClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));

vi.mock("@/lib/supabase/trips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/trips")>()),
  fetchTrips: async () => rows,
}));

vi.mock("@/lib/supabase/photos", () => ({
  thumbUrls: async (_c: unknown, paths: string[]) =>
    new Map(paths.map((path) => [path, `https://예시/${path}`])),
}));

function trip(partial: Partial<SavedTrip> & { id: string }): SavedTrip {
  return {
    title: null,
    startedOn: "2026-09-13",
    endedOn: "2026-09-14",
    companions: null,
    note: null,
    coverPath: null,
    visits: [],
    ...partial,
  };
}

async function 띠() {
  vi.resetModules();
  const { HomeIntro } = await import("./HomeIntro");
  return render(<HomeIntro />);
}

describe("HomeIntro", () => {
  beforeEach(() => {
    user = { id: "나" };
    rows = [];
  });

  it("로그인하지 않았으면 무엇을 할 수 있는지만 알려준다", async () => {
    user = null;
    await 띠();
    expect(await screen.findByText("사진 속에 답이 있어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: /사진 고르기/ })).toHaveAttribute(
      "href",
      "/trips/new",
    );
    // 빈 벽을 내밀지 않는다.
    expect(screen.queryByRole("link", { name: /내 여행/ })).toBeNull();
  });

  it("기록이 하나도 없으면 로그인했어도 소개만 한다", async () => {
    rows = [];
    await 띠();
    expect(await screen.findByText("사진 속에 답이 있어요")).toBeTruthy();
  });

  it("기록이 있으면 가장 최근 것을 올린다", async () => {
    rows = [
      trip({ id: "t1", title: "민수랑 첫 휴가", coverPath: "나/a.webp" }),
      trip({ id: "t2", startedOn: "2025-07-25", endedOn: "2025-07-25" }),
    ];
    await 띠();

    expect(await screen.findByText("민수랑 첫 휴가")).toBeTruthy();
    expect(screen.getByText(/여행 2건을 남기셨어요/)).toBeTruthy();
    // 내 여행의 문은 이제 지도다.
    expect(screen.getByRole("link", { name: /내 여행/ })).toHaveAttribute("href", "/?v=sketch");
    // 소개 문구는 더 이상 필요 없다.
    expect(screen.queryByText("사진 속에 답이 있어요")).toBeNull();
  });

  it("이름이 없는 여행은 날짜로 부른다", async () => {
    rows = [trip({ id: "t1" })];
    await 띠();
    expect(await screen.findByText("9월 13일 ~ 9월 14일")).toBeTruthy();
  });

  it("대표 사진을 세 장까지 늘어놓는다", async () => {
    rows = ["a", "b", "c", "d"].map((name) =>
      trip({ id: name, coverPath: `나/${name}.webp` }),
    );
    const view = await 띠();
    await waitFor(() =>
      expect(view.container.querySelectorAll("img")).toHaveLength(3),
    );
  });

  it("알아보는 동안에도 자리를 잡아 둔다 — 아래 내용이 밀리지 않게", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    const view = await 띠();

    // 첫 그림부터 띠가 서 있되, 보이지는 않는다.
    const section = view.container.querySelector("section")!;
    expect(section.className).toContain("invisible");

    await screen.findByText("민수랑 첫 휴가");
    expect(view.container.querySelector("section")!.className).not.toContain("invisible");
  });

  it("사진이 없는 기록이면 그림 없이 글만 보여준다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    const view = await 띠();
    await screen.findByText("민수랑 첫 휴가");
    expect(view.container.querySelectorAll("img")).toHaveLength(0);
  });
});

/*
  여행을 남긴 사람에게 첫 화면의 여행 100선은 문 앞에서 한 번 돌아가는 일이다.
  갈래를 누르지 않았어도(새 폰, 지워진 쿠키) 다음부터는 "내 여행"으로 열려야 한다.
  다만 눌러서 100선을 고른 사람의 선택은 뒤집지 않는다.
*/
describe("HomeIntro · 다음에 열 갈래", () => {
  const clear = () => {
    document.cookie = "start=; path=/; max-age=0";
  };

  beforeEach(() => {
    clear();
    user = { id: "나" };
    rows = [];
  });

  it("여행을 남긴 사람은 다음부터 내 여행으로 열리게 기억한다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    await 띠();
    await screen.findByText("민수랑 첫 휴가");
    await waitFor(() => expect(readStart()).toBe("sketch"));
  });

  it("이미 100선을 고른 사람의 선택은 뒤집지 않는다", async () => {
    document.cookie = "start=spots; path=/";
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    await 띠();
    await screen.findByText("민수랑 첫 휴가");
    expect(readStart()).toBe("spots");
  });

  it("기록이 없으면 기억하지 않는다 — 빈 지도로 열지 않는다", async () => {
    rows = [];
    await 띠();
    await screen.findByText("사진 속에 답이 있어요");
    expect(readStart()).toBeNull();
  });

  it("로그인 전이면 기억하지 않는다", async () => {
    user = null;
    await 띠();
    await screen.findByText("사진 속에 답이 있어요");
    expect(readStart()).toBeNull();
  });
});
