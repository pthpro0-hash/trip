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
  목록에 쓸 작은 판.

  목록의 대표 사진은 화면에서 길어야 400px 남짓이고, 첫 화면의 것은
  48px 다. 거기에 2048px 짜리 400KB 를 내려받는 것은 스무 배쯤 낭비다.
  사람이 늘수록 이 낭비가 곧 청구서가 된다.

  480px 로 두는 것은 고해상도 화면에서 2배로 그려도 흐리지 않게 하기
  위해서다. 품질을 조금 낮춰도 이 크기에서는 티가 나지 않는다.
*/
export const THUMB_EDGE = 480;
export const THUMB_QUALITY = 0.75;

export interface Shrunk {
  /** 보관할 판. 긴 변 2048px. */
  full: Blob;
  /** 목록에 쓸 판. 긴 변 480px. */
  thumb: Blob;
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
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new UnsupportedImageError(name);
  }
  try {
    return await bake(bitmap, THUMB_EDGE, THUMB_QUALITY, name);
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
    /*
      캔버스를 거치면 EXIF 가 모두 사라진다. 촬영 시각과 위치는 이미 읽어
      기록에 넣었으니 잃는 것이 없고, 오히려 사진 파일 자체에서 위치가
      빠져 나중에 공유할 때 안전하다.
    */
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
