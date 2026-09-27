"use client";

import { useSyncExternalStore } from "react";

/*
  넓은 화면인가.

  좁은 화면에서는 시트가 지도 위로 올라오고, 넓은 화면에서는 지도 옆에
  목록이 선다. 모양이 아예 달라 CSS 만으로는 가를 수 없다.

  서버에는 화면이 없으므로 좁은 쪽으로 그려 두고, 붙은 뒤에 맞춘다.
  창 크기를 바꾸면 따라 바뀐다.
*/
const QUERY = "(min-width: 768px)";

function subscribe(notify: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
