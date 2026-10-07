import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const calls = vi.hoisted(() => ({ order: [] as string[], collections: vi.fn(), forget: vi.fn() }));
vi.mock("@/lib/supabase/photos", () => ({
  forgetSignedUrls: () => {
    calls.order.push("forget");
    calls.forget();
  },
}));
vi.mock("@/lib/collections", () => ({
  writeCollections: (value: unknown) => {
    calls.order.push("collections");
    calls.collections(value);
  },
}));

const { signOutAndReload } = await import("./signOut");

/*
  로그아웃은 "나가기"만이 아니다. 앞사람의 사진 주소와 이 기기의 목록이 조금도 남지 않아야, 다음 사람이
  로그인할 때 앞사람의 것이 그 사람 계정으로 합쳐지지 않는다.
*/
describe("signOutAndReload · 로그아웃", () => {
  it("나간 뒤 받아 둔 사진 주소와 이 기기의 목록을 비우고 새로고침한다 — 이 차례로", async () => {
    calls.order.length = 0;
    const supabase = {
      auth: {
        signOut: async () => {
          calls.order.push("signOut");
          return { error: null };
        },
      },
    } as unknown as SupabaseClient;
    const reload = vi.fn(() => calls.order.push("reload"));

    await signOutAndReload(supabase, reload);

    expect(calls.order).toEqual(["signOut", "forget", "collections", "reload"]);
    expect(calls.collections).toHaveBeenCalledWith({ wishlist: [], trip: [] });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
