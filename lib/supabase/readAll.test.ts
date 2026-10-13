// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ROWS_PER_PAGE, readAll } from "./readAll";

/* 서버는 한 번에 1000줄까지만 준다 — 끝까지 읽는 길이 줄이 천을 넘어도 하나도 빠뜨리지 않는지 본다. */
const table = (count: number) => Array.from({ length: count }, (_, i) => i);
const reader = (rows: number[], calls: number[][] = []) => async (from: number, to: number) => {
  calls.push([from, to]);
  return { data: rows.slice(from, Math.min(to, from + ROWS_PER_PAGE - 1) + 1), error: null };
};

describe("readAll", () => {
  it("줄이 적으면 한 번에 읽는다", async () => {
    const calls: number[][] = [];
    expect(await readAll(reader(table(59), calls))).toEqual(table(59));
    expect(calls).toEqual([[0, 999]]);
  });

  it("천 줄을 넘으면 나눠서 전부 읽는다 — 하나도 빠지지 않는다", async () => {
    const calls: number[][] = [];
    const rows = await readAll(reader(table(2350), calls));
    expect(rows).toHaveLength(2350);
    expect(rows![2349]).toBe(2349);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("딱 1000줄이면 한 번 더 읽어 끝을 확인한다", async () => {
    const calls: number[][] = [];
    expect(await readAll(reader(table(1000), calls))).toHaveLength(1000);
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("어느 구간이든 못 읽으면 반쯤 읽은 것을 돌려주지 않고 null", async () => {
    let call = 0;
    const flaky = async (from: number, to: number) => (++call === 2 ? { data: null, error: { message: "x" } } : reader(table(2500))(from, to));
    expect(await readAll(flaky)).toBeNull();
  });
});
