/*
  한 장으로 보기의 카드 모양.

  같은 한 해라도 보여 줄 곳에 따라 어울리는 모양이 다르다. 어디를
  다녔는지 자랑하려면 지도, 무엇을 봤는지 보여 주려면 사진, 벽에 걸어
  둘 그림이면 선.

  고른 모양은 이 브라우저에 남긴다 — 다음에 와서 또 고르게 하지 않는다.
  계정에 남길 만큼 무거운 선택은 아니다.

  화면은 useSyncExternalStore 로 읽는다. 서버는 브라우저 저장소를 모르니
  늘 지도로 그리고, 브라우저가 이어받은 뒤에 고른 모양으로 바꾼다 —
  처음부터 고른 모양으로 그리면 서버 그림과 어긋난다.
*/

export type CardStyle = "map" | "collage" | "line";

export const CARD_STYLES: { id: CardStyle; label: string; hint: string }[] = [
  { id: "map", label: "지도", hint: "다닌 곳과 계절을 지도 위에" },
  { id: "collage", label: "사진 콜라주", hint: "그해의 사진을 한 장에" },
  { id: "line", label: "선 그림", hint: "걸어 둘 만한 한 장의 선" },
];

const KEY = "sketch:cardStyle";

const isStyle = (value: unknown): value is CardStyle => CARD_STYLES.some((style) => style.id === value);

/** 저장소가 막혀 있을 때(사생활 보호 창 등) 이번 방문 동안만 기억한다. */
let remembered: CardStyle | null = null;
const listeners = new Set<() => void>();

export function readCardStyle(): CardStyle {
  try {
    const kept = window.localStorage.getItem(KEY);
    return isStyle(kept) ? kept : "map";
  } catch {
    return remembered ?? "map";
  }
}

export function keepCardStyle(style: CardStyle): void {
  remembered = style;
  try {
    window.localStorage.setItem(KEY, style);
  } catch {
    // 남기지 못해도 이번 방문 동안은 고른 대로 보인다.
  }
  for (const listener of listeners) listener();
}

/** 고른 모양이 바뀌면 알린다. 다른 탭에서 바꾼 것도. */
export function subscribeCardStyle(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** 저장할 그림 이름에 붙일 말. 지도는 처음부터 있던 모양이라 붙이지 않는다. */
export function styleSuffix(style: CardStyle): string {
  if (style === "collage") return "-콜라주";
  if (style === "line") return "-선그림";
  return "";
}
