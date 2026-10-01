"use client";

import { useSyncExternalStore } from "react";
import { canDo, isFamilyRole, type FamilyAction, type FamilyRole } from "./family";

/*
  지금 누구의 여행을 보고 있는가.

  가족이 열어 준 여행을 보는 동안에는 화면이 그 사람의 자료를 읽어 와야 한다. 그
  "누구"를 주소에 싣지 않고 이 탭의 sessionStorage 에 둔다 — 위 띠의 갈래, 카드의 링크,
  되돌아가기까지 모든 링크에 덧붙이는 대신, 자료를 읽는 곳이 여기를 한 번 보면 되고
  탭을 닫으면 저절로 내 여행으로 돌아온다.

  바꿀 때는 화면 전체를 새로 불러온다(logout 과 같은 까닭: 앞 사람의 자료가 화면에
  조금도 남지 않게). 그래서 이 값은 "바뀌는 동안"이 없고, 읽는 쪽은 처음에 한 번 보면 된다.
*/

export interface FamilyView {
  /** 보고 있는 여행의 주인. */
  ownerId: string;
  /** 위에 띄울 이름(이메일). */
  label: string;
  /** 그 주인이 나에게 준 권한. */
  role: FamilyRole;
}

const KEY = "family-view";
const EVENT = "family-view-change";

let raw: string | null | undefined;
let cached: FamilyView | null = null;

/** 저장된 값을 읽어 모양을 확인한다. 같은 글이면 같은 객체를 돌려준다. */
export function readFamilyView(): FamilyView | null {
  let text: string | null = null;
  try {
    text = window.sessionStorage.getItem(KEY);
  } catch {
    // 저장소가 막힌 브라우저에서는 내 여행으로 본다.
  }
  if (text === raw) return cached;
  raw = text;
  cached = null;
  if (text) {
    try {
      const value = JSON.parse(text) as Partial<FamilyView>;
      if (typeof value.ownerId === "string" && typeof value.label === "string" && isFamilyRole(value.role)) {
        cached = { ownerId: value.ownerId, label: value.label, role: value.role };
      }
    } catch {
      // 깨진 값은 없는 것으로 본다.
    }
  }
  return cached;
}

export function startFamilyView(view: FamilyView): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function stopFamilyView(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeFamilyView(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** 지금 보는 가족 여행. 내 여행이면 null. 서버에서 그릴 때는 늘 null 이다. */
export function useFamilyView(): FamilyView | null {
  return useSyncExternalStore(subscribeFamilyView, readFamilyView, () => null);
}

/** 자료를 읽고 쓸 주인의 id. 가족 여행을 보는 중이면 그 주인, 아니면 나. */
export const ownerOf = (view: FamilyView | null, myId: string): string => view?.ownerId ?? myId;

/*
  가족 여행에서 무엇을 할 수 있나 — 그 주인이 나에게 준 권한대로.

  화면은 이것으로 단추를 내거나 숨긴다. 막는 것은 DB 다(supabase/family.sql). 권한이
  바뀌어도 화면이 한동안 옛 값을 들고 있을 수 있는데, 그때 누른 것은 DB 가 거절하고
  화면은 "하지 못했어요"로 알린다(FamilyBanner 가 불러올 때마다 권한을 새로 맞춘다).
*/
export function canIn(view: FamilyView | null, action: FamilyAction): boolean {
  return view === null ? true : canDo(view.role, action);
}
