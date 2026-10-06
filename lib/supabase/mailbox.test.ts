// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECOMMENDED } from "@/lib/mailboxSettings";
import {
  acceptMailboxInvite,
  cancelMailboxInvite,
  createMailbox,
  createMailboxInvite,
  fetchMailboxInvites,
  fetchMailboxes,
  leaveMailbox,
  rotateMailboxToken,
  setMailboxClosed,
  updateMailbox,
  updateMailboxSettings,
} from "./mailbox";

type Call = { op: string; table?: string; value?: unknown; eq?: [string, unknown][] };

/** 어떤 호출이 어떤 값으로 갔는지 적어 두는 가짜 Supabase. */
function fake(
  options: {
    mailboxes?: unknown[];
    senders?: unknown[];
    invites?: unknown[];
    insertError?: { message: string } | null;
    updateError?: { message: string } | null;
    deleteError?: boolean;
    rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
  } = {},
) {
  const calls: Call[] = [];
  const table = (name: string) => ({
    select: (columns?: string) => {
      calls.push({ op: "select", table: name, value: columns });
      const rows = name === "mailboxes" ? options.mailboxes : name === "mailbox_senders" ? options.senders : options.invites;
      const result = { data: rows ?? [], error: null };
      const chain: Record<string, unknown> = {
        order: async () => result,
        eq: () => chain,
        is: () => chain,
        gt: () => chain,
        then: (resolve: (v: typeof result) => void) => resolve(result),
      };
      return chain;
    },
    insert: (row: unknown) => {
      calls.push({ op: "insert", table: name, value: row });
      return {
        select: () => ({
          single: async () => ({
            data: options.insertError ? null : { id: "new-id" },
            error: options.insertError ?? null,
          }),
        }),
        then: (resolve: (v: { error: unknown }) => void) => resolve({ error: options.insertError ?? null }),
      };
    },
    update: (value: unknown) => {
      const record: Call = { op: "update", table: name, value, eq: [] };
      calls.push(record);
      const chain: { eq: (c: string, v: unknown) => unknown; then: (r: (v: { error: unknown }) => void) => void } = {
        eq: (column, v) => {
          record.eq!.push([column, v]);
          return chain;
        },
        then: (resolve) => resolve({ error: options.updateError ?? null }),
      };
      return chain;
    },
    delete: () => {
      const record: Call = { op: "delete", table: name, eq: [] };
      calls.push(record);
      const chain: { eq: (c: string, v: unknown) => unknown; then: (r: (v: { error: unknown }) => void) => void } = {
        eq: (column, v) => {
          record.eq!.push([column, v]);
          return chain;
        },
        then: (resolve) => resolve({ error: options.deleteError ? { message: "x" } : null }),
      };
      return chain;
    },
  });
  const client = {
    from: table,
    rpc: async (name: string, args?: unknown) => {
      calls.push({ op: "rpc", table: name, value: args });
      return options.rpc?.[name] ?? { data: null, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  owner_id: "me",
  name: "우리 엄마 아빠",
  greeting_name: "엄마 아빠",
  use_greeting: true,
  tone: "casual",
  members: ["엄마", "아빠"],
  token: "T".repeat(40),
  closed_at: null,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("fetchMailboxes", () => {
  it("내가 만든 것과 보내는 사람으로 들어간 것을 나누고, 보내는 사람 수를 센다", async () => {
    const { client } = fake({
      mailboxes: [row(), row({ id: "m2", owner_id: "other", name: "장모님" })],
      senders: [
        { mailbox_id: "m1", user_id: "me", role: "owner" },
        { mailbox_id: "m1", user_id: "sis", role: "sender" },
        { mailbox_id: "m2", user_id: "other", role: "owner" },
        { mailbox_id: "m2", user_id: "me", role: "sender" },
      ],
    });
    const result = await fetchMailboxes(client, "me");
    expect(result).not.toBe("failed");
    if (result === "failed") return;
    expect(result.owned).toHaveLength(1);
    expect(result.owned[0]).toMatchObject({ id: "m1", name: "우리 엄마 아빠", greetingName: "엄마 아빠", members: ["엄마", "아빠"], senderCount: 2, closed: false });
    expect(result.joined).toHaveLength(1);
    expect(result.joined[0]).toMatchObject({ id: "m2", name: "장모님", senderCount: 2 });
  });

  it("닫힌 것은 closed 로, 모르는 말투는 편하게로 읽는다", async () => {
    const { client } = fake({ mailboxes: [row({ closed_at: "2026-10-02T00:00:00Z", tone: "weird" })], senders: [] });
    const result = await fetchMailboxes(client, "me");
    if (result === "failed") throw new Error("failed");
    expect(result.owned[0]).toMatchObject({ closed: true, tone: "casual" });
  });
});

describe("책장 설정 읽고 쓰기", () => {
  it("우편함에 설정이 없으면 권장값으로 읽는다", async () => {
    const { client } = fake({ mailboxes: [row()], senders: [] });
    const result = await fetchMailboxes(client, "me");
    if (result === "failed") throw new Error("failed");
    expect(result.owned[0].settings).toEqual(RECOMMENDED);
  });

  it("저장된 설정은 칸마다 확인해 읽는다 — 깨진 칸만 권장으로", async () => {
    const { client } = fake({ mailboxes: [row({ settings: { photos: 12, size: 999, font: "xlarge", words: ["고맙다"] } })], senders: [] });
    const result = await fetchMailboxes(client, "me");
    if (result === "failed") throw new Error("failed");
    expect(result.owned[0].settings).toMatchObject({ photos: 12, size: 640, font: "xlarge" });
    expect(result.owned[0].settings.words[0]).toBe("고맙다");
  });

  it("설정을 저장한다 — 그 우편함 한 줄에만, 다듬은 값 전체를", async () => {
    const { client, calls } = fake();
    const result = await updateMailboxSettings(client, "m1", { ...RECOMMENDED, photos: 12, words: ["  고맙다 ", "또 가자", "잘했다"] });
    expect(result).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({ op: "update", table: "mailboxes", eq: [["id", "m1"]] });
    expect((calls[0].value as { settings: { photos: number; words: string[] } }).settings.photos).toBe(12);
    expect((calls[0].value as { settings: { words: string[] } }).settings.words[0]).toBe("고맙다");
  });

  it("범위를 벗어난 값을 넣어도 권장으로 다듬어 저장한다", async () => {
    const { client, calls } = fake();
    // @ts-expect-error 일부러 틀린 값
    await updateMailboxSettings(client, "m1", { ...RECOMMENDED, photos: 7, size: 800 });
    const saved = (calls[0].value as { settings: { photos: number; size: number } }).settings;
    expect(saved.photos).toBe(20);
    expect(saved.size).toBe(640);
  });

  it("저장하지 못하면 failed", async () => {
    const { client } = fake({ updateError: { message: "x" } });
    expect(await updateMailboxSettings(client, "m1", RECOMMENDED)).toEqual({ ok: false, reason: "failed" });
  });
});

describe("createMailbox", () => {
  const input = { name: "  우리 엄마 아빠 ", greetingName: "엄마 아빠", useGreeting: true, tone: "casual" as const, members: "엄마, 아빠" };

  it("다듬은 값과 새 링크 글자로 만든다", async () => {
    const { client, calls } = fake();
    const result = await createMailbox(client, "me", input);
    expect(result.ok).toBe(true);
    const insert = calls.find((c) => c.op === "insert")!;
    expect(insert.table).toBe("mailboxes");
    expect(insert.value).toMatchObject({
      owner_id: "me",
      name: "우리 엄마 아빠",
      greeting_name: "엄마 아빠",
      use_greeting: true,
      tone: "casual",
      members: ["엄마", "아빠"],
    });
    expect((insert.value as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    if (result.ok) expect(result.token).toBe((insert.value as { token: string }).token);
  });

  it("받는 분 이름을 비우면 부르는 말에서 만든다", async () => {
    const { client, calls } = fake();
    await createMailbox(client, "me", { ...input, members: "" });
    expect((calls.find((c) => c.op === "insert")!.value as { members: string[] }).members).toEqual(["엄마", "아빠"]);
  });

  it("부르는 말이 비면 null 로 둔다", async () => {
    const { client, calls } = fake();
    await createMailbox(client, "me", { ...input, greetingName: "  ", members: "엄마" });
    expect((calls.find((c) => c.op === "insert")!.value as { greeting_name: unknown }).greeting_name).toBeNull();
  });

  it("이름이 비었거나 너무 길면 DB 에 묻지 않고 거절한다", async () => {
    const { client, calls } = fake();
    expect(await createMailbox(client, "me", { ...input, name: "   " })).toEqual({ ok: false, reason: "invalid" });
    expect(await createMailbox(client, "me", { ...input, name: "가".repeat(41) })).toEqual({ ok: false, reason: "invalid" });
    expect(await createMailbox(client, "me", { ...input, greetingName: "가".repeat(21) })).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("우편함 3개를 넘으면 limit", async () => {
    const { client } = fake({ insertError: { message: "mailboxes: 우편함은 3개까지 만들 수 있다" } });
    expect(await createMailbox(client, "me", input)).toEqual({ ok: false, reason: "limit" });
  });

  it("그 밖의 실패는 failed", async () => {
    const { client } = fake({ insertError: { message: "boom" } });
    expect(await createMailbox(client, "me", input)).toEqual({ ok: false, reason: "failed" });
  });
});

describe("updateMailbox · rotate · close · leave", () => {
  it("고친 값을 그 우편함 한 줄에만", async () => {
    const { client, calls } = fake();
    expect(await updateMailbox(client, "m1", { name: "장모님", greetingName: "장모님", useGreeting: false, tone: "polite", members: "장인, 장모" })).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({
      op: "update",
      table: "mailboxes",
      value: { name: "장모님", greeting_name: "장모님", use_greeting: false, tone: "polite", members: ["장인", "장모"] },
      eq: [["id", "m1"]],
    });
  });

  it("고칠 때도 이름 검사를 한다", async () => {
    const { client, calls } = fake();
    expect(await updateMailbox(client, "m1", { name: "", greetingName: "", useGreeting: true, tone: "casual", members: "" })).toEqual({ ok: false, reason: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("링크 새로 만들기는 새 글자를 적고 그 글자를 돌려준다", async () => {
    const { client, calls } = fake();
    const token = await rotateMailboxToken(client, "m1");
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(calls[0]).toMatchObject({ op: "update", table: "mailboxes", value: { token }, eq: [["id", "m1"]] });
  });

  it("링크 새로 만들기 실패는 failed", async () => {
    const { client } = fake({ updateError: { message: "x" } });
    expect(await rotateMailboxToken(client, "m1")).toBe("failed");
  });

  it("닫기는 닫은 시각을, 다시 열기는 null 을 적는다", async () => {
    const closing = fake();
    expect(await setMailboxClosed(closing.client, "m1", true)).toEqual({ ok: true });
    expect((closing.calls[0].value as { closed_at: unknown }).closed_at).toEqual(expect.any(String));
    const opening = fake();
    await setMailboxClosed(opening.client, "m1", false);
    expect(opening.calls[0].value).toEqual({ closed_at: null });
  });

  it("다시 열 때 열린 우편함이 3개면 limit", async () => {
    const { client } = fake({ updateError: { message: "mailboxes: 우편함은 3개까지 열어 둘 수 있다" } });
    expect(await setMailboxClosed(client, "m1", false)).toEqual({ ok: false, reason: "limit" });
  });

  it("나가기는 내 보내는 사람 줄 한 개만 지운다", async () => {
    const { client, calls } = fake();
    expect(await leaveMailbox(client, "m1", "me")).toBe(true);
    expect(calls[0]).toMatchObject({ op: "delete", table: "mailbox_senders", eq: [["mailbox_id", "m1"], ["user_id", "me"]] });
  });
});

describe("보내는 사람 초대", () => {
  it("우편함·만든 사람·7일 만료로 만든다", async () => {
    const { client, calls } = fake();
    const token = await createMailboxInvite(client, "m1", "me", new Date("2026-10-01T00:00:00Z"));
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(calls[0]).toMatchObject({
      op: "insert",
      table: "mailbox_invites",
      value: { token, mailbox_id: "m1", created_by: "me", expires_at: "2026-10-08T00:00:00.000Z" },
    });
  });

  it("못 만들면 failed", async () => {
    const { client } = fake({ insertError: { message: "x" } });
    expect(await createMailboxInvite(client, "m1", "me")).toBe("failed");
  });

  it("남은 초대를 읽을 수 있는 모양으로", async () => {
    const { client } = fake({ invites: [{ token: "t".repeat(40), mailbox_id: "m1", expires_at: "2026-10-08T00:00:00Z" }] });
    expect(await fetchMailboxInvites(client, "me")).toEqual([{ token: "t".repeat(40), mailboxId: "m1", expiresAt: "2026-10-08T00:00:00Z" }]);
  });

  it("취소는 그 글자의 줄을 지운다", async () => {
    const { client, calls } = fake();
    expect(await cancelMailboxInvite(client, "t".repeat(40))).toBe(true);
    expect(calls[0]).toMatchObject({ op: "delete", table: "mailbox_invites", eq: [["token", "t".repeat(40)]] });
  });

  it("수락하면 우편함 id 를 돌려준다", async () => {
    const { client, calls } = fake({ rpc: { accept_mailbox_invite: { data: "m9" } } });
    expect(await acceptMailboxInvite(client, "a".repeat(43))).toEqual({ ok: true, mailboxId: "m9" });
    expect(calls[0]).toMatchObject({ op: "rpc", table: "accept_mailbox_invite", value: { invite_token: "a".repeat(43) } });
  });

  it.each([
    ["mailbox: 없는 초대다", "missing"],
    ["mailbox: 이미 쓴 초대다", "used"],
    ["mailbox: 만료된 초대다", "expired"],
    ["mailbox: 닫힌 우편함이다", "closed"],
    ["mailbox_senders: 보내는 사람은 8명까지 들일 수 있다", "full"],
    ["mailbox: 로그인이 필요하다", "login"],
    ["boom", "failed"],
  ])("%s → %s", async (message, reason) => {
    const { client } = fake({ rpc: { accept_mailbox_invite: { error: { message } } } });
    expect(await acceptMailboxInvite(client, "a".repeat(43))).toEqual({ ok: false, reason });
  });

  it("모양이 틀린 글자는 묻지도 않는다", async () => {
    const { client, calls } = fake();
    expect(await acceptMailboxInvite(client, "짧음")).toEqual({ ok: false, reason: "missing" });
    expect(calls).toHaveLength(0);
  });
});
