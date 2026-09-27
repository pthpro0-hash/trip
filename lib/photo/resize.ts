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
): Promise<Blob> {
  const { width, height } = targetSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new UnsupportedImageError(fileName);
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new UnsupportedImageError(fileName);
  return blob;
}

/**
 * 이미 보관된 그림에서 작은 판만 만든다.
 *
 * 썸네일을 붙이기 전에 올라간 사진들을 뒤늦게 챙기는 데 쓴다. 원본은
 * 이미 2048px 로 줄여 둔 것이라 다시 줄여도 잃을 것이 없다.
 */
export async function thumbFromBlob(blob: Blob, name = "photo"): Promise<Blob> {
  return bakeFromBlob(blob, THUMB_EDGE, THUMB_QUALITY, name);
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
): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new UnsupportedImageError(name);
  }
  try {
    return await bake(bitmap, maxEdge, quality, name);
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
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC 처럼 브라우저가 풀지 못하는 형식이 여기로 온다.
    throw new UnsupportedImageError(file.name);
  }

  try {
    const full = await bake(bitmap, MAX_EDGE, WEBP_QUALITY, file.name);
    const thumb = await bake(bitmap, THUMB_EDGE, THUMB_QUALITY, file.name);
    const marker = await bake(bitmap, MARKER_EDGE, MARKER_QUALITY, file.name);
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
