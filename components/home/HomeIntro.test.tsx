import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { SavedTrip } from "@/lib/supabase/trips";
import { readStart } from "@/lib/start";

/*
  첫 화면 맨 위는 그 사람의 형편을 보고 달라진다.

  기록이 없는 사람(로그인 전이든, 로그인했지만 아직 하나도 안 남겼든)에게는 이 서비스가 무엇을 해 주는지를
  보여 주는 환영 영역(WelcomeHero)을, 기록이 있는 사람에게는 가장 최근 여행 한 줄을 올린다. 기록이 있는 사람에게
  "내 여행"이 빈 벽이면 안 되고, 없는 사람에게 남의 여행지 목록만 내밀어도 안 된다.
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

/** maybeSignedIn: 서버가 로그인 쿠키를 봤는가(app/page 가 알려 준다). */
async function 띠(maybeSignedIn = false) {
  vi.resetModules();
  const { HomeIntro } = await import("./HomeIntro");
  return render(<HomeIntro maybeSignedIn={maybeSignedIn} />);
}

const 환영 = { level: 2, name: /사진만 고르면/ } as const;

describe("HomeIntro", () => {
  beforeEach(() => {
    user = { id: "나" };
    rows = [];
  });

  it("로그인하지 않았으면 환영 영역을 보인다 — 무엇을 할 수 있는지와 단추 하나", async () => {
    user = null;
    await 띠();
    expect(await screen.findByRole("heading", 환영)).toBeTruthy();
    expect(screen.getByRole("link", { name: "사진 고르기" })).toHaveAttribute("href", "/trips/new");
    // 빈 벽을 내밀지 않는다.
    expect(screen.queryByRole("link", { name: /내 여행/ })).toBeNull();
    // 로그인 전 사람에게는 기록할 때 로그인한다고 미리 알린다.
    expect(screen.getByText("기록으로 남길 때 로그인해요")).toBeTruthy();
  });

  it("기록이 하나도 없으면 로그인했어도 환영 영역 — 다만 로그인 이야기는 빼고", async () => {
    rows = [];
    await 띠(true);
    expect(await screen.findByRole("heading", 환영)).toBeTruthy();
    expect(screen.queryByText("기록으로 남길 때 로그인해요")).toBeNull();
  });

  it("기록이 있으면 가장 최근 것을 올린다", async () => {
    rows = [
      trip({ id: "t1", title: "민수랑 첫 휴가", coverPath: "나/a.webp" }),
      trip({ id: "t2", startedOn: "2025-07-25", endedOn: "2025-07-25" }),
    ];
    await 띠(true);

    expect(await screen.findByText("민수랑 첫 휴가")).toBeTruthy();
    expect(screen.getByText(/여행 2건을 남기셨어요/)).toBeTruthy();
    // 내 여행의 문은 이제 지도다.
    expect(screen.getByRole("link", { name: /내 여행/ })).toHaveAttribute("href", "/?v=sketch");
    // 환영 영역은 더 이상 필요 없다.
    expect(screen.queryByRole("heading", 환영)).toBeNull();
  });

  it("이름이 없는 여행은 날짜로 부른다", async () => {
    rows = [trip({ id: "t1" })];
    await 띠(true);
    expect(await screen.findByText("9월 13일 ~ 9월 14일")).toBeTruthy();
  });

  it("대표 사진을 세 장까지 늘어놓는다", async () => {
    rows = ["a", "b", "c", "d"].map((name) =>
      trip({ id: name, coverPath: `나/${name}.webp` }),
    );
    const view = await 띠(true);
    await waitFor(() =>
      expect(view.container.querySelectorAll("img")).toHaveLength(3),
    );
  });

  it("사진이 없는 기록이면 그림 없이 글만 보여준다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    const view = await 띠(true);
    await screen.findByText("민수랑 첫 휴가");
    expect(view.container.querySelectorAll("img")).toHaveLength(0);
  });
});

/*
  화면이 번쩍이거나 아래 내용이 밀리면 누르려던 것이 손가락 밑에서 움직인다. 서버가 로그인 쿠키를 보고 첫 그림을
  정한다: 로그인 전 사람에게는 처음부터 환영 영역을(기다릴 것이 없다), 로그인한 사람에게는 자리만 비워 둔다.
*/
describe("HomeIntro · 첫 그림", () => {
  beforeEach(() => {
    user = { id: "나" };
    rows = [];
  });

  it("로그인 쿠키가 없으면 처음 그림부터 환영 영역이 보인다 — 로그인 확인을 기다리지 않는다", async () => {
    user = null;
    await 띠(false);
    // await 없이 곧바로 있어야 한다.
    expect(screen.getByRole("heading", 환영)).toBeTruthy();
  });

  it("로그인 쿠키가 있으면 처음에는 자리만 잡아 두고 아무것도 보이지 않는다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    const view = await 띠(true);

    // 환영 영역을 보였다가 띠로 바꾸면 번쩍인다. 형편을 알기 전에는 비워 둔다.
    expect(screen.queryByRole("heading", 환영)).toBeNull();
    const spacer = view.container.firstElementChild as HTMLElement;
    expect(spacer.getAttribute("aria-hidden")).toBe("true");
    expect(spacer.className).toContain("invisible");

    await screen.findByText("민수랑 첫 휴가");
    expect(view.container.querySelector("[aria-hidden='true'].invisible")).toBeNull();
  });

  it("자리는 띠의 높이쯤이라 띠로 바뀔 때 거의 밀리지 않는다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    const view = await 띠(true);
    const spacer = view.container.firstElementChild as HTMLElement;
    expect(spacer.className).toMatch(/\bh-32\b/);
    await screen.findByText("민수랑 첫 휴가");
  });

  it("쿠키는 없는데 사실은 로그인한 사람이면 — 환영 영역이 보였다가 띠로 바뀐다", async () => {
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    await 띠(false);
    expect(screen.getByRole("heading", 환영)).toBeTruthy();
    expect(await screen.findByText("민수랑 첫 휴가")).toBeTruthy();
    expect(screen.queryByRole("heading", 환영)).toBeNull();
  });

  it("로그인 쿠키는 있는데 세션이 끝난 사람이면 자리를 비웠다가 환영 영역을 보인다", async () => {
    user = null;
    await 띠(true);
    expect(await screen.findByRole("heading", 환영)).toBeTruthy();
    expect(screen.getByText("기록으로 남길 때 로그인해요")).toBeTruthy();
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
    await 띠(true);
    await screen.findByText("민수랑 첫 휴가");
    await waitFor(() => expect(readStart()).toBe("sketch"));
  });

  it("이미 100선을 고른 사람의 선택은 뒤집지 않는다", async () => {
    document.cookie = "start=spots; path=/";
    rows = [trip({ id: "t1", title: "민수랑 첫 휴가" })];
    await 띠(true);
    await screen.findByText("민수랑 첫 휴가");
    expect(readStart()).toBe("spots");
  });

  it("기록이 없으면 기억하지 않는다 — 빈 지도로 열지 않는다", async () => {
    rows = [];
    await 띠(true);
    await screen.findByRole("heading", 환영);
    expect(readStart()).toBeNull();
  });

  it("로그인 전이면 기억하지 않는다", async () => {
    user = null;
    await 띠();
    await screen.findByRole("heading", 환영);
    expect(readStart()).toBeNull();
  });
});
