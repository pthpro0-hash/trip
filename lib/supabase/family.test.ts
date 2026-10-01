// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acceptInvite,
  cancelInvite,
  changeRole,
  createInvite,
  fetchCircle,
  fetchInvites,
  inviteUrl,
  removeLink,
} from "./family";

/** 어떤 호출이 어떤 값으로 갔는지 적어 두는 가짜 Supabase. */
function fake(
  options: {
    insertError?: boolean;
    rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
    invites?: unknown[];
    updateError?: boolean;
    deleteError?: boolean;
  } = {},
) {
  const calls: { op: string; table?: string; value?: unknown; eq?: [string, unknown][] }[] = [];
  const client = {
    from: (table: string) => ({
      insert: async (row: unknown) => {
        calls.push({ op: "insert", table, value: row });
        return { error: options.insertError ? { message: "x" } : null };
      },
      select: () => ({
        eq: (column: string, value: unknown) => ({
          is: () => ({
            gt: () => ({
              order: async () => ({ data: options.invites ?? [], error: null }),
            }),
          }),
          // 읽어 오기 한 단계 더(막대) — 쓰지 않는다.
          _col: [column, value],
        }),
      }),
      update: (value: unknown) => ({
        eq: (c1: string, v1: unknown) => ({
          eq: async (c2: string, v2: unknown) => {
            calls.push({ op: "update", table, value, eq: [[c1, v1], [c2, v2]] });
            return { error: options.updateError ? { message: "x" } : null };
          },
        }),
      }),
      delete: () => ({
        eq: (c1: string, v1: unknown) => ({
          eq: async (c2: string, v2: unknown) => {
            calls.push({ op: "delete", table, eq: [[c1, v1], [c2, v2]] });
            return { error: options.deleteError ? { message: "x" } : null };
          },
          // 초대 하나는 줄이 하나라 조건이 하나다.
          then: (resolve: (v: { error: unknown }) => void) => {
            calls.push({ op: "delete", table, eq: [[c1, v1]] });
            resolve({ error: options.deleteError ? { message: "x" } : null });
          },
        }),
      }),
    }),
    rpc: async (name: string, args?: unknown) => {
      calls.push({ op: "rpc", table: name, value: args });
      return options.rpc?.[name] ?? { data: null, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("초대 만들기", () => {
  it("권한과 주인과 만료를 적고, 링크에 들어갈 글자를 돌려준다", async () => {
    const { client, calls } = fake();
    const token = await createInvite(client, "owner-1", "edit", new Date("2026-10-01T00:00:00Z"));
    expect(token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: "insert",
      table: "family_invites",
      value: { token, owner_id: "owner-1", role: "edit", expires_at: "2026-10-08T00:00:00.000Z" },
    });
  });

  it("못 만들면 'failed'", async () => {
    const { client } = fake({ insertError: true });
    expect(await createInvite(client, "owner-1", "view")).toBe("failed");
  });
});

describe("초대 목록", () => {
  it("아직 쓸 수 있는 것만, 읽을 수 있는 모양으로", async () => {
    const { client } = fake({
      invites: [{ token: "t".repeat(40), role: "full", expires_at: "2026-10-08T00:00:00Z" }],
    });
    expect(await fetchInvites(client, "owner-1")).toEqual([
      { token: "t".repeat(40), role: "full", expiresAt: "2026-10-08T00:00:00Z" },
    ]);
  });

  it("모르는 권한이 든 줄은 버린다", async () => {
    const { client } = fake({ invites: [{ token: "t".repeat(40), role: "admin", expires_at: "2026-10-08T00:00:00Z" }] });
    expect(await fetchInvites(client, "owner-1")).toEqual([]);
  });
});

describe("가족 목록", () => {
  it("내가 들인 가족과 나에게 열어 준 사람으로 나눈다", async () => {
    const { client } = fake({
      rpc: {
        family_circle: {
          data: [
            { direction: "owned", other_id: "m1", other_email: "mom@example.com", role: "view", created_at: "2026-10-01T00:00:00Z" },
            { direction: "shared", other_id: "o1", other_email: "dad@example.com", role: "full", created_at: "2026-10-02T00:00:00Z" },
            { direction: "owned", other_id: "m2", other_email: null, role: "bogus", created_at: "2026-10-03T00:00:00Z" },
          ],
        },
      },
    });
    const circle = await fetchCircle(client);
    expect(circle).not.toBe("failed");
    if (circle === "failed") return;
    expect(circle.owned).toEqual([{ id: "m1", email: "mom@example.com", role: "view", since: "2026-10-01T00:00:00Z" }]);
    expect(circle.shared).toEqual([{ id: "o1", email: "dad@example.com", role: "full", since: "2026-10-02T00:00:00Z" }]);
  });

  it("묻지 못하면 'failed'", async () => {
    const { client } = fake({ rpc: { family_circle: { error: { message: "x" } } } });
    expect(await fetchCircle(client)).toBe("failed");
  });
});

describe("권한 바꾸기 · 해제 · 취소", () => {
  it("권한은 (주인, 가족) 한 줄만 바꾼다", async () => {
    const { client, calls } = fake();
    expect(await changeRole(client, "owner-1", "m1", "full")).toBe(true);
    expect(calls[0]).toMatchObject({
      op: "update",
      table: "family_links",
      value: { role: "full" },
      eq: [["owner_id", "owner-1"], ["member_id", "m1"]],
    });
  });

  it("해제(나가기)도 한 줄만 지운다", async () => {
    const { client, calls } = fake();
    expect(await removeLink(client, "owner-1", "m1")).toBe(true);
    expect(calls[0]).toMatchObject({
      op: "delete",
      table: "family_links",
      eq: [["owner_id", "owner-1"], ["member_id", "m1"]],
    });
  });

  it("실패하면 false", async () => {
    const { client } = fake({ updateError: true, deleteError: true });
    expect(await changeRole(client, "o", "m", "view")).toBe(false);
    expect(await removeLink(client, "o", "m")).toBe(false);
  });

  it("초대 취소는 그 글자의 줄을 지운다", async () => {
    const { client, calls } = fake();
    expect(await cancelInvite(client, "t".repeat(40))).toBe(true);
    expect(calls[0]).toMatchObject({ op: "delete", table: "family_invites", eq: [["token", "t".repeat(40)]] });
  });
});

describe("초대 수락", () => {
  const token = "a".repeat(43);

  it("성공하면 주인의 id 를 돌려준다", async () => {
    const { client, calls } = fake({ rpc: { accept_family_invite: { data: "owner-9" } } });
    expect(await acceptInvite(client, token)).toEqual({ ok: true, ownerId: "owner-9" });
    expect(calls[0]).toMatchObject({ op: "rpc", table: "accept_family_invite", value: { invite_token: token } });
  });

  it.each([
    ["family: 없는 초대다", "missing"],
    ["family: 이미 쓴 초대다", "used"],
    ["family: 만료된 초대다", "expired"],
    ["family: 내 초대는 내가 수락할 수 없다", "own"],
    ["family_links: 가족은 8명까지 들일 수 있다", "full"],
    ["family: 로그인이 필요하다", "login"],
    ["something else", "failed"],
  ])("%s → %s", async (message, reason) => {
    const { client } = fake({ rpc: { accept_family_invite: { error: { message } } } });
    expect(await acceptInvite(client, token)).toEqual({ ok: false, reason });
  });

  it("모양이 틀린 글자는 묻지도 않는다", async () => {
    const { client, calls } = fake();
    expect(await acceptInvite(client, "짧음")).toEqual({ ok: false, reason: "missing" });
    expect(calls).toHaveLength(0);
  });
});

describe("초대 주소", () => {
  it("/join/<글자> 로 만든다", () => {
    expect(inviteUrl("https://example.com", "abc")).toBe("https://example.com/join/abc");
  });
});
