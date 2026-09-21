import type { SupabaseClient } from "@supabase/supabase-js";

export interface RemoteCollections {
  wishlist: string[];
  trip: string[];
}

/** 계정에 저장된 두 목록. 읽지 못하면 null — 빈 목록과 구별해야 한다. */
export async function fetchRemote(
  supabase: SupabaseClient,
  userId: string,
): Promise<RemoteCollections | null> {
  const [wishlist, trip] = await Promise.all([
    supabase.from("wishlist").select("spot_id").eq("user_id", userId).order("added_at"),
    supabase.from("trip_plan").select("spot_id").eq("user_id", userId).order("position"),
  ]);

  /*
    빈 목록으로 착각하면 안 된다. 읽기에 실패했는데 []로 보면, 그 뒤의
    합치기가 "계정이 비어 있다"고 판단하고 기기 것만 남긴다 — 다른
    기기에서 담아둔 것이 조용히 사라진다.
  */
  if (wishlist.error || trip.error) return null;

  return {
    wishlist: (wishlist.data ?? []).map((row) => row.spot_id as string),
    trip: (trip.data ?? []).map((row) => row.spot_id as string),
  };
}

/**
 * 목록 하나를 계정에 맞춘다.
 *
 * 지우고 새로 넣지 않는다 — 그 사이에 실패하면 목록이 빈 채로 남는다.
 * 먼저 넣고(upsert) 나서 빠진 것만 지운다. 중간에 끊겨도 잃는 쪽이 아니라
 * 남는 쪽으로 기운다.
 */
async function pushList(
  supabase: SupabaseClient,
  table: "wishlist" | "trip_plan",
  userId: string,
  ids: string[],
  withPosition: boolean,
) {
  if (ids.length > 0) {
    const rows = ids.map((spotId, index) =>
      withPosition
        ? { user_id: userId, spot_id: spotId, position: index }
        : { user_id: userId, spot_id: spotId },
    );
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "user_id,spot_id" });
    if (error) return false;
  }

  const remove = supabase.from(table).delete().eq("user_id", userId);
  const { error } =
    ids.length > 0
      ? await remove.not("spot_id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
      : await remove;

  return !error;
}

export async function pushRemote(
  supabase: SupabaseClient,
  userId: string,
  collections: RemoteCollections,
): Promise<boolean> {
  const [wishlistOk, tripOk] = await Promise.all([
    pushList(supabase, "wishlist", userId, collections.wishlist, false),
    pushList(supabase, "trip_plan", userId, collections.trip, true),
  ]);
  return wishlistOk && tripOk;
}
