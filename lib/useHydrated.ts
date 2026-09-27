"use client";

import { useSyncExternalStore } from "react";

/*
  화면에 붙었는지.

  저장소는 브라우저에만 있다. 서버에서 그린 화면에는 "돌아온 사람"이라는
  사실이 없으므로, 붙기 전에 그것을 아는 척하면 안 된다.

  React 는 서버가 그린 것과 처음 그린 것이 다르면 그냥 둔다 — 고쳐 주지
  않는다. 그래서 목록을 펴 놓고 테를 두른 채로 처음을 그리면, 서버가
  그린 "지도, 테 없음" 그대로 굳어 버린다. 눈에는 아무 일도 일어나지
  않은 것처럼 보이고, 무엇이 잘못됐는지도 알 수 없다.

  그래서 처음 한 번은 서버와 똑같이 그리고, 붙은 다음에 고쳐 그린다.
  이 고리를 쓰는 이유가 그것이다 — 서버 몫의 답을 따로 받는 유일한
  고리라, React 가 붙은 뒤에 다시 그려 준다.
*/

/** 지켜볼 것이 없다. 한 번 붙으면 그만이다. */
const NEVER = () => () => undefined;
const ON_SCREEN = () => true;
const ON_SERVER = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(NEVER, ON_SCREEN, ON_SERVER);
}
