import type { SupabaseClient } from "@supabase/supabase-js";

export interface VisitPhoto {
  id: string;
  storagePath: string;
  takenAt: Date;
  /** 목록에서 이 여행을 대표하는 한 장인가. */
  isCover: boolean;
}

export interface VisitDetail {
  id: string;
  placeName: string;
  spotId: string | null;
  dong: string | null;
  lat: number;
  lng: number;
  startedAt: Date;
  endedAt: Date;
  photos: VisitPhoto[];
}

export interface TripDetail {
  id: string;
  title: string | null;
  startedOn: string;
  endedOn: string;
  companions: string | null;
  note: string | null;
  visits: VisitDetail[];
}

/*
  표의 시각 칸은 timestamp(타임존 없음)이라 "2026-09-13T09:21:23" 처럼
  돌아온다. 자바스크립트는 오프셋 없는 ISO 문자열을 현지 시각으로 읽으므로,
  찍힌 그대로의 벽시계 시각이 된다 — 여기서 UTC 로 바꾸면 안 된다.
*/
function wallClockToDate(value: string): Date {
  return new Date(value);
}

export async function fetchTripDetail(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<TripDetail | null> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id,title,started_on,ended_on,companions,note," +
        "visits(id,place_name,spot_id,dong,lat,lng,started_at,ended_at,position," +
        "trip_photos(id,storage_path,taken_at,is_cover))",
    )
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  /*
    중첩 select 문자열이 복잡해 supabase-js 가 타입을 풀어내지 못한다.
    돌아오는 모양은 우리가 적은 select 그대로이므로, 한 번 넓혀 두고
    아래에서 칸마다 좁힌다.
  */
  const row = data as unknown as Record<string, unknown>;

  const visits = ((row.visits ?? []) as Record<string, unknown>[])
    .slice()
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((visit) => ({
      id: visit.id as string,
      placeName: visit.place_name as string,
      spotId: visit.spot_id as string | null,
      dong: visit.dong as string | null,
      lat: visit.lat as number,
      lng: visit.lng as number,
      startedAt: wallClockToDate(visit.started_at as string),
      endedAt: wallClockToDate(visit.ended_at as string),
      photos: ((visit.trip_photos ?? []) as Record<string, unknown>[])
        .map((photo) => ({
          id: photo.id as string,
          storagePath: photo.storage_path as string,
          takenAt: wallClockToDate(photo.taken_at as string),
          isCover: Boolean(photo.is_cover),
        }))
        .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime()),
    }));

  return {
    id: row.id as string,
    title: row.title as string | null,
    startedOn: row.started_on as string,
    endedOn: row.ended_on as string,
    companions: row.companions as string | null,
    note: row.note as string | null,
    visits,
  };
}

/**
 * 여행 이름을 바꾼다. 비우면 지운다 — 그러면 화면이 날짜로 되돌아간다.
 *
 * 가져올 때 지어 준 이름이 늘 맞지는 않는다. "화진포해변 외 2곳"보다
 * "민수랑 첫 휴가"가 나중에 찾기 쉽다. 그 생각은 대개 한참 뒤에 난다.
 */
export async function saveTripTitle(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  title: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("trips")
    .update({ title: title.trim() || null })
    .eq("id", tripId)
    .eq("user_id", userId);

  return !error;
}

/** 그날 있었던 일을 적어 둔다. 비우면 지운다. */
export async function saveTripNote(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  note: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("trips")
    .update({ note: note.trim() || null })
    .eq("id", tripId)
    .eq("user_id", userId);

  return !error;
}
