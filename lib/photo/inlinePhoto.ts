/*
  사진을 SVG 안에 심을 수 있는 글자로 바꾼다.

  스케치는 통째로 SVG 라 그림으로 저장할 수 있다. 그런데 바깥 주소를
  가리키는 <image> 는 저장할 때 따라오지 않는다 — 브라우저가 SVG 를
  그림으로 읽는 순간 바깥 요청을 막고, 억지로 그려 넣어도 캔버스가
  오염돼 저장 자체가 실패한다.

  그래서 미리 받아 글자로 바꿔 심는다. 지도 위에서 80px 남짓으로 보일
  것이라 그 두 배면 충분하다 — 한 장에 8KB 안팎이라 여덟 장을 심어도
  카드가 무거워지지 않는다.
*/

/** 심을 때의 한 변. 고해상도 화면에서 두 배로 그려도 흐리지 않을 만큼. */
export const INLINE_EDGE = 160;
export const INLINE_QUALITY = 0.72;

export interface InlineOptions {
  /** 정사각이면 한 변, 아니면 긴 변. 원본보다 키우지는 않는다. */
  edge?: number;
  /**
   * 가운데를 잘라 정사각으로 만든다. 지도 위 표식은 정사각이라야 자리를
   * 예측할 수 있고, 찌그러뜨리는 것보다 잘라내는 편이 덜 흉하다.
   *
   * 콜라주처럼 칸 모양이 제각각이면 자르지 않고 넘긴다 — 칸에 맞춰
   * 자르는 것은 그리는 쪽이 한다. 여기서 먼저 정사각으로 자르면 가로로
   * 긴 칸에서 위아래가 두 번 잘린다.
   */
  square?: boolean;
  quality?: number;
}

/** 주소 하나를 받아 그림 글자로. */
export async function inlinePhoto(url: string, options: InlineOptions = {}): Promise<string | null> {
  const { edge = INLINE_EDGE, square = true, quality = INLINE_QUALITY } = options;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const bitmap = await createImageBitmap(await response.blob());
    try {
      // 정사각이면 짧은 변에 맞춰 가운데를, 아니면 통째로.
      const side = Math.min(bitmap.width, bitmap.height);
      const source = square
        ? { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, width: side, height: side }
        : { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
      const shrink = Math.min(1, edge / Math.max(source.width, source.height));

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * shrink));
      canvas.height = Math.max(1, Math.round(source.height * shrink));

      const context = canvas.getContext("2d");
      if (!context) return null;

      context.drawImage(
        bitmap,
        source.x,
        source.y,
        source.width,
        source.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // 아이폰 사파리는 WebP 대신 무거운 PNG 를 준다 — 그때는 JPEG 로(lib/photo/resize.ts 의 encode).
      const webp = canvas.toDataURL("image/webp", quality);
      return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
    } finally {
      bitmap.close();
    }
  } catch {
    // 한 장을 못 심어도 스케치는 그려져야 한다. 그 자리는 점으로 남는다.
    return null;
  }
}

/**
 * 여러 장을 한꺼번에. 실패한 것은 빠진 채로 돌아온다.
 *
 * 한 장씩 차례로 한다. 여덟 장이라 빠를 이유가 없고, 펼친 그림이 한 번에
 * 하나만 살아 있는 편이 안전하다.
 */
export async function inlinePhotos(
  urls: Map<string, string>,
  options?: InlineOptions,
): Promise<Map<string, string>> {
  const inlined = new Map<string, string>();
  for (const [key, url] of urls) {
    const data = await inlinePhoto(url, options);
    if (data) inlined.set(key, data);
  }
  return inlined;
}
