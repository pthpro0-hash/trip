// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { inSequence, pickPreviewShots, PREVIEW_COUNT } from "./preview";
import type { Shot } from "./types";

const shots = (n: number): Shot[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${i}.jpg`,
    takenAt: new Date(2026, 8, 13, 9, i),
    lat: 37.77,
    lng: 128.94,
  }));

/*
  확인 화면의 여행 카드에는 그 여행의 사진 몇 장이 붙는다 — 제목만으로는 "어느 여행이지?" 하고
  멈추는 사람이 많다. 어떤 사진을 붙일지는 시간에 고르게 고른다(처음·가운데·끝). 첫 장 셋은
  같은 곳에서 연달아 찍은 같은 장면이기 쉽다.
*/
describe("pickPreviewShots", () => {
  it(`${PREVIEW_COUNT}장 이하면 있는 대로 다 쓴다`, () => {
    expect(pickPreviewShots(shots(0))).toEqual([]);
    expect(pickPreviewShots(shots(1)).map((s) => s.id)).toEqual(["0.jpg"]);
    expect(pickPreviewShots(shots(3)).map((s) => s.id)).toEqual(["0.jpg", "1.jpg", "2.jpg"]);
  });

  it("많으면 처음 · 가운데 · 끝에서 한 장씩 고른다", () => {
    expect(pickPreviewShots(shots(10)).map((s) => s.id)).toEqual(["0.jpg", "5.jpg", "9.jpg"]);
    expect(pickPreviewShots(shots(5)).map((s) => s.id)).toEqual(["0.jpg", "2.jpg", "4.jpg"]);
  });

  it("같은 사진을 두 번 고르지 않는다 — 네 장부터 육백 장까지", () => {
    for (let n = 4; n <= 600; n += 1) {
      const ids = pickPreviewShots(shots(n)).map((s) => s.id);
      expect(new Set(ids).size, `n=${n}`).toBe(PREVIEW_COUNT);
    }
  });

  it("고른 순서는 찍은 순서다", () => {
    const picked = pickPreviewShots(shots(40));
    expect(picked.map((s) => s.takenAt.getTime())).toEqual(
      [...picked.map((s) => s.takenAt.getTime())].sort((a, b) => a - b),
    );
  });

  it("몇 장을 달라고 하든 그만큼만 — 한 장이면 첫 장, 영이면 없다", () => {
    expect(pickPreviewShots(shots(9), 1).map((s) => s.id)).toEqual(["0.jpg"]);
    expect(pickPreviewShots(shots(9), 0)).toEqual([]);
    expect(pickPreviewShots(shots(9), 2).map((s) => s.id)).toEqual(["0.jpg", "8.jpg"]);
  });

  it("받은 목록을 건드리지 않는다", () => {
    const given = shots(2);
    const picked = pickPreviewShots(given);
    expect(picked).not.toBe(given);
    expect(given).toHaveLength(2);
  });
});

/*
  사진 하나를 펼치는 일은 메모리를 많이 쓴다(12MP 사진이 펼쳐지면 50MB 가까이). 카드 열 장이 동시에
  세 장씩 펼치면 폰이 버티지 못한다. 한 번에 하나씩, 들어온 차례대로 한다.
*/
describe("inSequence", () => {
  const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("한 번에 하나씩만 돈다", async () => {
    let running = 0;
    let most = 0;
    const job = async () => {
      running += 1;
      most = Math.max(most, running);
      await later(5);
      running -= 1;
    };
    await Promise.all([inSequence(job), inSequence(job), inSequence(job), inSequence(job)]);
    expect(most).toBe(1);
  });

  it("들어온 차례대로 한다", async () => {
    const order: number[] = [];
    await Promise.all(
      [3, 1, 2].map((n, i) =>
        inSequence(async () => {
          await later(n);
          order.push(i);
        }),
      ),
    );
    expect(order).toEqual([0, 1, 2]);
  });

  it("결과를 그대로 돌려준다", async () => {
    expect(await inSequence(async () => 42)).toBe(42);
  });

  describe("끝나지 않는 일", () => {
    afterEach(() => vi.useRealTimers());

    it("정해진 시간이 지나면 실패로 치고 다음으로 넘어간다 — 멈춘 사진 한 장이 모든 카드를 세우지 않게", async () => {
      vi.useFakeTimers();
      const stuck = inSequence(() => new Promise<void>(() => undefined), 1000);
      const next = inSequence(async () => "다음 사진", 1000);
      const stuckFailed = expect(stuck).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(1000);
      await stuckFailed;
      await expect(next).resolves.toBe("다음 사진");
    });

    it("제때 끝나는 일에는 시간을 재촉하지 않는다", async () => {
      vi.useFakeTimers();
      const quick = inSequence(async () => "곧바로", 1000);
      await expect(quick).resolves.toBe("곧바로");
      // 남아 있는 시계가 없다 — 끝난 일의 시간 제한은 거둔다.
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("앞 일이 실패해도 뒤 일은 한다 — 열지 못하는 사진 한 장이 줄을 막지 않는다", async () => {
    const failed = inSequence(async () => {
      throw new Error("열 수 없는 형식");
    });
    const next = inSequence(async () => "다음 사진");
    await expect(failed).rejects.toThrow("열 수 없는 형식");
    await expect(next).resolves.toBe("다음 사진");
  });
});
