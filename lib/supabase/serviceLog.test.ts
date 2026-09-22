// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "./serviceLog";

/*
  기록하려다 하던 일이 멈추면 주객이 전도된다.

  실제로 그랬다 — 표를 만들기 전에는 rpc 를 부르는 것만으로 던져서,
  사진을 읽다 말고 화면이 "사진을 읽고 있어요" 에 멈춰 있었다.
*/

const 아무_말도 = () => {
  const spy = vi.fn();
  // 아무 일도 하지 않지만 콘솔은 조용해야 한다.
  return spy;
};

describe("logEvent", () => {
  it("남길 곳이 없으면 조용히 넘어간다", () => {
    expect(() => logEvent(null, "signed_in")).not.toThrow();
  });

  it("rpc 가 아예 없어도 던지지 않는다 — 표를 만들기 전", () => {
    const supabase = {} as unknown as SupabaseClient;
    expect(() => logEvent(supabase, "photos_read", { picked: 3 })).not.toThrow();
  });

  it("rpc 가 던져도 던지지 않는다", () => {
    const supabase = {
      rpc: () => {
        throw new Error("망가짐");
      },
    } as unknown as SupabaseClient;
    expect(() => logEvent(supabase, "trips_saved", { saved: 1 })).not.toThrow();
  });

  it("rpc 가 실패한 약속을 돌려줘도 잡히지 않은 거절이 남지 않는다", async () => {
    const supabase = {
      rpc: () => Promise.reject(new Error("망가짐")),
    } as unknown as SupabaseClient;

    const unhandled = 아무_말도();
    process.on("unhandledRejection", unhandled);
    logEvent(supabase, "photo_deleted", { ok: true });
    // 마이크로태스크가 다 돌 때까지 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });

  it("이름과 내용을 그대로 실어 보낸다", () => {
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const supabase = { rpc } as unknown as SupabaseClient;

    logEvent(supabase, "photos_uploaded", { uploaded: 87, unsupported: 13 });

    expect(rpc).toHaveBeenCalledWith("log_event", {
      p_event: "photos_uploaded",
      p_detail: { uploaded: 87, unsupported: 13 },
    });
  });

  it("기다리게 하지 않는다 — 부르고 바로 돌아온다", () => {
    let settled = false;
    const supabase = {
      rpc: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            settled = true;
            resolve({ data: null, error: null });
          }, 50);
        }),
    } as unknown as SupabaseClient;

    logEvent(supabase, "trip_renamed", { title: true });
    // 돌아왔을 때 rpc 는 아직 끝나지 않았다.
    expect(settled).toBe(false);
  });
});
