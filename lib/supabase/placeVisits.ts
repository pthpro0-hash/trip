import type { SupabaseClient } from "@supabase/supabase-js";

/*
  같은 이름으로 다녀온 때를 모은다.

  한 곳을 여러 해에 걸쳐 가 봤으면, 그곳이 어떻게 달라졌는지·그때마다
  누구와 무엇을 찍었는지를 한 화면에서 보고 싶어진다. 이름이 같으면
  같은 곳으로 친다 — 이름 고치기로 사람이 맞춰 둔 이름이 기준이다.
*/

export interface PlaceVisit {
  id: string;
  tripId: string;
  /** 그 여행의 이름. 없으면 화면이 날짜로 부른다. */
  tripTitle: string | null;
  placeName: string;
  spotId: string | null;
  dong: string | null;
  /** "2026-08-13T09:21:23" 벽시계 시각. */
  startedAt: string;
  photoCount: number;
}

/** 이 이름으로 다녀온 때. 최근부터. 못 불러오면 null. */
export async function fetchVisitsByName(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<PlaceVisit[] | null> {
  const { data, error } = await supabase
    .from("visits")
    .select("id,trip_id,place_name,spot_id,dong,started_at,photo_count,trips(title)")
    .eq("user_id", userId)
    .eq("place_name", name)
    .order("started_at", { ascending: false });

  if (error || !data) return null;
  return data.map((row) => {
    const trip = (Array.isArray(row.trips) ? row.trips[0] : row.trips) as { title?: string | null } | null;
    return {
      id: String(row.id),
      tripId: String(row.trip_id),
      tripTitle: trip?.title ?? null,
      placeName: String(row.place_name),
      spotId: (row.spot_id as string | null) ?? null,
      dong: (row.dong as string | null) ?? null,
      startedAt: String(row.started_at),
      photoCount: Number(row.photo_count ?? 0),
    };
  });
}
