import type { SupabaseClient } from "@supabase/supabase-js";
import { memoriesNear, type PlaceMemory } from "@/lib/placeMemory";

/*
  고친 곳 이름을 적어 두고 읽는다. 표의 규칙은 supabase/placeNames.sql.

  둘 다 곁다리다 — 못 읽거나 못 적어도 이름 고치기와 가져오기는 그대로
  된다. 기억이 없으면 지도 서비스가 지은 이름으로 돌아갈 뿐이다.
*/

const TABLE = "place_names";

export async function fetchPlaceNames(supabase: SupabaseClient, userId: string): Promise<PlaceMemory[]> {
  try {
    const { data, error } = await supabase.from(TABLE).select("id,lat,lng,name").eq("user_id", userId);
    if (error || !data) return [];
    return data.map((row) => ({
      id: String(row.id),
      lat: Number(row.lat),
      lng: Number(row.lng),
      name: String(row.name),
    }));
  } catch {
    return [];
  }
}

/** 이 자리를 이 이름으로 기억한다. 가까운 옛 기억은 지운다. 적었으면 true. */
export async function rememberPlaceName(
  supabase: SupabaseClient,
  userId: string,
  lat: number,
  lng: number,
  name: string,
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  try {
    const stale = memoriesNear(await fetchPlaceNames(supabase, userId), lat, lng);
    if (stale.length > 0) {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("user_id", userId)
        .in(
          "id",
          stale.map((memory) => memory.id),
        );
      if (error) return false;
    }
    const { error } = await supabase.from(TABLE).insert({ user_id: userId, lat, lng, name: trimmed });
    return !error;
  } catch {
    return false;
  }
}
