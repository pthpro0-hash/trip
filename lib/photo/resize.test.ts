// @vitest-environment node
import { describe, it, expect } from "vitest";
import { encode } from "./resize";

/** 달라는 형식 대신 `gives` 가 정한 형식을 돌려주는 캔버스. 받은 요청을 적어 둔다. */
function fakeCanvas(gives: (type: string) => string | null) {
  const asked: string[] = [];
  const canvas = {
    toBlob(resolve: (blob: Blob | null) => void, type: string) {
      asked.push(type);
      const actual = gives(type);
      resolve(actual ? new Blob(["x"], { type: actual }) : null);
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, asked };
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
