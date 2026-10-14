import type { SupabaseClient } from "@supabase/supabase-js";
import { isInKorea } from "@/lib/weatherGrid";
import { saveVisitName } from "./tripDetail";

/*
  해외에서 다녀온 곳의 이름을 세부 지역명으로 새로 붙인다.

  해외 장소 이름은 처음에 거칠게("영국 런던") 붙었거나 아예 못 붙었다("알 수 없는 곳"). 새 조회는 구역과 명소·길 이름까지("영국 런던
  Knightsbridge Royal Albert Hall") 준다. 내 여행을 열 때 앱이 저절로 새로 붙인다(autoRefreshAbroadNames) — 예전에는 내 정보의
  '해외 장소 이름 새로 붙이기' 단추를 눌러야 했다(2026-10-14 뺐다).

  사람이 붙인 이름은 지키는 것이 원칙이다. 바꾸는 것은 ① 못 붙은 이름('알 수 없는 곳'·'해외') ② 새 이름이 옛 이름으로 시작하는 것
  (옛 이름이 새 이름의 거친 판일 때)뿐이다 — "로열 앨버트 홀"이라고 직접 적은 이름은 새 이름이 그것으로 시작하지 않으니 그대로 둔다.
*/

export interface OverseasVisit {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
}

const PAGE = 1000;
const BATCH = 10;

/** 옛 이름을 새 이름으로 바꿀 만한가. */
export function shouldRename(oldName: string, newName: string): boolean {
  if (!newName || newName === "해외" || newName === oldName) return false;
  return oldName === "알 수 없는 곳" || oldName === "해외" || newName.startsWith(`${oldName} `);
}

/** 내 방문 중 한국 밖의 곳. 못 읽으면 빈 목록. */
export async function fetchOverseasVisits(supabase: SupabaseClient, userId: string): Promise<OverseasVisit[]> {
  try {
    const found: OverseasVisit[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("visits")
        .select("id,place_name,lat,lng")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data) return [];
      for (const row of data as { id: string; place_name: string; lat: number; lng: number }[]) {
        if (!isInKorea(row.lat, row.lng)) found.push({ id: row.id, placeName: row.place_name, lat: row.lat, lng: row.lng });
      }
      if (data.length < PAGE) break;
    }
    return found;
  } catch {
    return [];
  }
}

export interface RefreshOutcome {
  checked: number;
  renamed: number;
  /** 조회하지 못한 곳(통신 오류 등). */
  failed: number;
}

/**
 * 해외 곳들의 이름을 새로 붙인다. 열 곳씩 묻고, 한 묶음이 끝날 때마다 알린다.
 * onAsked 는 조회에 성공한 묶음의 방문 id 들을 받는다(조회하지 못한 곳은 넘기지 않는다 — 다음에 다시 묻게).
 */
export async function refreshAbroadNames(
  supabase: SupabaseClient,
  userId: string,
  visits: OverseasVisit[],
  onProgress?: (done: number, total: number) => void,
  onAsked?: (ids: string[]) => void,
): Promise<RefreshOutcome> {
  const outcome: RefreshOutcome = { checked: 0, renamed: 0, failed: 0 };
  for (let start = 0; start < visits.length; start += BATCH) {
    const slice = visits.slice(start, start + BATCH);
    try {
      const response = await fetch("/api/place-abroad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: slice.map((visit) => ({ lat: visit.lat, lng: visit.lng })) }),
      });
      if (!response.ok) throw new Error("lookup failed");
      const body: { places: { title: string }[] } = await response.json();
      for (const [index, visit] of slice.entries()) {
        const title = body.places[index]?.title ?? "";
        if (shouldRename(visit.placeName, title) && (await saveVisitName(supabase, userId, visit.id, title))) outcome.renamed += 1;
      }
      onAsked?.(slice.map((visit) => visit.id));
    } catch {
      outcome.failed += slice.length;
    }
    outcome.checked += slice.length;
    onProgress?.(outcome.checked, visits.length);
  }
  return outcome;
}

/** 저절로 붙일 때 한 번에 물을 곳의 수 상한. 서버가 1분에 40곳까지 바깥에 묻는다. */
export const AUTO_MAX = 20;
/** 이 기기에서 물어본 곳을 기억해 둘 수의 상한. */
const CHECKED_MAX = 2000;

/** 아직 세부 지역명이 아닌 이름 — 못 붙었거나("알 수 없는 곳"·"해외"), 나라·도시까지만 있는 것("영국 런던"). */
export function isRough(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === "알 수 없는 곳" || trimmed === "해외" || trimmed.split(/\s+/).length <= 2;
}

/** 물어본 곳을 적어 두는 곳. 기본은 이 브라우저(localStorage) — 막혀 있으면 기억만 못 한다. */
export interface AskedStore {
  read(): string[];
  write(ids: string[]): void;
}

export function localAsked(userId: string): AskedStore {
  const key = `abroadNames:asked:${userId}`;
  return {
    read: () => {
      try {
        const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
      } catch {
        return [];
      }
    },
    write: (ids) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(ids.slice(-CHECKED_MAX)));
      } catch {
        // 기억하지 못해도 다음에 한 번 더 물을 뿐이다.
      }
    },
  };
}

/**
 * 내 여행을 열 때 저절로 — 해외 곳 가운데 이름이 거친 것만, 이 기기에서 아직 물어보지 않은 것만, 한 번에 AUTO_MAX 곳까지 새로 붙인다.
 * 물을 곳이 없으면 null. 사람이 붙인 이름은 지킨다(shouldRename).
 */
export async function autoRefreshAbroadNames(
  supabase: SupabaseClient,
  userId: string,
  store: AskedStore = localAsked(userId),
): Promise<RefreshOutcome | null> {
  const asked = new Set(store.read());
  const visits = (await fetchOverseasVisits(supabase, userId))
    .filter((visit) => isRough(visit.placeName) && !asked.has(visit.id))
    .slice(0, AUTO_MAX);
  if (visits.length === 0) return null;
  return refreshAbroadNames(supabase, userId, visits, undefined, (ids) => {
    for (const id of ids) asked.add(id);
    store.write([...asked]);
  });
}
