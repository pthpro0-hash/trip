// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import { PREVIEW_EDGE, UnsupportedImageError, encode, encodeWithin, previewFromFile } from "./resize";

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

/*
  확인 화면의 여행 카드에 붙이는 작은 그림.

  고른 사진 그대로를 칸에 넣으면 12MP 사진 한 장이 80px 칸에 그려지는 동안에도 통째로 펼쳐져 있다.
  작은 판을 따로 구워 칸에 쓰고, 펼친 그림은 곧바로 닫는다. 아이폰 사진은 회전 정보를 따라야
  세로 사진이 눕지 않는다.
*/
describe("previewFromFile", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** 브라우저 없이 펼치고 굽는 흉내. 만든 캔버스의 크기와 닫힌 그림을 적어 둔다. */
  function fakeBrowser(size = { width: 4032, height: 3024 }) {
    const made: { width: number; height: number }[] = [];
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({ ...size, close }));
    vi.stubGlobal("createImageBitmap", createImageBitmap);
    vi.stubGlobal("document", {
      createElement: () => {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: () => undefined }),
          toBlob: (resolve: (blob: Blob | null) => void, type: string) =>
            resolve(new Blob([new Uint8Array(100)], { type })),
        };
        made.push(canvas);
        return canvas;
      },
    });
    return { made, close, createImageBitmap };
  }

  it("긴 변을 작은 판의 크기로 줄인다", async () => {
    const { made } = fakeBrowser({ width: 4032, height: 3024 });
    const blob = await previewFromFile(new Blob(["x"]), "a.jpg");
    expect(blob.type).toBe("image/webp");
    expect(made[0].width).toBe(PREVIEW_EDGE);
    expect(made[0].height).toBe(Math.round((3024 * PREVIEW_EDGE) / 4032));
  });

  it("이미 작은 사진은 키우지 않는다", async () => {
    const { made } = fakeBrowser({ width: 120, height: 90 });
    await previewFromFile(new Blob(["x"]), "small.jpg");
    expect([made[0].width, made[0].height]).toEqual([120, 90]);
  });

  it("회전 정보를 따라 펼친다 — 세로로 찍은 사진이 눕지 않게", async () => {
    const { createImageBitmap } = fakeBrowser();
    await previewFromFile(new Blob(["x"]), "a.jpg");
    expect(createImageBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: "from-image" });
  });

  it("펼친 그림은 쓰고 나서 닫는다 — 열 장을 이어 해도 메모리가 쌓이지 않게", async () => {
    const { close } = fakeBrowser();
    await previewFromFile(new Blob(["x"]), "a.jpg");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("브라우저가 못 여는 형식이면 어느 파일인지 담아 알린다", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("decode");
    });
    await expect(previewFromFile(new Blob(["x"]), "IMG_0001.heic")).rejects.toMatchObject({
      name: "UnsupportedImageError",
      fileName: "IMG_0001.heic",
    });
    await expect(previewFromFile(new Blob(["x"]), "x.heic")).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("브라우저에 그림을 펼치는 기능이 아예 없어도 같은 오류다", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(previewFromFile(new Blob(["x"]), "x.jpg")).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
