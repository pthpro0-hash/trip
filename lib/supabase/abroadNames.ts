import type { SupabaseClient } from "@supabase/supabase-js";
import { isInKorea } from "@/lib/weatherGrid";
import { saveVisitName } from "./tripDetail";

/*
  해외에서 다녀온 곳의 이름을 세부 지역명으로 새로 붙인다.

  해외 장소 이름은 처음에 거칠게("영국 런던") 붙었거나 아예 못 붙었다("알 수 없는 곳"). 새 조회는 구역과 명소·길 이름까지("영국 런던
  Knightsbridge Royal Albert Hall") 준다. 내 기록의 해외 곳 이름을 한 번 새로 붙이는 길이다.

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

/** 해외 곳들의 이름을 새로 붙인다. 열 곳씩 묻고, 한 묶음이 끝날 때마다 알린다. */
export async function refreshAbroadNames(
  supabase: SupabaseClient,
  userId: string,
  visits: OverseasVisit[],
  onProgress?: (done: number, total: number) => void,
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
    } catch {
      outcome.failed += slice.length;
    }
    outcome.checked += slice.length;
    onProgress?.(outcome.checked, visits.length);
  }
  return outcome;
}
