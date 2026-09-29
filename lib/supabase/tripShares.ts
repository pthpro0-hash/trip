import type { SupabaseClient } from "@supabase/supabase-js";
import { thumbUrls } from "./photos";
import { SHARE_BUCKET, sweepFolder } from "./shares";
import { newShareId } from "@/lib/share";
import {
  buildTripSnapshot,
  isTripSnapshot,
  tripPhotoPaths,
  type TripSnapshot,
} from "@/lib/tripShare";
import type { TripDetail } from "./tripDetail";

/*
  여행 하나를 링크로 보여 주기 — 올리고, 고치고, 끊는다.

  순서는 한 장 요약 링크(shares.ts)와 같다.

    만들 때  줄을 먼저 적는다 → 사진을 올린다. 보관함은 줄을 보고 주인을 가린다.
    끊을 때  폴더를 먼저 비운다 → 줄을 지운다. 줄부터 지우면 주인임을 밝힐 길이
             없어져 사진이 영영 남는다. 못 지웠으면 줄을 남기고 실패를 알린다.

  표와 보관함의 규칙은 supabase/tripShare.sql 에 있다.
*/

const TABLE = "trip_shares";
/** 사진을 나란히 올리는 수. */
const LANES = 4;
/** 표가 없다는 뜻의 오류 코드(Postgres · PostgREST). */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

export interface OwnTripShare {
  id: string;
  updatedAt: string;
}

/** 이 여행에 만들어 둔 링크. 없으면 null, 묻지 못했으면 "failed". */
export async function fetchOwnTripShare(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
): Promise<OwnTripShare | null | "failed"> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,updated_at")
    .eq("user_id", userId)
    .eq("trip_id", tripId)
    .maybeSingle();

  /*
    표가 아직 없으면(tripShare.sql 을 실행하기 전) 만든 링크도 없는 것이다.
    이때 "확인하지 못했다"로 두면 여행 지우기까지 막힌다.
  */
  if (error) return MISSING_TABLE.has(error.code ?? "") ? null : "failed";
  if (!data) return null;
  return { id: String(data.id), updatedAt: String(data.updated_at) };
}

export interface PublishedTrip {
  id: string;
  /** 예전 판의 사진을 다 치웠는가. 못 치웠으면 다시 누르게 알린다. */
  clean: boolean;
}

/**
 * 링크를 만들거나 지금 모습으로 고친다.
 *
 * 링크 주소는 한 번 정해지면 바뀌지 않는다(트리거가 막는다). 그래서 upsert 를
 * 쓰지 않고, 없으면 넣고 있으면 그 주소로 고친다. 다른 기기에서 먼저
 * 만들어 두었으면(넣기가 겹침으로 막히면) 그 줄을 찾아 고친다.
 */
export async function publishTripShare(
  supabase: SupabaseClient,
  userId: string,
  trip: TripDetail,
  existing: OwnTripShare | null,
  onProgress?: (done: number, total: number) => void,
): Promise<PublishedTrip | null> {
  const stamp = Date.now().toString(36);
  const photoPaths = tripPhotoPaths(trip);
  const files = new Map(photoPaths.map((path, index) => [path, `${stamp}-${index}.webp`]));

  const update = async (id: string, snapshot: TripSnapshot) => {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ snapshot, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    // 다른 곳에서 끊었으면 고칠 줄이 없다.
    return !error && Array.isArray(data) && data.length === 1;
  };

  // 줄이 먼저다 — 보관함은 줄을 보고 주인을 가린다.
  let id: string;
  const first = buildTripSnapshot(trip, files);
  if (existing) {
    id = existing.id;
    if (!(await update(id, first))) return null;
  } else {
    id = newShareId();
    const { error } = await supabase.from(TABLE).insert({ id, user_id: userId, trip_id: trip.id, snapshot: first });
    if (error) {
      // 23505: 이 여행의 줄이 이미 있다(다른 기기). 그 주소로 고친다.
      if (error.code !== "23505") return null;
      const found = await fetchOwnTripShare(supabase, userId, trip.id);
      if (!found || found === "failed") return null;
      id = found.id;
      if (!(await update(id, first))) return null;
    }
  }

  /*
    공개 보관함은 CDN 이 캐시한다. 길게 두면 링크를 끊은 뒤에도 한동안 사진이
    보인다. 1분이면 받는 쪽 속도에는 거의 차이가 없다.
  */
  const put = (file: string, body: Blob) =>
    supabase.storage.from(SHARE_BUCKET).upload(`${id}/${file}`, body, {
      contentType: body.type.startsWith("image/") ? body.type : "image/webp",
      upsert: true,
      cacheControl: "60",
    });

  // 비공개 보관함의 목록 판(960px)을 받아 그대로 옮긴다.
  const failed = new Set<string>();
  const urls = photoPaths.length > 0 ? await thumbUrls(supabase, photoPaths) : new Map<string, string>();
  const queue = [...files.entries()];
  let done = 0;
  const lane = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [path, file] = next;
      try {
        const url = urls.get(path);
        const response = url ? await fetch(url) : null;
        if (!response?.ok) throw new Error("download failed");
        const { error } = await put(file, await response.blob());
        if (error) throw error;
      } catch {
        failed.add(path);
      }
      done += 1;
      onProgress?.(done, files.size);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, lane));

  // 못 올린 것은 스냅샷에서 뺀다. 빈 자리를 가리키는 링크를 남기지 않는다.
  if (failed.size > 0) {
    for (const path of failed) files.delete(path);
    if (!(await update(id, buildTripSnapshot(trip, files)))) return null;
  }

  // 지금 판이 쓰는 것 말고는 다 지운다(예전 판, 중간에 끊긴 판).
  const clean = await sweepFolder(supabase, id, new Set(files.values()));
  return { id, clean };
}

/**
 * 링크를 끊는다. 폴더를 먼저 비우고, 줄은 나중에.
 * 다른 곳에서 먼저 끊었어도(지울 줄이 없어도) 끊긴 것이다.
 */
export async function revokeTripShare(supabase: SupabaseClient, share: OwnTripShare): Promise<boolean> {
  if (!(await sweepFolder(supabase, share.id, new Set()))) return false;
  const { error } = await supabase.from(TABLE).delete().eq("id", share.id);
  return !error;
}

export interface SharedTrip {
  id: string;
  snapshot: TripSnapshot;
  updatedAt: string;
}

/**
 * 남이 여는 링크. 표는 닫혀 있고, id 하나를 받아 그 한 줄만 돌려주는
 * 함수만 열려 있다(tripShare.sql 의 shared_trip).
 */
export async function fetchSharedTrip(supabase: SupabaseClient, id: string): Promise<SharedTrip | null> {
  const { data, error } = await supabase.rpc("shared_trip", { share_id: id });
  if (error || !data || typeof data !== "object") return null;
  const row = data as { id?: unknown; snapshot?: unknown; updatedAt?: unknown };
  if (!isTripSnapshot(row.snapshot)) return null;
  return { id: String(row.id), snapshot: row.snapshot, updatedAt: String(row.updatedAt ?? "") };
}
