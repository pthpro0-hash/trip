// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { removePostcardFiles } from "./postcardCleanup";

function fake(result: { data: { name: string }[] | null; error: { message: string } | null }) {
  const removed: string[][] = [];
  const supabase = {
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe("postcards");
        return {
          remove: async (paths: string[]) => {
            removed.push(paths);
            return result;
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { supabase, removed };
}

describe("removePostcardFiles · 엽서 사진 몇 장만 지운다", () => {
  it("엽서 폴더 안의 그 파일들만 — '엽서 주소/파일' 경로로", async () => {
    const { supabase, removed } = fake({ data: [{ name: "a" }, { name: "b" }], error: null });
    expect(await removePostcardFiles(supabase, "card1", ["b.webp", "c.webp"])).toBe(true);
    expect(removed).toEqual([["card1/b.webp", "card1/c.webp"]]);
  });

  it("지울 것이 없으면 묻지도 않고 true", async () => {
    const { supabase, removed } = fake({ data: [], error: null });
    expect(await removePostcardFiles(supabase, "card1", [])).toBe(true);
    expect(removed).toEqual([]);
  });

  it("오류거나 지운 수가 모자라면 false — 권한이 없으면 오류 없이 못 지운다", async () => {
    expect(await removePostcardFiles(fake({ data: null, error: { message: "x" } }).supabase, "card1", ["b.webp"])).toBe(false);
    expect(await removePostcardFiles(fake({ data: [{ name: "b" }], error: null }).supabase, "card1", ["b.webp", "c.webp"])).toBe(false);
    expect(await removePostcardFiles(fake({ data: [], error: null }).supabase, "card1", ["b.webp"])).toBe(false);
  });
});
