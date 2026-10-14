// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const saved: [string, string][] = [];
vi.mock("./tripDetail", () => ({
  saveVisitName: async (_s: unknown, _u: string, id: string, name: string) => {
    saved.push([id, name]);
    return true;
  },
}));
const { AUTO_MAX, autoRefreshAbroadNames, fetchOverseasVisits, isRough, refreshAbroadNames, shouldRename } = await import("./abroadNames");

/* 해외 곳 이름 새로 붙이기 — 사람이 붙인 이름은 지키고, 못 붙었거나 거친 이름만 세부 이름으로. */
describe("shouldRename", () => {
  it("못 붙은 이름은 바꾼다", () => {
    expect(shouldRename("알 수 없는 곳", "영국 런던 켄싱턴")).toBe(true);
    expect(shouldRename("해외", "영국 런던")).toBe(true);
  });

  it("옛 이름이 새 이름의 거친 판이면 바꾼다", () => {
    expect(shouldRename("영국 런던", "영국 런던 Knightsbridge Royal Albert Hall")).toBe(true);
  });

  it("직접 적은 이름은 그대로 둔다 — 새 이름이 그것으로 시작하지 않으면", () => {
    expect(shouldRename("로열 앨버트 홀", "영국 런던 Knightsbridge Royal Albert Hall")).toBe(false);
    expect(shouldRename("민수랑 런던", "영국 런던")).toBe(false);
  });

  it("같은 이름이거나 새 이름이 비었거나 '해외'면 바꾸지 않는다", () => {
    expect(shouldRename("영국 런던", "영국 런던")).toBe(false);
    expect(shouldRename("알 수 없는 곳", "")).toBe(false);
    expect(shouldRename("알 수 없는 곳", "해외")).toBe(false);
  });
});

describe("fetchOverseasVisits", () => {
  const client = (rows: unknown[], error: unknown = null) =>
    ({
      from: () => {
        const api: Record<string, unknown> = {};
        for (const op of ["select", "eq", "order"]) api[op] = () => api;
        api.range = () => Promise.resolve({ data: rows, error });
        return api;
      },
    }) as unknown as SupabaseClient;

  it("한국 밖의 방문만 골라 돌려준다", async () => {
    const list = await fetchOverseasVisits(client([
      { id: "a", place_name: "화진포해변", lat: 38.48, lng: 128.44 },
      { id: "b", place_name: "영국 런던", lat: 51.5, lng: -0.17 },
    ]), "u");
    expect(list).toEqual([{ id: "b", placeName: "영국 런던", lat: 51.5, lng: -0.17 }]);
  });

  it("못 읽으면 빈 목록 — 던지지 않는다", async () => {
    expect(await fetchOverseasVisits(client([], { message: "x" }), "u")).toEqual([]);
  });
});

describe("refreshAbroadNames", () => {
  beforeEach(() => {
    saved.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  const visits = [
    { id: "a", placeName: "영국 런던", lat: 51.5, lng: -0.17 },
    { id: "b", placeName: "로열 앨버트 홀", lat: 51.5, lng: -0.18 },
    { id: "c", placeName: "알 수 없는 곳", lat: 48.86, lng: 2.35 },
  ];

  it("거친 이름과 못 붙은 이름만 바꾸고, 직접 적은 이름은 둔다 — 진행을 알린다", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ places: [{ title: "영국 런던 켄싱턴 로열 앨버트 홀" }, { title: "영국 런던 켄싱턴 로열 앨버트 홀" }, { title: "프랑스 파리 에펠탑" }] }),
    }));
    const progress = vi.fn();
    const outcome = await refreshAbroadNames({} as SupabaseClient, "u", visits, progress);
    expect(saved).toEqual([["a", "영국 런던 켄싱턴 로열 앨버트 홀"], ["c", "프랑스 파리 에펠탑"]]);
    expect(outcome).toEqual({ checked: 3, renamed: 2, failed: 0 });
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it("조회가 막히면 그 묶음을 실패로 세고 이름은 건드리지 않는다", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    const outcome = await refreshAbroadNames({} as SupabaseClient, "u", visits);
    expect(outcome).toEqual({ checked: 3, renamed: 0, failed: 3 });
    expect(saved).toEqual([]);
  });
});

/* 내 여행을 열 때 저절로 — 거친 이름만, 이 기기에서 아직 물어보지 않은 곳만, 한 번에 AUTO_MAX 곳까지. */
describe("isRough", () => {
  it("못 붙었거나 나라·도시까지만 있는 이름", () => {
    for (const name of ["알 수 없는 곳", "해외", "영국 런던", "일본"]) expect(isRough(name), name).toBe(true);
  });

  it("세부 지역명까지 있는 이름은 거칠지 않다", () => {
    expect(isRough("영국 런던 켄싱턴 로열 앨버트 홀")).toBe(false);
    expect(isRough("프랑스 파리 에펠탑")).toBe(false);
  });
});

describe("autoRefreshAbroadNames", () => {
  beforeEach(() => {
    saved.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  const client = (rows: { id: string; place_name: string; lat: number; lng: number }[]) =>
    ({
      from: () => {
        const api: Record<string, unknown> = {};
        for (const op of ["select", "eq", "order"]) api[op] = () => api;
        api.range = () => Promise.resolve({ data: rows, error: null });
        return api;
      },
    }) as unknown as SupabaseClient;
  const memory = (start: string[] = []) => {
    let ids = [...start];
    return { read: () => ids, write: (next: string[]) => void (ids = next), get: () => ids };
  };
  const rows = [
    { id: "a", place_name: "영국 런던", lat: 51.5, lng: -0.17 },
    { id: "b", place_name: "영국 런던 켄싱턴 로열 앨버트 홀", lat: 51.5, lng: -0.18 },
    { id: "c", place_name: "알 수 없는 곳", lat: 48.86, lng: 2.35 },
    { id: "k", place_name: "남산", lat: 37.55, lng: 126.98 },
  ];

  it("해외 곳 중 거친 이름만 묻고, 물어본 곳은 기억한다", async () => {
    const asked: number[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const points = JSON.parse(init.body).points as unknown[];
      asked.push(points.length);
      return { ok: true, json: async () => ({ places: [{ title: "영국 런던 켄싱턴" }, { title: "프랑스 파리 에펠탑" }] }) };
    });
    const store = memory();
    const outcome = await autoRefreshAbroadNames(client(rows), "u", store);
    expect(asked).toEqual([2]); // a, c — b 는 이미 세부, k 는 한국
    expect(saved).toEqual([["a", "영국 런던 켄싱턴"], ["c", "프랑스 파리 에펠탑"]]);
    expect(outcome).toEqual({ checked: 2, renamed: 2, failed: 0 });
    expect(store.get().sort()).toEqual(["a", "c"]);
  });

  it("이 기기에서 이미 물어본 곳은 다시 묻지 않는다 — 물을 곳이 없으면 null", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await autoRefreshAbroadNames(client(rows), "u", memory(["a", "c"]))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("조회하지 못한 곳은 기억하지 않는다 — 다음에 다시 묻는다", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    const store = memory();
    await autoRefreshAbroadNames(client(rows), "u", store);
    expect(store.get()).toEqual([]);
  });

  it("한 번에 AUTO_MAX 곳까지만 묻는다", async () => {
    let total = 0;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const points = JSON.parse(init.body).points as unknown[];
      total += points.length;
      return { ok: true, json: async () => ({ places: points.map(() => ({ title: "해외" })) }) };
    });
    const many = Array.from({ length: AUTO_MAX + 7 }, (_, i) => ({ id: `v${i}`, place_name: "알 수 없는 곳", lat: 48, lng: 2 }));
    await autoRefreshAbroadNames(client(many), "u", memory());
    expect(total).toBe(AUTO_MAX);
  });
});
