"use client";

import { useCallback, useSyncExternalStore } from "react";
import { moveItem } from "./geo";

const STORAGE_KEY = "yeohaeng.saved.v1";

// 찜 목록은 곧 코스 순서다. 목록 하나로 "저장한 곳"과 "다닐 순서"를 같이
// 나타내기 때문에, 담은 순서를 그대로 유지하고 재정렬도 여기에 쓴다.
let snapshot: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

// 서버 렌더에서는 늘 빈 목록이다. 매번 같은 배열을 돌려줘야
// useSyncExternalStore가 무한 렌더로 빠지지 않는다.
const EMPTY: string[] = [];

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    // 시크릿 모드나 저장소 차단 상태에서도 앱 자체는 그대로 동작해야 한다.
    return EMPTY;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent) {
  // 다른 탭에서 바꾼 것도 따라간다.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  snapshot = read();
  loaded = true;
  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string[] {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY;
}

function write(next: string[]) {
  snapshot = next;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 저장이 막혀 있어도 이번 세션 동안은 동작하게 둔다.
  }
  notify();
}

export function useSavedSpots() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    write(current.includes(id) ? current.filter((v) => v !== id) : [...current, id]);
  }, []);

  const remove = useCallback((id: string) => {
    write(getSnapshot().filter((v) => v !== id));
  }, []);

  const move = useCallback((from: number, to: number) => {
    write(moveItem(getSnapshot(), from, to));
  }, []);

  const reorder = useCallback((next: string[]) => {
    write(next);
  }, []);

  const clear = useCallback(() => {
    write(EMPTY);
  }, []);

  return { ids, toggle, remove, move, reorder, clear };
}
