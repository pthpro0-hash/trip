import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey } from "@/lib/photo/grouping";
import type { Trip } from "@/lib/photo/types";

/** 저장할 때 방문마다 붙여 둔 장소 정보. */
export interface VisitPlace {
  title: string;
  spotId: string | null;
  dong: string | null;
}

export interface SavedTrip {
  id: string;
  startedOn: string;
  endedOn: string;
  companions: string | null;
  note: string | null;
  /** 대표 사진의 보관함 경로. 사진을 올리지 않았으면 null. */
  coverPath: string | null;
  visits: {
    placeName: string;
    spotId: string | null;
    /** 행정동. 장소 이름을 몰라도 "강릉시"로 찾을 수 있게 한다. */
    dong: string | null;
    startedAt: string;
    photoCount: number;
  }[];
}

/*
  EXIF 시각은 타임존이 없는 벽시계 값이다. toISOString() 을 쓰면 UTC 로
  바뀌어 오전 사진이 전날로 밀린다. 표의 칸도 timestamp(타임존 없음)이라,
  읽은 그대로의 글자를 보낸다.
*/
function wallClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export interface DateRange {
  start: string;
  end: string;
}

/** 이미 저장한 여행들의 기간. 같은 사진을 두 번 넣는 일이 잦다. */
export async function fetchSavedRanges(
  supabase: SupabaseClient,
  userId: string,
): Promise<DateRange[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("started_on,ended_on")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data.map((row) => ({ start: row.started_on as string, end: row.ended_on as string }));
}

export function tripRange(trip: Trip): DateRange {
  const days = [...new Set(trip.shots.map((shot) => dayKey(shot.takenAt)))].sort();
  return { start: days[0], end: days.at(-1)! };
}

/**
 * 이미 저장한 여행과 날짜가 겹치는가.
 *
 * 기간이 똑같을 때만 걸러내면, 1박 2일로 저장해 둔 여행의 첫날 사진만
 * 다시 넣었을 때 새 여행으로 들어간다. 하루라도 겹치면 같은 여행으로 본다.
 * 날짜가 YYYY-MM-DD 라 글자 비교로 충분하다.
 */
export function overlapsSaved(range: DateRange, saved: DateRange[]): boolean {
  return saved.some((other) => range.start <= other.end && range.end >= other.start);
}

/**
 * 여행 하나를 저장한다.
 *
 * 여행을 먼저 만들고 방문을 넣는다. 방문 저장이 실패하면 껍데기만 남은
 * 여행이 생기므로, 그때는 방금 만든 여행을 되돌린다.
 */
export async function saveTrip(
  supabase: SupabaseClient,
  userId: string,
  trip: Trip,
  places: VisitPlace[],
  companions: string,
): Promise<{ ok: boolean; id?: string; visitIds?: string[] }> {
  const days = [...new Set(trip.shots.map((shot) => dayKey(shot.takenAt)))].sort();

  const { data: created, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: userId,
      started_on: days[0],
      ended_on: days.at(-1),
      companions: companions.trim() || null,
    })
    .select("id")
    .single();

  if (tripError || !created) return { ok: false };

  const rows = trip.visits.map((visit, index) => ({
    trip_id: created.id,
    user_id: userId,
    position: index,
    place_name: places[index]?.title ?? "알 수 없는 곳",
    spot_id: places[index]?.spotId ?? null,
    lat: visit.shots[0].lat,
    lng: visit.shots[0].lng,
    dong: places[index]?.dong ?? null,
    started_at: wallClock(visit.shots[0].takenAt),
    ended_at: wallClock(visit.shots.at(-1)!.takenAt),
    photo_count: visit.shots.length,
  }));

  // 사진을 어느 방문에 붙일지 알아야 하므로 만들어진 id 를 돌려받는다.
  const { data: insertedVisits, error: visitError } = await supabase
    .from("visits")
    .insert(rows)
    .select("id,position");

  if (visitError || !insertedVisits) {
    // 껍데기만 남은 여행을 남기지 않는다.
    await supabase.from("trips").delete().eq("id", created.id);
    return { ok: false };
  }

  const visitIds = insertedVisits
    .slice()
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((visit) => visit.id as string);

  return { ok: true, id: created.id, visitIds };
}

/**
 * 여행 하나를 지운다. 딸린 방문과 사진도 함께 사라진다
 * (스키마의 on delete cascade).
 *
 * RLS 가 이미 남의 기록을 막지만, user_id 조건을 한 번 더 건다.
 * 지우는 일에는 한 겹 더 있는 편이 낫다.
 */
export async function deleteTrip(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", userId);

  return !error;
}

/** 저장해 둔 여행을 최근 순으로. */
export async function fetchTrips(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedTrip[] | null> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id,started_on,ended_on,companions,note,visits(place_name,spot_id,dong,started_at,photo_count,position)",
    )
    .eq("user_id", userId)
    .order("started_on", { ascending: false });

  if (error || !data) return null;

  /*
    대표 사진만 따로 가져온다. 방문에 딸린 사진을 통째로 끌어오면 수백 줄이
    딸려 오는데, 목록에서 쓰는 것은 여행마다 한 장뿐이다.
  */
  const { data: covers } = await supabase
    .from("trip_photos")
    .select("storage_path, visits!inner(trip_id)")
    .eq("user_id", userId)
    .eq("is_cover", true);

  const coverByTrip = new Map<string, string>();
  for (const cover of covers ?? []) {
    const visit = cover.visits as unknown as { trip_id: string } | { trip_id: string }[];
    const tripId = Array.isArray(visit) ? visit[0]?.trip_id : visit?.trip_id;
    if (tripId) coverByTrip.set(tripId, cover.storage_path as string);
  }

  return data.map((row) => ({
    id: row.id as string,
    coverPath: coverByTrip.get(row.id as string) ?? null,
    startedOn: row.started_on as string,
    endedOn: row.ended_on as string,
    companions: row.companions as string | null,
    note: row.note as string | null,
    visits: ((row.visits ?? []) as Record<string, unknown>[])
      .slice()
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((visit) => ({
        placeName: visit.place_name as string,
        spotId: visit.spot_id as string | null,
        dong: visit.dong as string | null,
        startedAt: visit.started_at as string,
        photoCount: visit.photo_count as number,
      })),
  }));
}
