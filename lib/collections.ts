"use client";

import { useCallback, useSyncExternalStore } from "react";
import { moveItem } from "./geo";

/*
  예전에는 목록 하나가 두 가지 일을 겸했다 — "언젠가 가고 싶은 곳"이면서
  동시에 "이번에 다닐 순서"였다. 둘은 성격이 다르다. 가고 싶은 곳은 순서가
  없고 수십 곳까지 쌓이지만, 이번 여행은 순서가 전부이고 몇 곳뿐이다.
  코스에서 한 곳을 빼면 찜까지 풀려 버리던 것도 그래서였다.
*/

const LEGACY_KEY = "yeohaeng.saved.v1";
const WISHLIST_KEY = "yeohaeng.wishlist.v1";
const TRIP_KEY = "yeohaeng.trip.v1";

// 서버 렌더에서는 늘 이 배열을 돌려준다. 매번 같은 참조여야
// useSyncExternalStore가 무한 렌더로 빠지지 않는다.
const EMPTY: string[] = [];

function readList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((value): value is string => typeof value === "string");
    return ids.length > 0 ? ids : EMPTY;
  } catch {
    // 시크릿 모드나 저장소 차단 상태에서도 앱 자체는 그대로 뜬다.
    return EMPTY;
  }
}

let migrated = false;

/**
 * 예전 목록을 두 서랍에 그대로 옮긴다.
 *
 * 겸하던 목록이라 양쪽 모두에 넣어야 쓰던 사람이 아무것도 잃지 않는다.
 * 예전 키는 **지우지 않는다** — 개인화를 되돌릴 때 그 목록이 필요하다.
 */
function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  try {
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const alreadyMoved =
      window.localStorage.getItem(WISHLIST_KEY) !== null ||
      window.localStorage.getItem(TRIP_KEY) !== null;
    if (alreadyMoved) return;

    const ids = readList(LEGACY_KEY);
    if (ids.length === 0) return;

    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
    window.localStorage.setItem(TRIP_KEY, JSON.stringify(ids));
  } catch {
    // 옮기지 못해도 빈 목록으로 시작할 뿐, 앱은 돈다.
  }
}

interface ListStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => string[];
  getServerSnapshot: () => string[];
  write: (next: string[]) => void;
  read: () => string[];
}

function createListStore(storageKey: string): ListStore {
  let snapshot: string[] = EMPTY;
  let loaded = false;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const refresh = () => {
    snapshot = readList(storageKey);
    loaded = true;
  };

  // 다른 탭에서 바꾼 것도 따라간다.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== storageKey) return;
    refresh();
    notify();
  };

  return {
    subscribe(listener) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    getSnapshot() {
      if (!loaded) {
        ensureMigrated();
        refresh();
      }
      return snapshot;
    },
    getServerSnapshot: () => EMPTY,
    read() {
      return this.getSnapshot();
    },
    write(next) {
      snapshot = next.length > 0 ? next : EMPTY;
      loaded = true;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // 저장이 막혀 있어도 이번 세션 동안은 동작하게 둔다.
      }
      notify();
    },
  };
}

const wishlistStore = createListStore(WISHLIST_KEY);
const tripStore = createListStore(TRIP_KEY);

/*
  아래 셋은 React 바깥(계정 동기화)에서 목록을 읽고 쓰기 위한 통로다.

  로그인해도 화면은 계속 이 기기의 목록을 본다. 서버를 직접 읽게 하면
  목록마다 로딩이 생기고 오프라인에서 아무것도 못 하게 된다. 대신
  로그인할 때 양쪽을 합치고, 바뀔 때마다 서버로 밀어 올린다.
*/
export function readCollections() {
  return { wishlist: wishlistStore.read(), trip: tripStore.read() };
}

export function writeCollections(next: { wishlist?: string[]; trip?: string[] }) {
  if (next.wishlist) wishlistStore.write(next.wishlist);
  if (next.trip) tripStore.write(next.trip);
}

export function subscribeToCollections(listener: () => void) {
  const off = [wishlistStore.subscribe(listener), tripStore.subscribe(listener)];
  return () => off.forEach((unsubscribe) => unsubscribe());
}

function useList(store: ListStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

/** 언젠가 가고 싶은 곳. 순서는 없고, 얼마든지 쌓여도 된다. */
export function useWishlist() {
  const ids = useList(wishlistStore);

  const toggle = useCallback((id: string) => {
    const current = wishlistStore.read();
    wishlistStore.write(
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );
  }, []);

  const remove = useCallback((id: string) => {
    wishlistStore.write(wishlistStore.read().filter((v) => v !== id));
  }, []);

  const clear = useCallback(() => wishlistStore.write(EMPTY), []);

  return { ids, toggle, remove, clear };
}

/** 이번에 다닐 순서. 순서가 전부다. */
export function useTripPlan() {
  const ids = useList(tripStore);

  const add = useCallback((id: string) => {
    const current = tripStore.read();
    if (current.includes(id)) return;
    tripStore.write([...current, id]);
  }, []);

  const remove = useCallback((id: string) => {
    tripStore.write(tripStore.read().filter((v) => v !== id));
  }, []);

  const move = useCallback((from: number, to: number) => {
    tripStore.write(moveItem(tripStore.read(), from, to));
  }, []);

  const reorder = useCallback((next: string[]) => tripStore.write(next), []);

  const clear = useCallback(() => tripStore.write(EMPTY), []);

  return { ids, add, remove, move, reorder, clear };
}
