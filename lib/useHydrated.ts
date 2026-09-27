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

/*
  붙자마자 한 번 알린다.

  "달라졌으니 알아서 다시 그려 주겠지" 에 기대면 안 된다. 기대어 봤더니
  어떤 자리에서는 서버 몫의 답에 그대로 머물렀다 — 화면에는 아무 일도
  일어나지 않고, 왜 안 되는지도 보이지 않는다.

  그래서 지켜보는 척이 아니라 실제로 한 번 알린다. 이러면 다시 그리는
  일이 우연이 아니라 약속이 된다.
*/
const TELL_ONCE = (notify: () => void) => {
  const id = setTimeout(notify, 0);
  return () => clearTimeout(id);
};

const ON_SCREEN = () => true;
const ON_SERVER = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(TELL_ONCE, ON_SCREEN, ON_SERVER);
}
