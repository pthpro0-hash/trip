// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const sweep = vi.hoisted(() => ({ calls: [] as string[], fail: new Set<string>() }));
vi.mock("./postcardCleanup", () => ({
  sweepPostcardFolder: async (_supabase: unknown, id: string) => {
    sweep.calls.push(id);
    return !sweep.fail.has(id);
  },
}));

const { deleteMailbox, planMailboxDelete } = await import("./mailbox");

const P1 = "a".repeat(43);
const P2 = "b".repeat(43);
const P3 = "c".repeat(43);

/** rpc 호출을 순서대로 적어 두는 가짜 Supabase. */
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
  sweep.calls.length = 0;
  sweep.fail.clear();
});

/*
  우편함을 지우는 순서 — 지울 엽서를 알아내고, 그 사진 파일을 먼저 지우고, 그다음에 줄을 지운다. 줄이 먼저 사라지면
  폴더의 주인을 밝힐 길이 없어 사진이 공개 보관함에 영영 남는다. 파일을 못 지웠으면 우편함도 지우지 않는다.
*/
describe("planMailboxDelete · 무엇이 지워지나", () => {
  it("이 우편함에만 간 엽서와, 다른 우편함에도 가서 남을 엽서 수를 읽는다", async () => {
    const { client, calls } = fake({ mailbox_delete_plan: { data: { sole: [P1, P2], kept: 3 } } });
    expect(await planMailboxDelete(client, "m1")).toEqual({ sole: [P1, P2], kept: 3 });
    expect(calls[0]).toEqual({ name: "mailbox_delete_plan", args: { box: "m1" } });
  });

  it("엽서가 없어도 읽는다", async () => {
    const { client } = fake({ mailbox_delete_plan: { data: { sole: [], kept: 0 } } });
    expect(await planMailboxDelete(client, "m1")).toEqual({ sole: [], kept: 0 });
  });

  it("내 우편함이 아니거나(null) 오류면 null — 지울 수 없다", async () => {
    expect(await planMailboxDelete(fake({ mailbox_delete_plan: { data: null } }).client, "m1")).toBeNull();
    expect(await planMailboxDelete(fake({ mailbox_delete_plan: { error: { message: "mailbox: 먼저 닫아야 지울 수 있다" } } }).client, "m1")).toBeNull();
  });

  it("엽서 주소 모양이 틀린 것은 버리고, 남는 수가 이상하면 0", async () => {
    const { client } = fake({ mailbox_delete_plan: { data: { sole: [P1, "../x", 3, null], kept: "많이" } } });
    expect(await planMailboxDelete(client, "m1")).toEqual({ sole: [P1], kept: 0 });
  });

  it("던져도 null", async () => {
    const client = { rpc: async () => { throw new Error("offline"); } } as unknown as SupabaseClient;
    expect(await planMailboxDelete(client, "m1")).toBeNull();
  });
});

describe("deleteMailbox · 지우기", () => {
  it("지울 엽서의 사진 폴더를 모두 치운 뒤에 우편함을 지운다 — 이 차례로", async () => {
    const { client, calls } = fake({
      mailbox_delete_plan: { data: { sole: [P1, P2, P3], kept: 0 } },
      mailbox_delete: { data: true },
    });
    expect(await deleteMailbox(client, "m1")).toBe("ok");
    expect(sweep.calls).toEqual([P1, P2, P3]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_delete_plan", "mailbox_delete"]);
    expect(calls[1].args).toEqual({ box: "m1" });
  });

  it("지울 엽서가 없으면 파일은 건드리지 않고 우편함만 지운다", async () => {
    const { client, calls } = fake({ mailbox_delete_plan: { data: { sole: [], kept: 2 } }, mailbox_delete: { data: true } });
    expect(await deleteMailbox(client, "m1")).toBe("ok");
    expect(sweep.calls).toEqual([]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_delete_plan", "mailbox_delete"]);
  });

  it("사진 폴더 하나라도 못 치우면 거기서 멈춘다 — 우편함도 줄도 지우지 않는다", async () => {
    sweep.fail.add(P2);
    const { client, calls } = fake({ mailbox_delete_plan: { data: { sole: [P1, P2, P3], kept: 0 } }, mailbox_delete: { data: true } });
    expect(await deleteMailbox(client, "m1")).toBe("files");
    expect(sweep.calls).toEqual([P1, P2]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_delete_plan"]);
  });

  it("계획을 못 읽으면 아무것도 지우지 않는다", async () => {
    const { client, calls } = fake({ mailbox_delete_plan: { error: { message: "x" } } });
    expect(await deleteMailbox(client, "m1")).toBe("failed");
    expect(sweep.calls).toEqual([]);
    expect(calls.map((call) => call.name)).toEqual(["mailbox_delete_plan"]);
  });

  it("지우는 함수가 false(내 우편함이 아님)나 오류를 주면 failed", async () => {
    const plan = { mailbox_delete_plan: { data: { sole: [], kept: 0 } } };
    expect(await deleteMailbox(fake({ ...plan, mailbox_delete: { data: false } }).client, "m1")).toBe("failed");
    expect(await deleteMailbox(fake({ ...plan, mailbox_delete: { error: { message: "mailbox: 먼저 닫아야 지울 수 있다" } } }).client, "m1")).toBe("failed");
  });
});
