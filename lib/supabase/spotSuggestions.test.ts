// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAllSuggestions,
  fetchMySuggestions,
  isAdmin,
  removeSuggestion,
  setSuggestionStatus,
  submitSuggestion,
} from "./spotSuggestions";

/* 이용자가 곳을 추천하고, 관리자가 상태를 정한다. 요청을 흉내 내는 가짜로 보낸 것과 읽은 것을 본다. */
interface Fake {
  calls: { table: string; op: string; payload?: unknown }[];
  client: SupabaseClient;
}

function fake(answer: { data?: unknown; error?: { message: string } | null }): Fake {
  const calls: Fake["calls"] = [];
  const from = (table: string) => {
    const api: Record<string, unknown> = {};
    for (const op of ["select", "eq", "order", "limit", "delete"]) api[op] = (payload?: unknown) => (calls.push({ table, op, payload }), api);
    api.insert = (payload: unknown) => (calls.push({ table, op: "insert", payload }), api);
    api.update = (payload: unknown) => (calls.push({ table, op: "update", payload }), api);
    api.then = (resolve: (value: unknown) => void) => resolve({ data: answer.data ?? null, error: answer.error ?? null });
    return api;
  };
  return { calls, client: { from } as unknown as SupabaseClient };
}

const row = (id: string, status: string, at: string) => ({ id, user_id: "u", name: `곳${id}`, place: null, reason: null, status, admin_note: null, created_at: at });

describe("submitSuggestion", () => {
  it("이름 앞뒤 공백을 떼고, 빈 칸은 비워서 보낸다", async () => {
    const { client, calls } = fake({});
    expect(await submitSuggestion(client, "u", { name: "  안목해변 ", place: "  ", reason: " 커피 거리 " })).toBe("ok");
    expect(calls.find((c) => c.op === "insert")?.payload).toEqual({ user_id: "u", name: "안목해변", place: null, reason: "커피 거리" });
  });

  it("이름이 없거나 길면 보내지 않는다", async () => {
    const { client, calls } = fake({});
    expect(await submitSuggestion(client, "u", { name: " ", place: "", reason: "" })).toBe("invalid");
    expect(await submitSuggestion(client, "u", { name: "가".repeat(61), place: "", reason: "" })).toBe("invalid");
    expect(await submitSuggestion(client, "u", { name: "곳", place: "", reason: "가".repeat(201) })).toBe("invalid");
    expect(calls).toHaveLength(0);
  });

  it("검토 전 추천이 이미 다섯이면 limit 으로 알린다", async () => {
    const { client } = fake({ error: { message: "too_many_pending" } });
    expect(await submitSuggestion(client, "u", { name: "곳", place: "", reason: "" })).toBe("limit");
  });

  it("그 밖의 오류는 failed — 던지지 않는다", async () => {
    const { client } = fake({ error: { message: "boom" } });
    expect(await submitSuggestion(client, "u", { name: "곳", place: "", reason: "" })).toBe("failed");
  });
});

describe("읽기 · 거두기", () => {
  it("내 추천을 읽어 모양을 바꿔 돌려준다 — 못 읽으면 null", async () => {
    expect((await fetchMySuggestions(fake({ data: [row("1", "new", "2026-10-01")] }).client, "u"))?.[0]).toMatchObject({ id: "1", name: "곳1", status: "new", adminNote: null });
    expect(await fetchMySuggestions(fake({ error: { message: "x" } }).client, "u")).toBeNull();
  });

  it("검토 전인 내 추천을 거둔다 — 한 줄도 안 지워지면 false", async () => {
    expect(await removeSuggestion(fake({ data: [{ id: "1" }] }).client, "1")).toBe(true);
    expect(await removeSuggestion(fake({ data: [] }).client, "1")).toBe(false);
  });

  it("관리자 여부는 app_admins 에 내 줄이 있는가", async () => {
    expect(await isAdmin(fake({ data: [{ user_id: "u" }] }).client, "u")).toBe(true);
    expect(await isAdmin(fake({ data: [] }).client, "u")).toBe(false);
    expect(await isAdmin(fake({ error: { message: "x" } }).client, "u")).toBe(false);
  });

  it("관리자 목록은 검토 전인 것이 앞이고, 그 안에서는 최신순을 지킨다", async () => {
    const list = await fetchAllSuggestions(fake({ data: [row("a", "planned", "3"), row("b", "new", "2"), row("c", "new", "1")] }).client);
    expect(list?.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});

describe("setSuggestionStatus", () => {
  it("상태와 메모를 바꾼다 — 메모 앞뒤 공백은 뗀다", async () => {
    const { client, calls } = fake({ data: [{ id: "1" }] });
    expect(await setSuggestionStatus(client, "1", "planned", "  다음 배포에 ")).toBe(true);
    expect(calls.find((c) => c.op === "update")?.payload).toMatchObject({ status: "planned", admin_note: "다음 배포에" });
  });

  it("권한이 없어 한 줄도 안 바뀌면 조용히 넘어가지 않고 false", async () => {
    expect(await setSuggestionStatus(fake({ data: [] }).client, "1", "declined", "")).toBe(false);
  });
});
