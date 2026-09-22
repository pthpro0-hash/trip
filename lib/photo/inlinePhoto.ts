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

/**
 * 주소 하나를 받아 작은 정사각 그림 글자로.
 *
 * 가운데를 잘라 정사각으로 만든다. 지도 위 표식은 정사각이라야 자리를
 * 예측할 수 있고, 찌그러뜨리는 것보다 잘라내는 편이 덜 흉하다.
 */
export async function inlinePhoto(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement("canvas");
      canvas.width = INLINE_EDGE;
      canvas.height = INLINE_EDGE;

      const context = canvas.getContext("2d");
      if (!context) return null;

      // 짧은 변에 맞춰 가운데를 잘라낸다.
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        INLINE_EDGE,
        INLINE_EDGE,
      );

      return canvas.toDataURL("image/webp", INLINE_QUALITY);
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
): Promise<Map<string, string>> {
  const inlined = new Map<string, string>();
  for (const [key, url] of urls) {
    const data = await inlinePhoto(url);
    if (data) inlined.set(key, data);
  }
  return inlined;
}
