// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rememberPlaceName } from "./placeNames";

function fake(rows: { id: string; lat: number; lng: number; name: string }[]) {
  const log: string[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: rows, error: null }) }),
      delete: () => ({
        eq: () => ({
          in: async (_column: string, ids: string[]) => {
            log.push(`delete ${ids.join(",")}`);
            return { error: null };
          },
        }),
      }),
      insert: async (row: { name: string }) => {
        log.push(`insert ${row.name}`);
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { client, log };
}

describe("rememberPlaceName", () => {
  it("가까운 옛 이름은 지우고 새 이름을 적는다 — 한 자리에 이름 하나", async () => {
    const { client, log } = fake([
      { id: "old", lat: 37.772, lng: 128.9477, name: "도소골" },
      { id: "far", lat: 37.8055, lng: 128.9082, name: "경포" },
    ]);
    expect(await rememberPlaceName(client, "u", 37.7721, 128.9478, " 안목 커피거리 ")).toBe(true);
    expect(log).toEqual(["delete old", "insert 안목 커피거리"]);
  });

  it("빈 이름이나 모르는 자리는 적지 않는다", async () => {
    const { client, log } = fake([]);
    expect(await rememberPlaceName(client, "u", 37.7, 128.9, "  ")).toBe(false);
    expect(await rememberPlaceName(client, "u", NaN, 128.9, "안목")).toBe(false);
    expect(log).toEqual([]);
  });
});
