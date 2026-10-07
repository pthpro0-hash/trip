"use client";

import { useSyncExternalStore } from "react";

/*
  받는 쪽: "누가 보시나요?"

  책장 하나를 부모님 두 분이 같이 쓴다. 처음 한 번 "엄마"인지 "아빠"인지 고르면 이 폰에 기억해
  두고, 답장에 그 이름이 붙는다. 기억은 책장마다 따로다(링크 글자의 앞부분으로 구분한다).
  저장소가 막힌 브라우저에서는 기억하지 못한다 — 그때는 답장할 때마다 다시 고른다.
*/

const EVENT = "mailbox-who-change";
const keyOf = (token: string) => `mailbox-who:${token.slice(0, 16)}`;

export function readWho(token: string): string | null {
  try {
    return window.localStorage.getItem(keyOf(token));
  } catch {
    return null;
  }
}

export function keepWho(token: string, who: string): void {
  try {
    window.localStorage.setItem(keyOf(token), who);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};

/** 이 폰에서 이 책장을 보는 사람. 모르면 null. 서버가 그린 첫 그림에서는 늘 null 이다. */
export function useWho(token: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readWho(token),
    () => null,
  );
}
