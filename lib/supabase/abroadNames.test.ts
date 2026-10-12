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
const { fetchOverseasVisits, refreshAbroadNames, shouldRename } = await import("./abroadNames");

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
