// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyFiles, HEAVY_BYTES, scanStorage, sweepOrphans, worthReshrinking } from "./storageSweep";
import { FULL_BUDGET } from "@/lib/photo/resize";

/*
  표는 한 번에 1,000줄까지만 준다. 그대로 받으면 나머지 사진의 파일이
  "쓰지 않는 파일"로 잡혀 지워진다. 나눠 받아야 하고, 수가 안 맞으면 멈춘다.
*/
describe("scanStorage · 기록을 빠짐없이", () => {
  const TOTAL = 1500;
  const all = Array.from({ length: TOTAL }, (_, i) => `u/v1/${i}.webp`);

  function fake(returnedTotal = TOTAL) {
    const table = {
      select: (_columns: string, options?: { head?: boolean }) => {
        if (options?.head) return { eq: async () => ({ count: TOTAL, error: null }) };
        return {
          eq: () => ({
            order: () => ({
              range: async (from: number, to: number) => ({
                // 1,000줄 한도를 흉내 낸다.
                data: all
                  .slice(from, Math.min(to + 1, from + 1000, returnedTotal))
                  .map((path) => ({ storage_path: path })),
                error: null,
              }),
            }),
          }),
        };
      },
    };
    const files = all.map((path) => ({ name: path.split("/")[2], id: path, metadata: { size: 1 } }));
    return {
      from: () => table,
      storage: {
        from: () => ({
          list: async (prefix: string, { offset }: { offset: number }) =>
            prefix === "u"
              ? { data: offset === 0 ? [{ name: "v1", id: null, metadata: null }] : [], error: null }
              : { data: files.slice(offset, offset + 1000), error: null },
        }),
      },
    } as unknown as SupabaseClient;
  }

  it("1,000장이 넘어도 모든 사진을 쓰이는 것으로 본다", async () => {
    const report = await scanStorage(fake(), "u");
    expect(report?.photoCount).toBe(TOTAL);
    expect(report?.orphans).toEqual([]);
  });

  it("받은 수가 전체와 다르면 아무것도 판단하지 않는다", async () => {
    expect(await scanStorage(fake(1200), "u")).toBeNull();
  });
});

const f = (path: string, bytes: number) => ({ path, bytes });

describe("classifyFiles", () => {
  const photos = ["u/v1/a.webp"];
  const files = [
    f("u/v1/a.webp", 500),
    f("u/v1/a.t960.webp", 100),
    f("u/v1/a.t160.webp", 10),
    f("u/v1/a.thumb.webp", 90), // 예전 방식의 작은 판
    f("u/v9/gone.webp", 700), // 지운 여행의 사진
    f("u/v9/gone.t960.webp", 120),
  ];
  const report = classifyFiles(files, photos);

  it("쓰이는 파일을 종류별로 센다", () => {
    expect(report.used.full).toEqual({ count: 1, bytes: 500 });
    expect(report.used.thumb).toEqual({ count: 1, bytes: 100 });
    expect(report.used.marker).toEqual({ count: 1, bytes: 10 });
    expect(report.photoCount).toBe(1);
  });

  it("기록이 가리키지 않는 파일은 모두 쓰지 않는 파일", () => {
    expect(report.orphans.map((file) => file.path)).toEqual([
      "u/v1/a.thumb.webp",
      "u/v9/gone.webp",
      "u/v9/gone.t960.webp",
    ]);
    expect(report.orphanBytes).toBe(910);
  });
});

/*
  아이폰 사파리에서 올린 보관본은 PNG 로 굳어 4MB 안팎이다. 그것만
  골라 다시 줄인다. 크기는 세 판을 더한 것이라야 줄어든 양을 바로 잰다.
*/
describe("classifyFiles · 무거운 사진", () => {
  const MB = 1024 * 1024;
  const report = classifyFiles(
    [
      f("u/v1/무거운.webp", 4 * MB),
      f("u/v1/무거운.t960.webp", MB / 2),
      f("u/v1/무거운.t160.webp", 1000),
      f("u/v1/가벼운.webp", 400 * 1024),
      f("u/v1/가벼운.t960.webp", 87 * 1024),
      f("u/v9/지운.webp", 5 * MB), // 기록에 없는 것은 다시 줄이지 않고 지운다
    ],
    ["u/v1/무거운.webp", "u/v1/가벼운.webp"],
  );

  it("보관본이 기준보다 큰 사진만, 세 판을 더한 크기로", () => {
    expect(report.heavy).toEqual([{ path: "u/v1/무거운.webp", bytes: 4 * MB + MB / 2 + 1000 }]);
    expect(report.heavyBytes).toBe(4 * MB + MB / 2 + 1000);
  });

  it("기준은 보관본 상한보다 넉넉히 위 — 제대로 구운 것을 또 줄이지 않게", () => {
    expect(HEAVY_BYTES).toBeGreaterThan(FULL_BUDGET * 1.2);
  });
});

/*
  자잘한 사진은 가장 낮은 품질로도 800KB 를 넘어 늘 "무거운 사진"으로
  남는다. 줄여 봐야 얼마 안 되면 권하지 않는다.
*/
describe("worthReshrinking", () => {
  const MB = 1024 * 1024;
  const heavy = (n: number, eachMb: number) => ({
    heavy: Array.from({ length: n }, (_, i) => ({ path: `u/v1/${i}.webp`, bytes: eachMb * MB })),
    heavyBytes: n * eachMb * MB,
  });

  it("더 줄지 않는 자잘한 사진 몇 장은 권하지 않는다", () => {
    expect(worthReshrinking(heavy(23, 25 / 23))).toBe(false);
  });

  it("PNG 로 굳은 사진처럼 크게 줄 것은 권한다", () => {
    expect(worthReshrinking(heavy(20, 6))).toBe(true);
    expect(worthReshrinking(heavy(359, 517 / 359))).toBe(true);
  });

  it("무거운 사진이 없으면 권하지 않는다", () => {
    expect(worthReshrinking(heavy(0, 0))).toBe(false);
  });
});

describe("sweepOrphans", () => {
  it("제 폴더 것만, 100개씩 나눠 지운다", async () => {
    const batches: string[][] = [];
    const client = {
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            batches.push(paths);
            return { data: paths.map((name) => ({ name })), error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    const orphans = [...Array.from({ length: 150 }, (_, i) => f(`u/v9/${i}.webp`, 1)), f("someone/else.webp", 1)];
    expect(await sweepOrphans(client, "u", orphans)).toBe(150);
    expect(batches.map((batch) => batch.length)).toEqual([100, 50]);
    expect(batches.flat()).not.toContain("someone/else.webp");
  });
});
