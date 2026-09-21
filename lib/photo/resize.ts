/*
  올리기 전에 사진을 줄인다.

  아이폰 사진 한 장이 3MB 안팎이다. 그대로 쌓으면 1,000명이 100장씩만
  올려도 300GB 가 된다. 긴 변 2048px WebP 로 줄이면 300KB 남짓이라
  같은 조건에서 30GB 다. 화면에서 보기에는 차이가 없다.

  원본은 보관하지 않는다. 원본은 찍은 사람의 기기에 있다.
*/

export const MAX_EDGE = 2048;
export const WEBP_QUALITY = 0.82;

/** 브라우저가 그림으로 풀어내지 못하는 형식. 아이폰 기본 포맷이 여기 걸린다. */
export class UnsupportedImageError extends Error {
  constructor(readonly fileName: string) {
    super(`이 형식은 아직 읽지 못합니다: ${fileName}`);
    this.name = "UnsupportedImageError";
  }
}

function targetSize(width: number, height: number) {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const ratio = MAX_EDGE / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * 사진 한 장을 WebP 로 줄인다.
 *
 * createImageBitmap 은 EXIF 의 회전 정보를 반영해 준다 — 세로로 찍은
 * 사진이 눕지 않는다.
 */
export async function shrinkToWebp(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC 처럼 브라우저가 풀지 못하는 형식이 여기로 온다.
    throw new UnsupportedImageError(file.name);
  }

  const { width, height } = targetSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new UnsupportedImageError(file.name);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (!blob) throw new UnsupportedImageError(file.name);

  /*
    캔버스를 거치면 EXIF 가 모두 사라진다. 촬영 시각과 위치는 이미 읽어
    기록에 넣었으니 잃는 것이 없고, 오히려 사진 파일 자체에서 위치가
    빠져 나중에 공유할 때 안전하다.
  */
  return blob;
}
