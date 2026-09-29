// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encode, encodeWithin } from "./resize";

/** 달라는 형식 대신 `gives` 가 정한 형식을 돌려주는 캔버스. 받은 요청을 적어 둔다. */
function fakeCanvas(gives: (type: string) => string | null, sizeAt: (quality: number) => number = () => 1) {
  const asked: string[] = [];
  const qualities: number[] = [];
  const canvas = {
    toBlob(resolve: (blob: Blob | null) => void, type: string, quality: number) {
      asked.push(type);
      qualities.push(quality);
      const actual = gives(type);
      resolve(actual ? new Blob([new Uint8Array(sizeAt(quality))], { type: actual }) : null);
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, asked, qualities };
}

describe("encode", () => {
  it("WebP 를 구울 줄 알면 WebP 를 그대로 쓴다", async () => {
    const { canvas, asked } = fakeCanvas((type) => type);
    const blob = await encode(canvas, 0.8);
    expect(blob?.type).toBe("image/webp");
    expect(asked).toEqual(["image/webp"]);
  });

  it("WebP 대신 PNG 를 주면(아이폰 사파리) JPEG 로 다시 굽는다", async () => {
    const { canvas, asked } = fakeCanvas((type) => (type === "image/webp" ? "image/png" : type));
    const blob = await encode(canvas, 0.8);
    expect(blob?.type).toBe("image/jpeg");
    expect(asked).toEqual(["image/webp", "image/jpeg"]);
  });

  it("아예 못 구우면 null", async () => {
    const { canvas } = fakeCanvas(() => null);
    expect(await encode(canvas, 0.8)).toBeNull();
  });
});

/*
  품질값만으로는 크기가 정해지지 않는다 — 브라우저마다 두 배 넘게 다르다.
  상한을 넘으면 품질을 내려 다시 굽는다.
*/
describe("encodeWithin", () => {
  // 품질 1 당 1000바이트인 셈 친다.
  const sizeAt = (quality: number) => Math.round(quality * 1000);

  it("상한 안이면 한 번에 끝낸다", async () => {
    const { canvas, qualities } = fakeCanvas((type) => type, sizeAt);
    const blob = await encodeWithin(canvas, 0.82, 1000);
    expect(blob?.size).toBe(820);
    expect(qualities).toEqual([0.82]);
  });

  it("상한을 넘으면 품질을 내려 들어올 때까지", async () => {
    const { canvas, qualities } = fakeCanvas((type) => type, sizeAt);
    const blob = await encodeWithin(canvas, 0.82, 700);
    expect(blob!.size).toBeLessThanOrEqual(700);
    expect(qualities.map((q) => q.toFixed(2))).toEqual(["0.82", "0.74", "0.66"]);
  });

  it("바닥 품질까지 내려도 넘으면 거기서 멈춘다", async () => {
    const { canvas, qualities } = fakeCanvas((type) => type, sizeAt);
    const blob = await encodeWithin(canvas, 0.82, 10);
    expect(Math.min(...qualities)).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(blob).not.toBeNull();
  });
});
