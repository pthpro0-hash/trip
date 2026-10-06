/*
  올리기 전에 사진을 줄인다.

  아이폰 사진 한 장이 3MB 안팎이다. 그대로 쌓으면 1,000명이 100장씩만
  올려도 300GB 가 된다. 긴 변 2048px WebP 로 줄이면 300KB 남짓이라
  같은 조건에서 30GB 다. 화면에서 보기에는 차이가 없다.

  원본은 보관하지 않는다. 원본은 찍은 사람의 기기에 있다.
*/

export const MAX_EDGE = 2048;
export const WEBP_QUALITY = 0.82;

/*
  한 판의 크기 상한.

  품질값만으로는 크기가 정해지지 않는다. 크롬 WebP 는 0.82 에 보관본
  410KB 남짓인데, 같은 사진을 다른 브라우저가 JPEG 로 구우면 두 배가
  넘게 나왔다(사진 643장을 다시 줄였더니 한 장에 세 판 합쳐 1.3MB).
  그래서 상한을 넘으면 품질을 한 단계씩 내려 다시 굽는다. 크롬에서는
  거의 모두 첫 번에 들어온다.
*/
export const FULL_BUDGET = 600 * 1024;
export const THUMB_BUDGET = 150 * 1024;
/** 이보다 품질을 내리면 눈에 띈다. 여기서도 넘으면 그대로 쓴다. */
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.08;

/*
  목록에 쓸 판.

  2048px 짜리 400KB 를 48px 자리에 내려받는 것은 스무 배쯤 낭비다.
  사람이 늘수록 이 낭비가 곧 청구서가 된다. 그래서 작은 판을 따로 둔다.

  처음엔 480px 였는데 목록의 대표 사진이 흐렸다. 그 자리는 카드 폭을
  꽉 채우는 16:10 배너라 화면에서 592pt 다 — 3배 화면인 아이폰에서는
  885px, 레티나 맥북에서는 1184px 가 필요하다. 480px 를 두 배로 늘려
  쓰고 있었던 셈이다.

  960px 면 아이폰은 넉넉하고 레티나 맥북도 거의 맞는다. 파일은 넓이에
  비례하므로 네 배가 되지만(19KB → 87KB), 저장 100GB 에서 507장이
  44MB 다. 화면이 또렷한 편이 낫다.
*/
export const THUMB_EDGE = 960;
export const THUMB_QUALITY = 0.8;

/*
  지도 핀에 쓸 판.

  핀은 화면에서 48pt 남짓이다. 3배 화면에서 144px 이면 넉넉하다. 여기에
  960px 판을 쓰면 핀 쉰 개에 4MB 넘게 내려받는다 — 지도를 한 번 열 때마다.
  160px 면 한 장에 5KB 안팎이라 쉰 개가 0.3MB 다.
*/
export const MARKER_EDGE = 160;
export const MARKER_QUALITY = 0.72;

export interface Shrunk {
  /** 보관할 판. 긴 변 2048px. */
  full: Blob;
  /** 목록에 쓸 판. 긴 변 960px. */
  thumb: Blob;
  /** 지도 핀에 쓸 판. 긴 변 160px. */
  marker: Blob;
}

/** 브라우저가 그림으로 풀어내지 못하는 형식. 아이폰 기본 포맷이 여기 걸린다. */
export class UnsupportedImageError extends Error {
  constructor(readonly fileName: string) {
    super(`이 형식은 아직 읽지 못합니다: ${fileName}`);
    this.name = "UnsupportedImageError";
  }
}

export function targetSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    // 1px 미만으로 줄어드는 일이 없게 한다. 캔버스는 0 을 받으면 던진다.
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** 펼쳐 둔 그림을 원하는 크기의 WebP 로 굽는다. */
async function bake(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  fileName: string,
  budget = Infinity,
): Promise<Blob> {
  const { width, height } = targetSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new UnsupportedImageError(fileName);
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await encodeWithin(canvas, quality, budget);
  if (!blob) throw new UnsupportedImageError(fileName);
  return blob;
}

/** 상한 안에 들 때까지 품질을 내려 가며 굽는다. */
export async function encodeWithin(
  canvas: HTMLCanvasElement,
  quality: number,
  budget: number,
): Promise<Blob | null> {
  let blob = await encode(canvas, quality);
  for (let q = quality - QUALITY_STEP; blob && blob.size > budget && q >= MIN_QUALITY - 1e-9; q -= QUALITY_STEP) {
    blob = await encode(canvas, q);
  }
  return blob;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/*
  WebP 로 굽고, 못 구우면 JPEG 로.

  아이폰 사파리는 WebP 로 구워 달라는 말을 알아듣지 못하고 아무 말 없이
  PNG 를 돌려준다. PNG 는 품질값을 모르는 무손실이라 2048px 사진 한 장이
  4MB 를 넘는다 — WebP 의 열 배다. 사진 828장이 4GB 를 차지한 까닭이
  이것이었다. 돌아온 것이 WebP 가 아니면 JPEG 로 다시 굽는다. JPEG 는
  모든 브라우저가 품질값대로 굽고, WebP 보다 조금 클 뿐이다.
*/
export async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (!webp || webp.type === "image/webp") return webp;
  return toBlob(canvas, "image/jpeg", quality);
}

/**
 * 이미 보관된 그림에서 작은 판만 만든다.
 *
 * 썸네일을 붙이기 전에 올라간 사진들을 뒤늦게 챙기는 데 쓴다. 원본은
 * 이미 2048px 로 줄여 둔 것이라 다시 줄여도 잃을 것이 없다.
 */
export async function thumbFromBlob(blob: Blob, name = "photo"): Promise<Blob> {
  return bakeFromBlob(blob, THUMB_EDGE, THUMB_QUALITY, name, THUMB_BUDGET);
}

/** 엽서(책) 사진의 보통 크기(긴 변)와 그 크기의 용량 상한. 선명(960px)은 목록 판을 그대로 쓴다. */
export const POSTCARD_EDGE = 640;
export const POSTCARD_QUALITY = 0.78;
export const POSTCARD_BUDGET = 110 * 1024;

/**
 * 엽서에 실을 사진을 보통 크기(640px)로 줄인다. 목록 판(960px)에서 만든다 — 원본(2048px)을 다시 받을 까닭이
 * 없다. 선명(960px)을 고른 책장은 목록 판을 그대로 쓰므로 이 함수를 부르지 않는다.
 */
export async function postcardFromBlob(blob: Blob, name = "photo"): Promise<Blob> {
  return bakeFromBlob(blob, POSTCARD_EDGE, POSTCARD_QUALITY, name, POSTCARD_BUDGET);
}

/**
 * 이미 보관된 그림에서 지도 핀 판을 만든다.
 *
 * 목록 판(960px)에서 만들면 된다. 원본(2048px, 400KB)을 다시 받을 까닭이
 * 없다 — 160px 로 줄이는 데는 960px 로도 차고 넘치고, 내려받는 양이
 * 다섯 배 적다.
 */
export async function markerFromBlob(blob: Blob, name = "photo"): Promise<Blob> {
  return bakeFromBlob(blob, MARKER_EDGE, MARKER_QUALITY, name);
}

async function bakeFromBlob(
  blob: Blob,
  maxEdge: number,
  quality: number,
  name: string,
  budget = Infinity,
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new UnsupportedImageError(name);
  }
  try {
    return await bake(bitmap, maxEdge, quality, name, budget);
  } finally {
    bitmap.close();
  }
}

/**
 * 사진 한 장을 보관용과 목록용, 두 판으로 줄인다.
 *
 * 펼치는 일을 한 번만 한다. 두 번 부르면 아이폰 사진 하나를 두 번
 * 펼치는 셈인데, 펼친 그림이 50MB 가까이 잡는 쪽이 비싼 일이다.
 *
 * createImageBitmap 은 EXIF 의 회전 정보를 반영해 준다 — 세로로 찍은
 * 사진이 눕지 않는다.
 */
export async function shrinkToWebp(file: File): Promise<Shrunk> {
  return shrink(file, file.name);
}

/**
 * 이미 보관된 한 장을 세 판으로 다시 굽는다.
 *
 * 아이폰 사파리에서 올라가 PNG 로 굳은 사진을 가볍게 되돌리는 데 쓴다.
 * 크기는 이미 2048px 이라 줄지 않고, 무손실 PNG 를 손실 압축으로 바꾸는
 * 것뿐이라 눈에 띄는 차이가 없다.
 */
export async function reshrink(blob: Blob, name = "photo"): Promise<Shrunk> {
  return shrink(blob, name);
}

async function shrink(source: Blob, name: string): Promise<Shrunk> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    // HEIC 처럼 브라우저가 풀지 못하는 형식이 여기로 온다.
    throw new UnsupportedImageError(name);
  }

  try {
    const full = await bake(bitmap, MAX_EDGE, WEBP_QUALITY, name, FULL_BUDGET);
    const thumb = await bake(bitmap, THUMB_EDGE, THUMB_QUALITY, name, THUMB_BUDGET);
    const marker = await bake(bitmap, MARKER_EDGE, MARKER_QUALITY, name);
    /*
      캔버스를 거치면 EXIF 가 모두 사라진다. 촬영 시각과 위치는 이미 읽어
      기록에 넣었으니 잃는 것이 없고, 오히려 사진 파일 자체에서 위치가
      빠져 나중에 공유할 때 안전하다.
    */
    return { full, thumb, marker };
  } finally {
    bitmap.close();
  }
}
