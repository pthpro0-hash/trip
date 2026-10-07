// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const files = vi.hoisted(() => ({ calls: [] as { id: string; files: string[] }[], fail: new Set<string>() }));
vi.mock("./postcardCleanup", () => ({
  sweepPostcardFolder: async () => true,
  removePostcardFiles: async (_supabase: unknown, id: string, list: string[]) => {
    files.calls.push({ id, files: list });
    return !files.fail.has(id);
  },
}));

const { planMailboxTrim, trimMailbox } = await import("./mailbox");

const P1 = "a".repeat(43);
const P2 = "b".repeat(43);
const P3 = "c".repeat(43);

function fake(rpc: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args?: unknown) => {
      calls.push({ name, args });
      return rpc[name] ?? { data: null, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

beforeEach(() => {
  files.calls.length = 0;
  files.fail.clear();
});

/*
  오래된 책의 사진 줄이기 — 순서는 책장 지우기와 같다. 줄일 책과 지울 파일을 알아내고, 사진 파일을 먼저 지우고,
  그다음에 기록을 고친다. 파일을 못 지운 책이 있어도 지운 만큼은 기록에 맞춘다(서버가 파일이 정말 사라진 것만 뺀다).
*/
describe("planMailboxTrim · 무엇을 줄이나", () => {
  it("줄일 책과 책마다 지울 파일을 읽는다", async () => {
    const { client, calls } = fake({
      mailbox_trim_plan: { data: { books: [{ id: P1, drop: ["b.webp", "c.webp"] }, { id: P2, drop: ["b.webp"] }] } },
    });
    expect(await planMailboxTrim(client, "m1")).toEqual({
      books: [
        { id: P1, drop: ["b.webp", "c.webp"] },
        { id: P2, drop: ["b.webp"] },
      ],
    });
    expect(calls[0]).toEqual({ name: "mailbox_trim_plan", args: { box: "m1" } });
  });

  it("줄일 책이 없으면 빈 목록", async () => {
    expect(await planMailboxTrim(fake({ mailbox_trim_plan: { data: { books: [] } } }).client, "m1")).toEqual({ books: [] });
  });

  it("내 책장이 아니거나(null) 오류거나 던지면 null — 조용히 아무것도 안 보인다", async () => {
    expect(await planMailboxTrim(fake({ mailbox_trim_plan: { data: null } }).client, "m1")).toBeNull();
    expect(await planMailboxTrim(fake({ mailbox_trim_plan: { error: { message: "x" } } }).client, "m1")).toBeNull();
    const throwing = { rpc: async () => { throw new Error("offline"); } } as unknown as SupabaseClient;
    expect(await planMailboxTrim(throwing, "m1")).toBeNull();
  });

  it("엽서 주소·파일 이름 모양이 틀린 것은 버리고, 지울 파일이 없는 책은 뺀다", async () => {
    const { client } = fake({
      mailbox_trim_plan: {
        data: {
          books: [
            { id: P1, drop: ["b.webp", "../x", 3, null] },
            { id: "../짧음", drop: ["b.webp"] },
            { id: P2, drop: [] },
            "x",
            { id: P3 },
          ],
        },
      },
    });
    expect(await planMailboxTrim(client, "m1")).toEqual({ books: [{ id: P1, drop: ["b.webp"] }] });
  });
});

describe("trimMailbox · 줄이기", () => {
  const plan = { books: [{ id: P1, drop: ["b.webp", "c.webp"] }, { id: P2, drop: ["b.webp"] }] };

  it("책마다 사진 파일을 먼저 지우고, 그다음 기록을 고친다 — 이 차례로", async () => {
    const { client, calls } = fake({ mailbox_trim_plan: { data: plan }, mailbox_trim_apply: { data: 3 } });
    expect(await trimMailbox(client, "m1")).toEqual({ ok: true, books: 2, files: 3 });
    expect(files.calls).toEqual([
      { id: P1, files: ["b.webp", "c.webp"] },
      { id: P2, files: ["b.webp"] },
    ]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_trim_plan", "mailbox_trim_apply"]);
    expect(calls[1].args).toEqual({ box: "m1", cards: [P1, P2] });
  });

  it("줄일 책이 없으면 파일도 기록도 건드리지 않는다", async () => {
    const { client, calls } = fake({ mailbox_trim_plan: { data: { books: [] } } });
    expect(await trimMailbox(client, "m1")).toEqual({ ok: true, books: 0, files: 0 });
    expect(files.calls).toEqual([]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_trim_plan"]);
  });

  it("한 책의 파일을 못 지워도 나머지는 계속하고, 지운 만큼은 기록에 맞춘 뒤 files 로 알린다", async () => {
    files.fail.add(P1);
    const { client, calls } = fake({ mailbox_trim_plan: { data: plan }, mailbox_trim_apply: { data: 1 } });
    expect(await trimMailbox(client, "m1")).toEqual({ ok: false, reason: "files" });
    expect(files.calls.map((call) => call.id)).toEqual([P1, P2]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_trim_plan", "mailbox_trim_apply"]);
  });

  it("계획을 못 읽으면 아무것도 지우지 않는다", async () => {
    const { client, calls } = fake({ mailbox_trim_plan: { error: { message: "x" } } });
    expect(await trimMailbox(client, "m1")).toEqual({ ok: false, reason: "failed" });
    expect(files.calls).toEqual([]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_trim_plan"]);
  });

  it("기록을 고치는 함수가 오류거나 null(내 책장 아님)이면 failed", async () => {
    expect(await trimMailbox(fake({ mailbox_trim_plan: { data: plan }, mailbox_trim_apply: { error: { message: "x" } } }).client, "m1")).toEqual({
      ok: false,
      reason: "failed",
    });
    expect(await trimMailbox(fake({ mailbox_trim_plan: { data: plan }, mailbox_trim_apply: { data: null } }).client, "m1")).toEqual({
      ok: false,
      reason: "failed",
    });
  });
});
